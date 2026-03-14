# Feature Landscape: Personal Tutor Tab (v7.0)

**Domain:** Session-grounded multi-agent conversational AI tutor
**Researched:** 2026-03-15
**Scope:** NEW features only — the Personal Tutor tab addition. Existing Notes / Flashcards / Quiz tabs, floating chat bubble, and document upload are assumed complete.
**Overall confidence:** MEDIUM-HIGH (UX patterns HIGH; Agno Team streaming MEDIUM due to known async issue)

---

## Context: What Already Exists

The Personal Tutor tab is additive — not a replacement. The constraint boundary is the existing infrastructure:

- Floating chat: stateless per-request Agno agent, session-grounded, client owns 6-turn history, ephemeral on page leave
- Session storage: SQLite via `SESSION_DB_PATH` — notes, source_content, tutoring_type, session_type keyed by `session_id`
- AgentOS observability: all agents write traces to SQLite
- Existing agents: notes agent, flashcard agent, quiz agent, chat agent, research agent
- Known gap: flashcard and quiz output are NOT stored server-side after generation (only notes/source_content/tutoring_type persist)

The Tutor tab must feel meaningfully different from the floating chat. The core contract: **persistent history server-side, multi-agent routing, in-chat quiz, adaptive suggestions.**

---

## Table Stakes

