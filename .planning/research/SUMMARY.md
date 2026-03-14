# Project Research Summary

**Project:** Super Tutor — v7.0 Personal Tutor milestone
**Domain:** Agno Team multi-agent tutoring tab added to an existing FastAPI + AgentOS app
**Researched:** 2026-03-15
**Confidence:** MEDIUM-HIGH (stack HIGH from direct source inspection; async persistence path MEDIUM due to contradictory signals)

## Executive Summary

Super Tutor v7.0 adds a Personal Tutor tab backed by an Agno `Team` coordinator. The tab must feel meaningfully different from the existing floating chat: persistent server-side conversation history, intelligent routing to specialist agents (Q&A, quiz, flashcard, advisor), and adaptive suggestions based on student performance. All required API surface already exists in the installed agno 2.5.8 package. No new pip dependencies, no new SQLite files, and no schema migrations are needed — the addition is purely new application code wired to the existing infrastructure.

The recommended architecture is a per-request `build_tutor_team()` factory producing an Agno `Team` with a coordinator LLM and four specialist members. Session persistence reuses the existing `traces_db` `SqliteDb` instance with a `tutor:{session_id}` namespace prefix, exactly mirroring the pattern already in place for the chat agent. The coordinator routes student messages silently in the vast majority of cases, reserving clarification questions only for genuinely ambiguous requests. The specialist roster — content Q&A, quiz, flashcard, and advisor — is built primarily by reusing and lightly extending existing agent factories, with only the Advisor being wholly new.