Features users will expect the moment they see a "Personal Tutor" tab. Missing any of these makes the tab feel broken relative to the floating chat that already exists.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent conversation (survives page refresh) | Users associate a named tab with persistent state. The floating chat is ephemeral — the Tutor tab must be the opposite. | Medium | SQLite per `session_id`; server owns history. Client cannot own history here (ephemeral model is already taken by floating chat). Schema: tutor_messages table with session_id, role, content, timestamp, turn_index. |
| Session-grounded responses | Floating chat already sets this baseline. Tutor must match or exceed it — any response that leaks general knowledge feels like a regression. | Low | Coordinator and all specialist agents receive session notes + source_content as system context via the same SQLite lookup pattern as v2.0 chat. |
| Streaming word-by-word responses | The existing floating chat and SSE progress both stream. Any non-streaming response in the Tutor tab feels broken by comparison. | Medium | Agno Team streaming has a confirmed async/sync inconsistency (GitHub issue #2249). The workaround already used in this project — `asyncio.to_thread(team.run, ...)` — must be validated for Team. Coordinator streams final synthesised output only; specialist sub-agent intermediate tokens are not surfaced to the user. |
| Multi-turn conversation history | Follow-up questions are the core use case. Stateless per-turn routing breaks the "tutor" mental model immediately. | Medium | History fetched from SQLite at the start of each turn. Bounded sliding window (12-turn cap recommended — double the floating chat's 6-turn cap, but still bounded to manage token cost). Coordinator receives history as messages array. |
| Tone adaptation to tutoring mode | Floating chat already adapts to Micro / Kid / Advanced. The Tutor tab must honour the same contract or feel inconsistent. | Low | Read `tutoring_type` from session SQLite record. Pass into coordinator system prompt. All specialist agents inherit or receive it explicitly. |
| Graceful off-topic deflection | Users will probe boundaries. Unguarded multi-agent systems can leak general knowledge or do expensive specialist calls on irrelevant requests. | Low-Medium | Input guardrail: a lightweight prompt-based topic classifier runs before routing. If off-topic, coordinator responds with a polite redirect without invoking any specialist agent. No expensive LLM sub-call needed for the guardrail — classify in coordinator's own reasoning step. |
| Visual thinking/routing indicator | Multi-agent coordination adds latency over single-agent chat. Without a signal, the UI feels frozen. | Low | "Thinking..." or "Consulting specialist..." typing indicator during coordinator routing phase. Frontend concern — no backend change needed. Show indicator on message submit, hide on first stream token. |
| Output guardrail on generated content | Specialist agents should not produce off-topic or hallucinated content even if coordinator fails to filter upstream. | Low-Medium | Output guardrail: check that specialist output references session material before streaming to client. A second LLM call for grounding check is expensive — prefer a regex/keyword heuristic first; LLM check only on flagged responses. |

---

## Differentiators

Features that justify the Personal Tutor tab's existence over the floating chat. Users won't expect these, but they create the "this is genuinely different" moment.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| In-chat quiz mode | User types "quiz me" and gets an interactive MCQ exchange within the chat stream — not a redirect to the Quiz tab. Khanmigo's most-cited differentiator. | High | Coordinator routes to quiz specialist. Quiz specialist generates 1-3 questions using existing MCQ format. Questions rendered inline as selectable option buttons (not plain text). Evaluation sub-step checks selected answer and explains the correct one. Multi-turn: user can ask for another question or exit quiz mode. |
| Inline generated content (flashcard, notes snippet) | User asks "give me a flashcard for X" and gets a rendered flashcard card within the chat — not a redirect to the Flashcards tab. | Medium | Specialist outputs structured JSON (flashcard front/back or notes excerpt). Frontend detects structured JSON vs plain text in SSE stream and renders the appropriate component. Requires a content envelope protocol: coordinator wraps specialist output with a `content_type` field. |
| Adaptive focus area surfacing (Advisor) | After a completed in-chat quiz session or after detecting repeated confusion on a concept, the Advisor agent names the weak area and offers a targeted follow-up. Proactive without being interruptive. | High | Advisor runs as a post-processing step — not mid-stream. Its output appears as a distinct "Tutor suggests:" message visually separated from the Q&A exchange. Triggers: in-chat quiz session ends with score below threshold; same concept asked about 3+ times in session history; user opens Tutor tab immediately after completing the Quiz tab with a recorded score. |
| Socratic guidance mode | Coordinator withholds direct answers and instead asks guiding questions — Khanmigo's pedagogical core. Promotes active recall over passive reading. | Low-Medium | Prompt-level — a Socratic variant of the coordinator system prompt. Recommended default for "Teaching a Kid" tutoring type; optional for others. Could be user-toggled with a simple UI control ("Give me the answer" / "Guide me to it"). No additional agent needed. |
| Quiz tab result integration | When the user completes the Quiz tab and opens the Tutor tab, the tutor already knows which questions were missed and leads with targeted explanation. | Medium | Requires quiz results to be written to SQLite on Quiz tab completion (currently a known gap — flashcard/quiz output is not stored server-side). Frontend must POST quiz result on completion. Coordinator reads quiz_results table when starting a new Tutor session. Dependency on closing the known gap first. |

---

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full notes/flashcard/quiz regeneration from the Tutor tab | Duplicates the existing Regenerate flow; blurs tab responsibilities; triggers expensive full-session LLM calls from a chat interaction | Tutor generates only targeted inline content (one flashcard, one concept explanation, 1-3 quiz questions). Full regeneration stays in its own tabs via existing Regenerate buttons. |
| Streaming specialist sub-agent intermediate tokens | Sub-agent mid-stream output confuses users — they see tool-use reasoning, not tutoring content. Khanmigo does not show routing decisions. | Stream only coordinator's final synthesised response. Show "consulting specialist..." as a status message, not raw sub-agent tokens. |
| Cross-session progress tracking | Requires user accounts — explicitly out of scope in PROJECT.md. Building it here creates a false dependency and technical debt. | Surface per-session focus suggestions only. No cross-session history. |
| Mixed quiz formats (true/false, short answer) in chat | MCQ is the established format for this app. Adding answer-evaluation logic for open-ended responses in chat is a substantial NLP problem (grading subjectivity, hallucination risk). | MCQ only for in-chat quiz mode. Evaluation reuses the existing grading prompt pattern. |
| Replacing the floating chat with the Tutor tab | Floating chat is accessible from Notes/Flashcards/Quiz tabs where the Tutor tab is not visible. Both serve different contexts. | Keep floating chat as-is. Tutor tab is the persistent, multi-agent, opt-in deep experience. |
| Proactive unsolicited notifications outside the chat panel | Advisor nudges pushed as toasts or banners while user is reading Notes are disruptive. Khanmigo shows suggestions only within the tutoring session. | Advisor output appears only when the Tutor tab is active and the user is in a conversation. |
| Voice input / speech-to-text | Out of scope. Adds browser API dependency, mobile complexity, and privacy considerations. | Text input only — consistent with all other input surfaces in the app. |
| Autonomous agent actions (modifying session content, saving notes) | HitL research confirms: confirm-before-acting is reserved for high-stakes, irreversible actions. In a tutoring chat, every action is low-stakes and reversible (it's a conversation). BUT autonomously modifying session notes without user intent would cross the trust boundary. | Tutor generates inline content in the chat. It does not write to the session's notes or flashcard store. User initiates tab-level regeneration separately. |

---

## Human-in-the-Loop (HitL) Coordination Patterns

The central architectural decision for the coordinator: **when does it confirm with the user before acting vs. route silently?**

### Pattern A: Silent Routing (Default for all clear-intent requests)

Coordinator interprets user intent, selects the specialist, and streams the result. User never sees the routing decision.

**When to use:** Intent is unambiguous. The cost of a wrong routing guess (a conversational correction) is lower than the cost of a confirmation round-trip.

Examples:
- "What does osmosis mean?" → routes to Q&A specialist silently
- "Quiz me on section 2" → routes to quiz specialist silently
- "Give me a flashcard for photosynthesis" → routes to flashcard specialist silently
- "Explain that again differently" → coordinator handles directly without specialist

**Why preferred:** HitL research confirms that silent routing with confidence thresholds is the dominant pattern in production conversational AI (2025). Confirmation gates are reserved for high-stakes, irreversible, or ambiguous actions. Chat tutoring has no irreversible actions.

### Pattern B: Single Clarifying Question (Selective — high ambiguity only)

Coordinator surfaces its interpretation as a clarifying question before routing to an expensive specialist.

**When to use:** Input is genuinely ambiguous between two meaningfully different paths, and the wrong path produces a worse outcome than a one-turn delay.

Examples:
- "Let's do some practice" — could mean in-chat quiz mode OR worked examples with hints
- "Can you help me understand this better" — too vague to route confidently

**Implementation:** Coordinator responds with one plain-text question in the chat. NOT a modal or blocking UI element. One follow-up maximum — if still ambiguous, default to the most common path (Q&A specialist).

### Pattern C: Proactive Advisor Nudges (Post-event, async)

Advisor agent does NOT interrupt an in-progress exchange. It runs after a defined trigger event and surfaces a suggestion as a visually distinct message.

**Trigger events and what to surface:**

| Trigger | Advisor Output |
|---------|---------------|
| In-chat quiz session ends (score < 60%) | "You missed questions on [topic]. Want me to walk through that concept?" |
| Same concept asked 3+ times in session history | "You've asked about [concept] a few times. Want a targeted flashcard?" |
| User opens Tutor tab after completing Quiz tab (if quiz result persisted) | "Your quiz showed some gaps in [topic]. Let's work on that." |

**Implementation:** Advisor is a lightweight post-processing agent that reads the last N turns and quiz data. Its output is delivered as the first message when the Tutor tab is opened (if a trigger is met) or immediately after an in-chat quiz ends. It is never injected mid-Q&A exchange.

---

## Feature Dependencies

```
Persistent conversation (SQLite tutor_messages table)
  └── ALL other Tutor tab features depend on this — nothing works without server-owned history

Session-grounded responses
  └── Existing SESSION_DB_PATH / session_id lookup (already built)

Agno Team coordinator
  └── Streaming validation (async issue #2249 — must verify Team.astream() or use to_thread workaround)
  └── All specialist agents (reuse existing chat, quiz, flashcard, notes agents)
  └── Persistent conversation (coordinator reads history from SQLite each turn)

Input guardrail (topic classifier)
  └── Runs before coordinator routing — no specialist dependency

In-chat quiz mode
  └── Agno Team coordinator (quiz specialist routed via coordinator)
  └── Quiz result integration (quiz result written to SQLite for Advisor to read)
  └── Frontend inline MCQ renderer (new UI component — selectable option buttons in chat)

Inline generated content (flashcard, notes snippet)
  └── Agno Team coordinator (content specialist routed via coordinator)
  └── Content envelope protocol (coordinator wraps structured JSON output with content_type field)
  └── Frontend content renderer (detect content_type in stream, render appropriate component)

Quiz tab result integration
  └── Quiz result persistence (KNOWN GAP — flashcard/quiz not stored server-side in v6.0)
  └── Frontend quiz completion POST to new /sessions/{id}/quiz-result endpoint
  └── Advisor agent reads quiz_results table

Adaptive focus area surfacing (Advisor)
  └── Persistent conversation (reads session history)
  └── In-chat quiz mode (reads in-chat quiz scores)
  └── Quiz tab result integration (optional — advisor works without it, but richer with it)
```

---

## MVP Recommendation

**Build in this order, stopping after each to validate:**

1. **Persistent conversation + session grounding** — the foundation. New SQLite schema (tutor_messages), new POST `/tutor/stream` endpoint, history fetched at turn start. Nothing else works without this. Highest infrastructure risk.

2. **Agno Team coordinator with silent routing** — wire coordinator to existing specialist agents. Validate streaming end-to-end (confirm async workaround works for Team as it does for Workflow). Input guardrail is prompt-level — include in coordinator system prompt from the start.

3. **In-chat quiz mode** — highest perceived value differentiator. Reuses existing quiz agent. Requires new frontend component: inline MCQ option buttons within chat stream. Multiple turns of quiz state must be tracked in conversation history.

4. **Inline content generation (flashcard, notes snippet)** — medium complexity, high delight. Requires content envelope protocol and frontend renderer. Add after quiz mode is stable.

5. **Advisor / adaptive focus area surfacing** — build last. Depends on in-chat quiz data. Can ship a basic version (reads conversation history only) before quiz tab result integration is complete.

**Defer:**
- **Quiz tab result integration** — closing the "quiz not persisted server-side" gap is a prerequisite sub-task. It touches the Quiz tab frontend and adds a new backend endpoint. Treat as a parallel prerequisite task, not a core Tutor tab feature. If it ships in time, Advisor gets richer signals. If not, Advisor still works from in-chat quiz data.
- **Socratic mode toggle** — prompt-level change only; easy to add once coordinator is stable. Not MVP.

---

## Complexity Summary

| Feature | Complexity | Dominant Risk |
|---------|------------|--------------|
| Persistent conversation (SQLite history) | Medium | SQLite schema + token window management; concurrent reads during SSE (WAL mode already configured) |
| Agno Team coordinator + routing | Medium-High | Streaming stability (async issue #2249); coordinator prompt quality for routing accuracy; per-request Team factory needed to avoid state cross-contamination (same pattern as Workflow) |
| Input/output guardrails | Low-Medium | False positive rate for topic classifier; output guardrail cost (avoid second LLM call per response) |
| In-chat quiz mode | High | Frontend inline MCQ rendering within SSE stream; multi-turn quiz state in conversation history; answer evaluation prompt reliability |
| Inline content generation | Medium | Content envelope protocol design; frontend stream parser; rendering component for flashcard/notes in chat bubble |
| Advisor / focus area surfacing | High | Trigger logic calibration; risk of over-nudging; depends on closing quiz persistence gap for full signal |
| Quiz tab result integration (prerequisite) | Medium | New backend endpoint; frontend quiz completion POST; separate from Tutor tab scope |

---

## Sources

- [Agno Teams Overview — docs.agno.com](https://docs.agno.com/teams/overview) — coordination modes (route, coordinate, broadcast, tasks); HitL pause/resume — HIGH confidence (official docs)
- [Agno GitHub issue #2249 — async streaming does not stream real-time](https://github.com/agno-agi/agno/issues/2249) — confirmed async path buffers response; sync via thread pool is the workaround — HIGH confidence (official issue tracker)
- [Google Multi-Agent Design Patterns — developers.googleblog.com](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) — coordinator/dispatcher, parallel fan-out, generator-critic; state management via shared whiteboard — MEDIUM confidence
- [Agno investment team example — github.com/agno-agi/investment-team](https://github.com/agno-agi/investment-team) — 7-specialist coordinator pattern, four coordination modes in practice — HIGH confidence (official example)
- [Khanmigo learner features — khanmigo.ai/learners](https://www.khanmigo.ai/learners) — activity-based tutoring, Socratic guidance, adaptive quiz UX, natural nudges — MEDIUM confidence (product documentation)
- [Q-Chat / Quizlet — meet-q-chat](https://quizlet.com/blog/meet-q-chat) — MCQ in chat, Socratic method, study mode UX (discontinued June 2025 — prior art) — MEDIUM confidence
- [Khanmigo AVID Open Access review](https://avidopenaccess.org/resource/khanmigo-as-an-ai-personal-tutor-and-assistant/) — activity selection UX, confidence-gated activity launch, MCQ rounds with hints — MEDIUM confidence
- [HitL in agentic systems — Medium](https://medium.com/@tahirbalarabe2/human-in-the-loop-agentic-systems-explained-db9805dbaa86) — confirm-before-acting vs silent routing; confidence thresholds; strategic vs routine HitL — MEDIUM confidence
- [AI SDK HitL / needsApproval pattern — ai-sdk.dev](https://ai-sdk.dev/cookbook/next/human-in-the-loop) — confirms HitL confirmation gates are for high-stakes irreversible actions — HIGH confidence (official SDK docs)
- [Quiz feedback UX patterns — Medium](https://medium.com/@maxmaier/finding-the-best-pattern-for-quiz-feedback-9e174b8fd6b8) — immediate vs cumulative feedback; messenger interface constraints for quiz UX — MEDIUM confidence
- [Quizbot conversational self-assessment — Springer](https://link.springer.com/chapter/10.1007/978-3-030-25264-9_8) — formative feedback in chat, immediate per-answer feedback vs end-of-session summary — MEDIUM confidence (academic)
- [AI Guardrails guide — patronus.ai](https://www.patronus.ai/ai-reliability/ai-guardrails) — input/output guardrail layers; topic relevance control; grounding checks — MEDIUM confidence
- [Adaptive learning systems 2025 — disco.co](https://www.disco.co/blog/ai-adaptive-learning-systems-2025-alternatives) — weak-area detection, targeted practice recommendation, post-quiz analysis patterns — MEDIUM confidence
- [Advanced SQLite sessions — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/sessions/advanced_sqlite_session/) — server-side conversation history with SQLite; atomic persistence pattern — MEDIUM confidence
- [ChatGPT Study Mode — datastudios.org](https://www.datastudios.org/post/how-to-use-chatgpt-s-study-mode-for-deep-learning-spaced-repetition-and-exam-preparation/) — Socratic prompting, scaffolded content, in-chat knowledge checks — MEDIUM confidence

---

*Feature research for: Super Tutor v7.0 Personal Tutor Tab*
*Researched: 2026-03-15*