The most significant risk is the async persistence path. There is a direct contradiction between Architecture research (which verified `await team.asave_session()` in `_run.py` line 3996 of `_arun_stream`) and Pitfalls research (which flags GitHub Issue #4214 reporting that `team.arun()` does not populate `run_messages` after the async call completes). This contradiction must be the first thing resolved in the Team foundation phase — via direct SQLite inspection after a live test run — before any UI work begins. If async persistence is broken, the fallback is `asyncio.to_thread(team.run, ...)` with simulated frontend streaming, exactly as was done for the Workflow in v6.0. A second contradiction — whether to use `TeamMode.route` (STACK.md recommendation) or `TeamMode.coordinate` (ARCHITECTURE.md recommendation) — must also be resolved explicitly at implementation start.

## Key Findings

### Recommended Stack

No new packages are required. The Personal Tutor tab is delivered entirely within agno 2.5.8, already installed, using three new application files (`tutor_team.py`, `routers/tutor.py`, `agents/advisor_agent.py`) plus minor extensions to `guardrails.py`, `config.py`, and `main.py`. The existing `traces_db` `SqliteDb` instance covers team session persistence through the shared `agno_sessions` table — no new file, no migration. The existing `chat.py` SSE pattern is the streaming model, with only the event name changing from `"RunContent"` to `"TeamRunContent"`.

**Core technologies:**
- `agno.team.Team` (agno 2.5.8): coordinator + specialist member orchestration — already installed, all constructor parameters verified from package source
- `agno.team.TeamMode`: controls routing behavior — four verified modes: `coordinate`, `route`, `broadcast`, `tasks`
- `agno.run.team.TeamRunEvent`: stream event filtering — `TeamRunEvent.run_content` = `"TeamRunContent"` is the content token event
- `agno.guardrails.BaseGuardrail` + `PromptInjectionGuardrail`: guardrail interface — existing singletons reusable at Team level; new `TopicRelevanceGuardrail` subclass needed
- `SqliteDb` (`traces_db`): session persistence — existing shared instance; `tutor:{session_id}` prefix isolates team rows from workflow and chat rows
- Verified import paths: `from agno.team import Team, TeamMode` / `from agno.run.team import TeamRunEvent, TeamRunOutput, TeamRunOutputEvent`

**Critical verification needed:** `Agent.role` parameter is MEDIUM confidence — seen in Team source references but not directly verified in `Agent.__init__`. Confirm before wiring member roles.

For full API details see `.planning/research/STACK.md`.

### Expected Features

**Must have (table stakes):**
- Persistent conversation history (survives page refresh) — server owns history via `add_history_to_context=True` + `db=traces_db`; client sends only the current message and `session_id`
- Session-grounded responses — all specialists receive `notes` + `source_content` as system context, same SQLite lookup as existing chat
- Streaming word-by-word responses — `team.arun(stream=True)` async generator; filter on `"TeamRunContent"` events
- Multi-turn conversation history — bounded sliding window, `num_history_runs` cap (12 recommended; double the floating chat's 6-turn cap but still bounded to manage token cost)
- Tone adaptation to tutoring mode — read `tutoring_type` from session; all specialists inherit it
- Graceful off-topic deflection — `TopicRelevanceGuardrail(BaseGuardrail)` at coordinator input; keyword-heuristic first, LLM judge only for flagged cases
- Visual thinking/routing indicator — frontend concern only; show "Consulting specialist..." on submit, hide on first stream token

**Should have (competitive differentiators):**
- In-chat quiz mode — coordinator routes to quiz specialist; inline MCQ with selectable option buttons; multi-turn quiz state in conversation history
- Inline flashcard/notes generation — content envelope protocol wrapping specialist JSON with `content_type` field; frontend renderer detects and renders
- Adaptive focus area surfacing (Advisor agent) — post-event, async; triggers on in-chat quiz score below 60%, same concept asked 3+ times, or quiz tab result detected on session open
- Socratic guidance mode — prompt-level variant only; default for "Teaching a Kid" tutoring type; no additional agent

**Defer (post-v7.0):**
- Quiz tab result integration — depends on closing the known gap where quiz output is not persisted server-side; treat as a parallel prerequisite that enriches the Advisor but is not blocking
- Cross-session progress tracking — requires user accounts, explicitly out of scope per PROJECT.md
- Voice input / speech-to-text — out of scope; text input only
- Mixed quiz formats (true/false, short answer in chat) — MCQ only for v7.0

For full feature details see `.planning/research/FEATURES.md`.

### Architecture Approach

The v7.0 architecture adds a single new route group (`/tutor`) alongside existing routes, registered before AgentOS wrapping in `main.py`. The Team is instantiated per-request via a factory function — the same pattern used for the existing Workflow — to prevent session state cross-contamination across concurrent users (CVE-2025-64168). All team session rows live in the existing `agno_sessions` SQLite table under the `tutor:{session_id}` prefix. The SSE streaming pattern mirrors the existing chat router verbatim, with only the event name changed from `"RunContent"` to `"TeamRunContent"`. Member agents have `add_history_to_context=False`; history is managed at the Team coordinator level.

**Major components:**
1. `backend/app/teams/tutor_team.py` (NEW) — `build_tutor_team(session_id, notes, tutoring_type, db)` per-request factory; coordinator instructions; four specialist members wired from existing agent factories plus one new advisor
2. `backend/app/routers/tutor.py` (NEW) — `POST /tutor/{session_id}/stream` SSE endpoint; `GET /tutor/{session_id}/history`; session load from `traces_db`; `tutor:{session_id}` namespacing; rate limiting
3. `backend/app/agents/advisor_agent.py` (NEW) — `build_advisor_agent()` — new specialist for focus area surfacing based on quiz performance and conversation patterns
4. `backend/app/agents/guardrails.py` (EXTENDED) — `TopicRelevanceGuardrail(BaseGuardrail)` subclass raising `InputCheckError(CheckTrigger.OFF_TOPIC)`
5. `backend/app/agents/chat_agent.py` (EXTENDED) — `build_tutor_chat_agent()` variant with `role=` parameter and `add_history_to_context=False`
6. Frontend: `TutorTab.tsx` + `tutor.ts` (NEW) — persistent chat panel as the 4th study tab; `fetchTutorHistory()` on mount; `streamTutorMessage()` on submit

**TeamMode contradiction to resolve:** STACK.md recommends `TeamMode.route`; ARCHITECTURE.md recommends `TeamMode.coordinate`. See Contradictions section.

For full component boundaries and data flow see `.planning/research/ARCHITECTURE.md`.

### Critical Pitfalls

1. **Shared Team or Agent instances across requests (CVE-2025-64168)** — use `build_tutor_team()` per-request factory; never share a Team or member Agent instance. If two concurrent requests share the same Team, session state leaks between users. Detection: one user's notes or history appears in another user's Tutor responses.

2. **`session_id` collision overwrites Workflow row in `agno_sessions`** — always namespace with `f"tutor:{session_id}"`; same pattern as `f"chat:{session_id}"` in `chat.py` line 60. Detection: `GET /sessions/{id}` returns empty notes after the first Tutor turn.

3. **`team.arun()` async persistence (Issue #4214 vs. `_run.py` line 3996) — must validate first** — run one Team call, inspect the `agno_sessions` SQLite row, run a second call, verify the second call's context includes the first turn. If it fails, fall back to `asyncio.to_thread(team.run, ...)` + simulated frontend streaming. Do not build any multi-turn feature before this is confirmed. See Contradictions section.

4. **AgentOS route conflict — tutor router must be registered before `_wrap_with_agentos()`** — include the tutor router in `main.py` in the same block as chat, sessions, and upload routers, before the AgentOS wrapping call. Detection: `POST /tutor/stream` returns a JSON body instead of an SSE stream.

5. **Guardrail false positives on educational phrasing** — apply `PromptInjectionGuardrail` at coordinator input only (not cascaded to each specialist); use LLM-as-judge topic relevance check rather than pure pattern matching; do not attach `validate_substantive_output` to JSON-returning specialists (quiz, flashcard). Educational phrases like "pretend you're teaching me" or "forget what I said" can trigger pattern-match guardrails.

For all twelve pitfalls with detection signals and recovery strategies see `.planning/research/PITFALLS.md`.

## Contradictions Requiring Resolution

Two direct conflicts between research files must be resolved before or at the start of implementation.

### Contradiction 1: TeamMode — `route` vs. `coordinate`

| Source | Recommendation | Reasoning |
|--------|---------------|-----------|
| STACK.md | `TeamMode.route` | Coordinator picks one specialist and returns that specialist's response directly — no synthesis overhead; student gets verbatim specialist response; recommended for tutoring use case |
| ARCHITECTURE.md | `TeamMode.coordinate` | Coordinator interprets the student's question, picks the right specialist, and synthesizes the final response — noted as "the correct choice" for this use case |

**Resolution guidance:** Both modes are technically sound. `TeamMode.route` has lower latency and is correct when specialists produce complete, polished user-facing responses. `TeamMode.coordinate` allows the coordinator to adapt or contextualize specialist output (e.g., applying Socratic tone to a quiz specialist's answer). Recommendation: start with `TeamMode.route` for simplicity and lower latency during the foundation phase. Upgrade to `TeamMode.coordinate` if the coordinator needs to post-process or reframe specialist output. The coordinator system prompt must be written to match whichever mode is chosen. **Document the decision explicitly at Phase 14 start.**

### Contradiction 2: `Team.arun()` Session Persistence

| Source | Claim | Evidence |
|--------|-------|---------|
| ARCHITECTURE.md | Async persistence works correctly | `await team.asave_session()` verified at `_run.py` line 3996 inside `_arun_stream`; called in all async runner cleanup paths |
| PITFALLS.md | Async persistence is unreliable | GitHub Issue #4214 (August 2025): `run_messages` is `None` after `team.arun()` completes; pattern matches Workflow issue #3819 that required `asyncio.to_thread` workaround |

**Resolution guidance:** Architecture inspected the code path; Pitfalls inspected the bug tracker. Both are valid evidence. The issue may be that `asave_session` is called but `run_messages` is separately not populated — partial persistence with history working but run metadata absent. **Validate in Phase 13 before any other Team work.** Accepted test: call `team.arun()` once with `add_history_to_context=True`, inspect the `agno_sessions` SQLite row directly, call it again, verify the second call's coordinator context includes the first turn's messages. Pass = use `arun()` directly. Fail = use `asyncio.to_thread(team.run, ...)` with simulated streaming.

## Implications for Roadmap

### Phase 13: Team Foundation + Streaming Validation

**Rationale:** Nothing else can be built until the Team factory, session namespacing, and streaming pattern are confirmed to work. This phase resolves the highest-risk unknown (Contradiction 2) before any UI investment is made.

**Delivers:** Working `POST /tutor/{id}/stream` SSE endpoint with a minimal Team (coordinator + ContentExplainer only); confirmed SQLite persistence with multi-turn context continuity; `tutor:{session_id}` namespacing in place; per-request factory enforced.

**Addresses:** Table stakes — streaming responses, session grounding, multi-turn history foundation

**Avoids:**
- Pitfall 1 (CVE-2025-64168): per-request factory enforced from the first line of code
- Pitfall 2: `tutor:` namespace set before any Team run is attempted
- Pitfall 3: async persistence explicitly validated; fallback path chosen if it fails
- Pitfall 5: tutor router registered before AgentOS wrapping

**Research flag:** No research phase needed — stack is HIGH confidence from source inspection. The validation step is a code test, not a research task. Inspect `agno/team/_run.py` line 3996 and confirm against a live SQLite inspection.

---

### Phase 14: Full Specialist Roster + Persistent History Endpoint

**Rationale:** Once streaming and persistence are confirmed, add remaining specialists and the history endpoint. History endpoint depends on there being actual persisted data from Phase 13 runs. TeamMode decision must be locked in at this phase's start.

**Delivers:** Full four-specialist Team (ContentExplainer, QuizRunner, FlashcardMaker, AdvisorAgent); `GET /tutor/{id}/history` endpoint for tab-mount history restoration; confirmed multi-turn context continuity across server restarts.

**Uses:** `build_advisor_agent()` (new); `build_quiz_agent()` and `build_flashcard_agent()` with `role=` parameter added; `add_history_to_context=True` with `num_history_runs` cap; `store_history_messages=True` explicitly set.

**Implements:** Full team factory component; history retrieval data flow

**Avoids:**
- Pitfall 4 (streaming vs. sync tension): async/sync decision locked in Phase 13 — not re-evaluated here
- Pitfall 6 (coordinator over-routing): coordinator instructions written with explicit per-specialist routing rules by name; 10-message routing accuracy test run before sign-off
- Pitfall 8 (output guardrail blocking JSON): `validate_substantive_output` not attached to QuizRunner or FlashcardMaker
- Pitfall 9 (history cross-contamination): `store_history_messages=True` and `num_history_runs` cap explicitly set
- Pitfall 10 (session_state collision): notes embedded in system prompt instructions, not in `session_state` constructor argument
- Pitfall 11 (member session_id override): `session_id` not set on member agents; Team owns it at `arun()` call site

**Key decisions at phase start:** Resolve Contradiction 1 (TeamMode); verify `Agent.role` parameter exists in agno 2.5.8 `Agent.__init__`; verify `AgentOS(teams=[...])` parameter in `agno/os/agentos.py` (skip registration silently if absent).

**Research flag:** No research phase needed. Verify `AgentOS(teams=[])` parameter as a code check, not a research task.

---

### Phase 15: Guardrails + Coordinator Prompt Hardening

**Rationale:** Guardrails require a working Team to test against; false positive calibration requires realistic input flowing through real routing paths. Cannot be calibrated in isolation.

**Delivers:** `TopicRelevanceGuardrail(BaseGuardrail)` in `guardrails.py`; `PromptInjectionGuardrail` applied at coordinator input only (not cascaded to specialists); 20-message false positive rate validated below 2%.

**Implements:** Input guardrail layer; output guardrail scope restrictions per specialist

**Avoids:**
- Pitfall 7 (guardrail false positives on educational phrasing): LLM-as-judge for topic relevance; no cascade of pattern guards
- Pitfall 8 (output guardrail blocking specialist JSON): output hook not applied to structured-output specialists

**Research flag:** No research phase needed. `BaseGuardrail` interface and `CheckTrigger` enum are HIGH confidence from direct source inspection. Standard subclassing pattern.

---

### Phase 16: Frontend Tutor Tab

**Rationale:** Frontend can begin once the Phase 13 endpoint is curl-verified. Backend and frontend development can run in parallel starting from Phase 14 onward. History endpoint (Phase 14) must be complete before full tab integration.

**Delivers:** `TutorTab.tsx` (4th study tab); `tutor.ts` API client; persistent message rendering with auto-scroll; token streaming; "Consulting specialist..." typing indicator; `fetchTutorHistory()` on mount.

**Avoids:** No additional backend pitfalls — phase is purely frontend. Watch for: SSE `ReadableStream` handling matching the existing chat tab pattern; do not manually set `Content-Type` header on SSE requests.

**Research flag:** No research phase needed. Mirrors existing floating chat SSE implementation. Pattern is established.

---

### Phase 17: Differentiator — In-Chat Quiz Mode

**Rationale:** Highest perceived value differentiator. Depends on a stable Team (Phase 14) and working frontend (Phase 16). In-chat quiz state must survive multi-turn exchanges within the conversation history.

**Delivers:** Interactive in-chat MCQ exchange triggered by "quiz me" requests; inline selectable option buttons rendered within chat stream; answer evaluation and explanation; multi-turn quiz state tracked in conversation history.

**Addresses:** "In-chat quiz mode" differentiator from FEATURES.md; Khanmigo's most-cited capability

**Research flag:** Needs research on content envelope protocol for SSE-embedded structured JSON before implementation. No established codebase pattern to mirror. Frontend rendering of selectable MCQ options within a streaming text response is non-trivial. Recommend a focused research spike on the protocol design and frontend renderer component before Phase 17 planning.

---

### Phase 18: Differentiators — Inline Content Generation + Advisor

**Rationale:** Both features depend on the full specialist roster (Phase 14) and stable quiz mode (Phase 17) for the Advisor's quiz score trigger signal. Advisor works without quiz tab result integration but is richer with it.

**Delivers:** Inline flashcard rendering in chat (content envelope protocol + frontend renderer); Advisor agent proactive suggestions delivered as visually distinct messages; triggers on quiz score below 60%, same concept asked 3+ times, or quiz tab result present on session open.

**Addresses:** "Inline generated content" and "Adaptive focus area surfacing" differentiators from FEATURES.md

**Research flag:** Content envelope protocol design needs research — same concern as Phase 17. Advisor trigger calibration (thresholds, timing) benefits from a brief research spike on Khanmigo-style nudge patterns to avoid over-nudging.

---

### Phase Ordering Rationale

- Phases 13-14 sequence is hard-ordered: streaming and persistence must be confirmed before multi-turn features are layered on top. The async persistence contradiction is the highest-risk unknown in the project — building UI on an unvalidated foundation is the same mistake that required the Workflow `asyncio.to_thread` workaround.
- Phase 15 (guardrails) follows the full specialist roster so false positive calibration uses realistic routing paths through all four specialists.
- Phase 16 (frontend) is partially parallelizable with Phase 14 once the Phase 13 endpoint is curl-verified. Full tab integration waits for the history endpoint.
- Phases 17-18 are last because they depend on infrastructure stability. In-chat quiz comes before the Advisor because the Advisor uses in-chat quiz scores as its primary trigger signal.

### Research Flags

Phases needing `/gsd:research-phase` during planning:
- **Phase 17 (In-Chat Quiz):** Content envelope protocol for SSE-embedded structured JSON is non-trivial; no existing codebase pattern to mirror; frontend MCQ rendering within a streaming response is the key unknowns
- **Phase 18 (Inline Content + Advisor):** Same content envelope protocol; Advisor trigger threshold calibration benefits from product research on nudge timing patterns

Phases with standard patterns (skip research-phase):
- **Phase 13 (Team Foundation):** All APIs are HIGH confidence from direct source inspection; validation step is a code test
- **Phase 14 (Full Specialist Roster):** Factory extension pattern is established in the existing codebase
- **Phase 15 (Guardrails):** `BaseGuardrail` interface is HIGH confidence; standard subclassing
- **Phase 16 (Frontend Tab):** Mirrors existing floating chat SSE implementation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified from direct inspection of agno 2.5.8 installed source. `Agent.role` parameter is the only MEDIUM item — seen in Team source references but not directly verified in `Agent.__init__`. No new dependencies needed. |
| Features | MEDIUM-HIGH | Table stakes and differentiators are HIGH confidence from Khanmigo/Quizlet precedent and agno docs. Complexity estimates for in-chat quiz and inline content generation are MEDIUM — no existing implementation in this codebase to reference. |
| Architecture | HIGH | Component boundaries, data flow, and streaming patterns are HIGH confidence from direct source inspection and existing codebase analogy. AgentOS `teams=[]` parameter is MEDIUM — not verified against `agno/os/agentos.py`. |
| Pitfalls | HIGH | Pitfalls 1-5 have direct evidence (CVE record, GitHub issues, existing codebase). Pitfall 3 directly contradicts an Architecture finding — the conflict itself is high confidence; its resolution requires a live validation run against the installed package version. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **`team.arun()` persistence (Contradiction 2):** Must run a live test at Phase 13 start. Do not assume either research file is correct — test directly against agno 2.5.8. The result determines the async vs. sync path for all subsequent phases. This is the most important gap in the entire research.

- **TeamMode selection (Contradiction 1):** Resolve at Phase 14 start with an explicit written decision. Document the rationale. The choice affects coordinator prompt design and response latency. Both modes are valid; the decision is a product/UX judgment.

- **`Agent.role` parameter existence:** Verify `Agent.__init__` accepts `role=` in agno 2.5.8 before wiring specialist roles. If absent, use `Agent.description` or encode role information in the `Agent.name` field for coordinator routing.

- **`AgentOS(teams=[...])` parameter:** Check `agno/os/agentos.py` before Phase 14 implementation. Skip registration silently if absent — Team functions correctly without AgentOS registration (tracing via `db=traces_db` still works).

- **Content envelope protocol design (Phases 17-18):** No established pattern in this codebase. A focused research spike is needed before Phase 17 planning to define how structured JSON (flashcards, MCQ options) is embedded in the SSE token stream without breaking the existing frontend stream parser.

- **Quiz tab result persistence gap:** The Advisor agent works without this, but its signal quality improves significantly when quiz tab results are persisted to SQLite. Track this as a parallel prerequisite task, not a core Tutor tab blocker.

## Sources

### Primary (HIGH confidence — direct source inspection of agno 2.5.8)

- `backend/venv/lib/python3.14/site-packages/agno/team/team.py` — `Team` class, `__init__`, `arun()` overloads
- `backend/venv/lib/python3.14/site-packages/agno/team/mode.py` — `TeamMode` enum (all four values verified)
- `backend/venv/lib/python3.14/site-packages/agno/team/_run.py` — `_arun_stream`, `asave_session` call at line 3996
- `backend/venv/lib/python3.14/site-packages/agno/team/_storage.py` + `_session.py` — session persistence helpers
- `backend/venv/lib/python3.14/site-packages/agno/team/__init__.py` — public export surface
- `backend/venv/lib/python3.14/site-packages/agno/guardrails/` — `BaseGuardrail`, `PromptInjectionGuardrail`, `CheckTrigger`
- `backend/venv/lib/python3.14/site-packages/agno/run/team.py` — `TeamRunEvent`, `TeamRunInput`, `TeamRunOutput`
- `backend/app/routers/chat.py` — existing SSE streaming pattern (model for tutor router)
- `backend/app/agents/guardrails.py` — existing guardrail singleton patterns
- `backend/app/main.py` — AgentOS wrapping, `_wrap_with_agentos()`, router registration order
- `.planning/PROJECT.md` — requirements TUTOR-01 through GUARD-03; key decisions table

### Secondary (MEDIUM confidence)

- [Agno Teams Overview — docs.agno.com](https://docs.agno.com/teams/overview) — coordination modes, HitL patterns
- [Agno investment team example — github.com/agno-agi/investment-team](https://github.com/agno-agi/investment-team) — 7-specialist coordinator pattern in practice
- [Khanmigo learner features — khanmigo.ai/learners](https://www.khanmigo.ai/learners) — activity-based tutoring, Socratic guidance, adaptive quiz UX
- [Google Multi-Agent Design Patterns — developers.googleblog.com](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) — coordinator/dispatcher, parallel fan-out patterns
- [AI SDK HitL pattern — ai-sdk.dev](https://ai-sdk.dev/cookbook/next/human-in-the-loop) — silent routing vs. confirmation gates; confirm-before-acting reserved for irreversible actions
- [Adaptive learning systems 2025 — disco.co](https://www.disco.co/blog/ai-adaptive-learning-systems-2025-alternatives) — weak-area detection, targeted practice recommendation
- [Advanced SQLite sessions — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/sessions/advanced_sqlite_session/) — server-side conversation history with SQLite

### Tertiary (conflict evidence / requires live validation)

- [Bug: Team.arun() does not register run_messages — Issue #4214](https://github.com/agno-agi/agno/issues/4214) — contradicts `_run.py` line 3996 finding; must be validated against installed 2.5.8 with a live run
- [Bug: Team routes queries to wrong agents — Issue #3422](https://github.com/agno-agi/agno/issues/3422) — coordinator over-routing; informs explicit routing prompt design
- [Bug: Team History Not Loading — Issue #4831](https://github.com/agno-agi/agno/issues/4831) — informs `store_history_messages=True` explicit setting
- [CVE-2025-64168: Agno Session State Data Leak — miggo.io](https://www.miggo.io/vulnerability-database/cve/CVE-2025-64168) — confirms per-request factory is non-negotiable
- [Q-Chat / Quizlet — quizlet.com](https://quizlet.com/blog/meet-q-chat) — in-chat MCQ UX patterns (discontinued June 2025 — prior art only)

---

*Research completed: 2026-03-15*
*Ready for roadmap: yes*
