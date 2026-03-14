# Domain Pitfalls

**Domain:** Adding Agno Team + guardrails to an existing Agno/FastAPI application (Super Tutor v7.0 — Personal Tutor milestone)
**Researched:** 2026-03-15
**Milestone:** v7.0 Personal Tutor
**Confidence:** HIGH (claims verified across Agno GitHub issues, official docs, existing codebase analysis, CVE records)

---

## Executive Context

Super Tutor v6.0 uses Agno `Workflow` composition for session generation and a stateless per-request `Agent` for the existing chat tab. v7.0 adds a Personal Tutor tab backed by an Agno `Team` — a coordinator plus specialist agents. The app already has AgentOS wrapping (`on_route_conflict=preserve_base_app`), SSE streaming via `agent.arun(stream=True)`, SQLite session storage keyed by `session_id`, and existing guardrails (`PromptInjectionGuardrail`, `validate_substantive_output` post-hook). The "burned us before" column in PROJECT.md's Key Decisions table captures prior decisions that will specifically shape how pitfalls manifest in this milestone.

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or broken streaming.

---

### Pitfall 1: Reusing the Same Agent Instance Across Team Requests — Session State Cross-Contamination

**What goes wrong:**
If a single `Agent` instance (e.g., a `chat_agent` or `notes_agent` built once at module level) is registered as a Team member and the same Team instance is also reused across requests, session state leaks between concurrent users. Under high concurrency, one user's session data (notes, conversation history, user context) can be written to a different user's session. This is documented CVE-2025-64168 (race condition in shared instance variables `_tools_for_model`, `_functions_for_model` that bind `session_state`), affecting agno 2.0.0 through 2.2.1. The app currently uses Agno `>=2.5.7`, which includes the patch — but the patch only protects against the tool-binding race. It does not protect against reusing a Team instance that accumulates internal state across runs.

**Why it happens:**
The existing workflow correctly uses a per-request `build_session_workflow()` factory (PROJECT.md Key Decisions: "Per-request Workflow factory — each request gets a fresh Workflow with its own state"). If a Team is naively constructed once at module load (like a singleton), or if member agents are built once and shared, the Team re-enters with stale state from the previous run. The Agno docs say agents are stateless when you pass `session_id` correctly — but that claim applies specifically to the stateless agent architecture after 2.0.0, and is invalidated when member agents share mutable internal buffers.

**Consequences:**
- User A sees User B's conversation history in the Tutor tab
- Coordinator sends a different user's notes as grounding context
- Non-deterministic routing failures — coordinator makes decisions based on stale internal message buffers

**Prevention:**
Apply the same per-request factory pattern that already works for `Workflow`. Build a `build_tutor_team(session_id, tutoring_type, notes, db)` factory function. Call it on every request, not once at startup. Every Team member `Agent` is constructed inside this factory. Do not share any Agent instance between the Team and the existing Workflow or chat router.

```python
def build_tutor_team(session_id: str, tutoring_type: str, notes: str, db: SqliteDb) -> Team:
    return Team(
        name="PersonalTutorTeam",
        members=[
            build_chat_agent(tutoring_type, notes, db=db),
            build_quiz_agent(tutoring_type, db=db),
            build_flashcard_agent(tutoring_type, db=db),
        ],
        ...
    )
```

**Detection:**
- Different users' notes appear in each other's Tutor responses
- Conversation history contains messages the current user did not send
- `session_id` logged for a Team run does not match the `session_id` in the request

**Phase to address:**
Team foundation phase — enforce the factory pattern before any Team integration work begins.

**Sources:**
- [CVE-2025-64168: Agno Session State Data Leak](https://www.miggo.io/vulnerability-database/cve/CVE-2025-64168)
- [Bug: Thread-unsafe session state management in agno 1.7.5 — Issue #4663](https://github.com/agno-agi/agno/issues/4663)
- [Are concurrent runs safe? — Discussion #4251](https://github.com/agno-agi/agno/discussions/4251)
- PROJECT.md Key Decisions: "Per-request Workflow factory" + "CVE-2025-64168"

---

### Pitfall 2: Team session_id Collision with Workflow session_id — AgentOS Trace Overwrite

**What goes wrong:**
The existing `Workflow` uses `session_id = <uuid>` as its SQLite primary key in `agno_sessions`. The existing chat router already namespaces to avoid this collision (`chat_session_id = f"chat:{body.session_id}"` — see `chat.py` line 60). A Team that is handed the raw `session_id` (same value used by the Workflow) will write to the same `agno_sessions` row and overwrite `session_data`, destroying the persisted `notes`, `source_content`, `tutoring_type`, `flashcards`, `quiz`, and `title` that the Workflow wrote. The GET /sessions/{id} endpoint reads this same row. After one Team run, that endpoint returns a mangled response.

**Why it happens:**
`session_id` is a user-facing identifier passed in from the frontend. The natural temptation is to pass it directly to the Team so traces group under the same session in AgentOS. But the `agno_sessions` table uses `session_id` as a PK — two writers to the same key produce last-write-wins data corruption.

**Consequences:**
- `GET /sessions/{id}` returns notes = `""` or notes contaminated with Tutor conversation data
- Existing study page tabs (Notes, Flashcards, Quiz) break immediately after first Tutor interaction
- Session data is permanently lost — cannot be recovered without re-running the Workflow

**Prevention:**
Use a namespaced Team session ID the same way the chat router does it. A consistent scheme:
- Workflow:  `session_id` (unchanged — existing rows)
- Chat tab:  `chat:{session_id}` (existing pattern)
- Tutor tab: `tutor:{session_id}` (new — mirrors chat pattern)

Pass `session_id=f"tutor:{body.session_id}"` when calling `team.run()` or `team.arun()`. Also pass `user_id` consistently so AgentOS can group traces by user without relying on the session_id.

**Detection:**
- `GET /sessions/{id}` returns empty notes after the Tutor tab is opened
- AgentOS trace explorer shows Workflow and Team entries merged under the same session row
- `session_state` keys like `"tutor_history"` appear where `"notes"` should be

**Phase to address:**
Team foundation phase — set the namespaced session_id scheme before any Team run is attempted.

**Sources:**
- `chat.py` lines 58–64 (existing namespace pattern — directly applicable)
- PROJECT.md Key Decisions: "Lazy singleton pattern for SqliteDb in routers" + "Separate SqliteDb for sessions vs traces"

---

### Pitfall 3: Team.arun() Does Not Persist run_messages — Conversation History Lost

**What goes wrong:**
`Team.arun()` has a documented bug (Issue #4214, reported August 2025) where `run_messages` remains `None` after the async call completes, unlike the synchronous `Team.run()` which populates it correctly. In practice this means the Team's internal run log is not captured by the async path. Whether this affects SQLite session history persistence (the `agno_sessions` row for conversation history) depends on agno version, but the bug points to an established pattern: the async path in Agno Teams is less battle-tested than the sync path.

The app's existing Workflow already hit this exact category of bug: `arun()` did not persist `session_state` because the async path bypasses `save_session()` finally block (Agno GitHub #3819). The fix was `asyncio.to_thread(workflow.run, ...)` — the sync path was the only reliable one (PROJECT.md Key Decisions). That same risk applies to `Team`.

**Why it happens:**
Agno's async implementation for Team lags behind the sync implementation. The `finally` block that calls `save_session()` in the sync path is not guaranteed to execute correctly in the async path, particularly when exceptions occur inside an async generator or when the task is cancelled.

**Consequences:**
- Conversation history is not written to SQLite after each Tutor turn
- Next turn starts with no memory of previous turns, even though `add_history_to_context=True` is set
- Multi-turn sessions appear to reset after every message
- AgentOS Control Plane shows no messages for Team runs

**Prevention:**
Wrap Team execution in `asyncio.to_thread(team.run, ...)` exactly as the Workflow does. Do NOT use `team.arun()` for the primary conversation path until Agno confirms the async persistence path is stable. Verify by inspecting `agno_sessions` in SQLite after each Team turn — the row's `session_data` must include the conversation history, not just the initial state.

If `asyncio.to_thread(team.run, ...)` is chosen and streaming is also needed (Pitfall 4 below), streaming must be handled separately — sync `run()` does not yield tokens incrementally.

**Detection:**
- Second Tutor turn has no knowledge of the first
- `agno_sessions` row for `tutor:{session_id}` shows empty or stale `session_data` after the first run
- `team.run_messages` is `None` after `team.arun()` completes

**Phase to address:**
Team foundation phase — validate session persistence before building any Tutor feature on top of Team.

**Sources:**
- [Bug: Team.arun() does not register run_messages — Issue #4214](https://github.com/agno-agi/agno/issues/4214)
- [Bug: Team session state storage error — Issue #3884](https://github.com/agno-agi/agno/issues/3884)
- PROJECT.md Key Decisions: "asyncio.to_thread(workflow.run, ...) instead of arun() — agno GitHub #3819"

---

### Pitfall 4: Streaming from Team Coordinator Breaks if asyncio.to_thread Is Used

**What goes wrong:**
The existing chat router streams tokens to the frontend via `agent.arun(stream=True)` — a native async generator that yields `RunContent` chunks. This pattern works because `arun(stream=True)` is an async generator that must run in the event loop thread. If `asyncio.to_thread(team.run, ...)` is used to address Pitfall 3 (sync path for persistence), streaming is broken: `team.run()` in a thread pool returns a final response, not an async generator of chunks. The two requirements — reliable session persistence AND incremental streaming — are in direct tension.

**Why it happens:**
`asyncio.to_thread()` moves a blocking call to a thread pool and returns a coroutine that yields only when the call completes. It cannot interleave with an async generator. `arun(stream=True)` must run in the event loop and cannot be wrapped in `to_thread`. This tension is the same reason the chat router uses `agent.arun(stream=True)` directly while the Workflow uses `asyncio.to_thread(workflow.run, ...)` for session generation — they serve different communication patterns.

**Consequences:**
- If `asyncio.to_thread(team.run, ...)`: Tutor tab shows no streaming — the user waits for the full response, then it appears all at once (poor UX for multi-sentence tutor responses)
- If `team.arun(stream=True)`: Streaming works but history persistence may be broken (Pitfall 3)
- If both are attempted: Cannot wrap an async generator in `to_thread`; Python raises `TypeError` at runtime

**Prevention:**
Choose one of two explicitly-tested approaches:

Option A (preferred if history works in current agno version): Use `team.arun(stream=True)` directly — mirrors the chat router pattern exactly. Verify SQLite history persistence after each call. If `arun()` persistence is fixed in the installed agno version (>=2.5.7), this works as-is.

Option B (fallback if history is broken with arun): Run `team.run()` in `asyncio.to_thread()` for persistence. Stream a simulated progressive reveal on the frontend (yield chunks from the complete response split by words). This degrades streaming UX but guarantees history persistence.

Write a targeted test: call the Team once, verify `agno_sessions` has the history row, call it again, verify the second call sees the first turn's history. This test must pass before any UI work begins.

**Detection:**
- Tutor response appears all at once after a long pause (to_thread with sync run)
- `TypeError` at runtime attempting to pass an async generator to `asyncio.to_thread`
- SSE stream emits no `token` events, only a final `done` event with the full response

**Phase to address:**
Team streaming phase — must be resolved before the Tutor tab renders any response.

**Sources:**
- `chat.py` lines 75–108 (existing streaming pattern — comparison baseline)
- PROJECT.md Key Decisions: "asyncio.to_thread(workflow.run, ...) instead of arun()"
- [Bug: Team.arun() does not register run_messages — Issue #4214](https://github.com/agno-agi/agno/issues/4214)

---

### Pitfall 5: AgentOS Route Conflicts When Adding Team Endpoints

**What goes wrong:**
The existing app fixed route conflicts by setting `on_route_conflict=preserve_base_app` (PROJECT.md Key Decisions: "AgentOS on_route_conflict=preserve_base_app"). The Personal Tutor adds a new SSE endpoint — likely `POST /tutor/stream` or similar. If the AgentOS wrapping also registers a route at the same path (e.g., if AgentOS mounts a default `/teams/{team_id}/run` endpoint that overlaps with a custom `/tutor/stream` route), the `preserve_base_app` setting should protect the custom route. However, if the new tutor router is mounted after AgentOS wraps the app, the route registration order may change — FastAPI route lookup is order-dependent, and routes registered after AgentOS wraps the app are outside the base app that `preserve_base_app` covers.

**Why it happens:**
The `on_route_conflict=preserve_base_app` decision preserves routes that exist in the FastAPI app at the time AgentOS wraps it. Routes added to new routers that are included in `main.py` must be included before `wrap_app_with_agent_os()` is called. The existing code works because all existing routers are included before wrapping. Adding a new `tutor` router after the wrapping call would bypass the protection.

**Consequences:**
- `POST /tutor/stream` returns AgentOS's generic team endpoint response instead of the app's custom SSE handler
- SSE streaming breaks — AgentOS does not produce `sse-starlette` EventSourceResponse format
- Alternatively, the route simply does not exist (404) if AgentOS's router shadows it

**Prevention:**
Include the new `tutor` router in `main.py` in the same block as `chat`, `sessions`, and `upload` routers — before the AgentOS wrapping call. Confirm the route appears in the OpenAPI schema at `/docs` before any frontend work begins.

**Detection:**
- `POST /tutor/stream` returns a JSON body instead of an SSE stream
- FastAPI's `/docs` shows the endpoint with an unexpected schema (AgentOS generic schema instead of app-defined schema)
- Existing SSE routes (`/chat/stream`) still work but `/tutor/stream` does not

**Phase to address:**
Team router setup phase — include the tutor router before wrapping, verified at startup.

**Sources:**
- PROJECT.md Key Decisions: "AgentOS on_route_conflict=preserve_base_app — application routes take precedence; SSE flow unbroken"
- [Overriding Routes — Agno docs](https://docs.agno.com/agent-os/custom-fastapi/override-routes)

---

## Moderate Pitfalls

Mistakes that cause incorrect behavior that is visible but recoverable without a full rewrite.

---

### Pitfall 6: Coordinator Over-Routing — All Messages Go to the Wrong Specialist

**What goes wrong:**
The coordinator sends every user message to the same specialist regardless of intent — typically defaulting to whichever agent appears first in the `members` list or whichever has the most general-sounding description. This manifests as the quiz specialist answering "explain this concept" questions, or the notes specialist generating flashcards instead of delegating to the flashcard specialist. There is a filed bug (Issue #3422, May 2025) where the team leader "routes to the correct agent but the response is incorrect" and separately "routes to the wrong agent" — both in the same session.

**Why it happens:**
The coordinator's routing decision is driven by its system prompt and the `description` field on each member `Agent`. Vague descriptions cause the coordinator to guess — and it guesses consistently wrong. Additionally, the coordinator may answer questions from its own accumulated context ("responds to a previously asked question despite memory being disabled" — from Issue #3422), meaning it routes correctly but delivers stale content.

**Prevention:**
Write explicit, declarative routing rules in the coordinator's instructions. Name each specialist by their exact `Agent.name` and describe what question types they handle. Keep descriptions non-overlapping and action-verb-led:

- "Route to `QuizSpecialist` when the user asks to be tested, quizzed, or assessed."
- "Route to `ExplainSpecialist` when the user asks what, why, how, or to explain a concept."
- "Answer greetings and session-level questions (What's this about? How does this work?) yourself without delegating."

Set `show_members_responses=False` on the coordinator initially, which forces the coordinator to synthesize the response and eliminates duplicate output from members.

Test routing explicitly: send 10 representative Tutor messages, log which specialist the coordinator selected, assert the selection matches intent.

**Detection:**
- Every Tutor message triggers the same specialist regardless of question type
- The coordinator's own response contains flashcard JSON when the user asked a conversational question
- Agno trace explorer shows the coordinator calling the same tool/member for all inputs

**Phase to address:**
Team coordinator prompt engineering phase — cannot be deferred past the first end-to-end test.

**Sources:**
- [Bug: Team routes queries to wrong agents and responses are frequently incorrect — Issue #3422](https://github.com/agno-agi/agno/issues/3422)
- [Response Time and Coordinator Routing Timing — Agno Community](https://community.agno.com/t/response-time-and-coordinator-routing-timing-in-agno/1984)

---

### Pitfall 7: Guardrail False Positives Kill Legitimate Tutor Messages

**What goes wrong:**
The existing `PromptInjectionGuardrail` checks for patterns like `"ignore previous instructions"`, `"you are now a"`, `"developer mode"`, `"jailbreak"`. The Personal Tutor context introduces educational phrasing that can trigger these patterns accidentally. Examples: "Pretend you're teaching me..." (matches `"you are now a"` family), "Forget what I said about X, let me rephrase" (matches `"ignore previous instructions"` family), "Override the wrong answer and give the right one" (matches `"admin override"`). A false positive raises `InputCheckError` in the coordinator, which bubbles up as a guardrail rejection to the user — an experience-breaking error for a legitimate study question.

**Why it happens:**
The default `PromptInjectionGuardrail` is pattern-matched (regex/keyword). Educational language shares surface-level syntax with injection attempts. With 5+ guardrails across input and output, cumulative false positive rate is compounded — research shows that applying 5 independent 90%-accurate guards produces a 40% false positive rate overall.

In the current app, the guardrail is used on `research_step` (for URL/topic submission) and `notes_step` input — low-risk locations where educational phrasing rarely appears. The Tutor tab is a conversational interface, where diverse student phrasing arrives every turn.

**Prevention:**
Three-layer strategy:
1. Apply the `PromptInjectionGuardrail` only to the coordinator-level input, not to each specialist agent redundantly. Cascading guards multiply false positives.
2. Create a topic-relevance guardrail (LLM-as-judge pattern) that checks whether the message is on-topic for the session material rather than using pattern matching. This reduces false positives on legitimate educational phrasing while still catching actual off-topic abuse.
3. When `InputCheckError` fires, log the trigger and the message for manual review. Do not silently swallow — surface a user-friendly message ("I can only help with topics from this study session") rather than a generic error.

**Detection:**
- Student phrases like "forget my previous question" or "pretend to explain" cause Tutor errors
- `InputCheckError` log entries contain messages that are clearly legitimate educational questions
- Tutor error rate exceeds ~2% of messages during integration testing

**Phase to address:**
Guardrail calibration phase — must be tested with a set of realistic Tutor messages before the Tutor tab is released.

**Sources:**
- [Guardrails — Agno docs](https://docs.agno.com/concepts/teams/guardrails)
- [What are AI Guardrails? Hands On Implementation With Agno](https://thepipeandtheline.substack.com/p/what-are-ai-guardrails-hands-on-implementation)
- `guardrails.py` (existing app — `PROMPT_INJECTION_GUARDRAIL` is a singleton shared across all agents)
- Research finding: applying 5 guards at 90% accuracy each gives ~40% cumulative false positive rate

---

### Pitfall 8: Output Guardrail Triggers on Valid Specialist Responses

**What goes wrong:**
The existing `validate_substantive_output` post-hook raises `OutputCheckError` when agent output is fewer than 20 characters. In the Team context, a specialist agent's intermediate response to the coordinator (not the final user-facing response) may legitimately be short — e.g., a coordinator asking "Did you generate the quiz?" receiving "Yes, here are the questions: [JSON array]" where only the affirmation prefix is checked, or a member that returns structured JSON where the initial content check sees only the opening bracket `[`. The 20-char threshold was calibrated for final prose responses, not for inter-agent coordinator messages.

**Why it happens:**
In a Team, member agents communicate with the coordinator via intermediate messages. The coordinator may receive structured data (JSON arrays of flashcards, quiz questions) as intermediate payloads. Depending on how agno slices the `RunOutput.content` for the `validate_substantive_output` check — whether it checks the first chunk or the full response — the hook may fire prematurely on valid structured output.

**Prevention:**
When building Team member agents, evaluate whether to attach the `validate_substantive_output` post-hook. For agents that return structured JSON (quiz, flashcard specialists), do not attach this hook — they will never return prose of 20+ characters as their payload. Only attach it to conversational specialists (explain, chat). Or raise the threshold for Team member agents to 5 characters (just enough to reject empty output).

**Detection:**
- Quiz or flashcard generation inside Tutor fails with "Agent output is too short or empty"
- Logs show `OutputCheckError` for members that produce valid JSON arrays
- Integration test: ask Tutor to "make me a quiz on section 2" and observe whether the quiz specialist's output is blocked

**Phase to address:**
Team member configuration phase — review hook assignments per-agent when building the Team factory.

**Sources:**
- `guardrails.py` lines 29–47 (existing `validate_substantive_output` threshold = 20 chars)
- `chat_agent.py` line 25–26 (existing hook assignment pattern)

---

### Pitfall 9: Conversation History Cross-Contamination Across Tutor Sessions for the Same User

**What goes wrong:**
If `user_id` is not set on the Team (or is set identically across all anonymous users), the Team's `add_history_to_context=True` may load conversation history from a previous session for a different topic. The Tutor tab is session-scoped — a student studying "World War II" should not see questions from their previous session on "Photosynthesis" appear in the Team's context window. Agno groups history by `(user_id, session_id)` — if `user_id` is absent or constant, rows may bleed across sessions.

Additionally, the `store_history_messages` default changed in a recent agno version to `False` — if the app relies on the previous default of `True`, the Team may silently stop persisting history without any error.

**Why it happens:**
The app is intentionally anonymous — no user accounts. There is no stable `user_id` per user. The existing chat router does not pass `user_id` at all; agno uses `session_id` alone for isolation. In a Team, if `add_history_to_context=True` is set without an explicit `session_id` scoped to the specific study session, the Team loads all history for whatever key it uses.

For multi-session anonymous users who reuse a browser without clearing state, `tutor:{session_id}` naturally scopes to the session, preventing bleed — but only if the session_id is guaranteed unique per session (UUID, which it already is in this app).

**Prevention:**
- Set `session_id=f"tutor:{body.session_id}"` on every Team run call (Pitfall 2 already establishes this).
- Explicitly set `store_history_messages=True` on the Team to avoid relying on default behavior that changed between agno versions.
- Explicitly set `num_history_runs` to a bounded value (e.g., 10) to prevent the context window from filling with multi-turn history on long Tutor sessions — the same cap logic used by the chat agent.
- Do not set `add_team_history_to_members=True` unless specifically needed: this flag makes every member agent see the full team conversation, which inflates context costs and risks injecting irrelevant turns into specialist prompts.

**Detection:**
- Tutor responses reference content from a different session ("But earlier you mentioned...") when the user is on session B, not session A
- `add_history_to_context=True` produces no historical context even after multiple turns (signals `store_history_messages=False`)
- Context window errors after 20+ turns (signals no `num_history_runs` cap)

**Phase to address:**
Team history configuration phase — set and verify all history parameters before any multi-turn integration tests.

**Sources:**
- [Bug: Team History Not Loading in New Team Instances Despite Database Configuration — Issue #4831](https://github.com/agno-agi/agno/issues/4831)
- [Chat history problem in multi-agent mode (team) — Agno Community](https://community.agno.com/t/chat-history-problem-in-multi-agent-mode-team/569)
- [Memory Context Loss in Asynchronous Team Execution — Agno Community](https://community.agno.com/t/memory-context-loss-in-asynchronous-team-execution/1204)
- [Feature Request: Team/Agent session_state persistence for consecutive runs — Issue #3895](https://github.com/agno-agi/agno/issues/3895)

---

### Pitfall 10: initial session_state Values in Code Overwrite Saved DB State

**What goes wrong:**
When building the Team or its member agents with a hardcoded `session_state={...}` dict in the constructor (e.g., to pass the session notes), agno merges this code-defined state with the DB-persisted state on each run. The merge direction is: code-defined values win over DB values. On the second turn of a conversation, the Team loads the persisted history from DB — but if `session_state={"notes": notes}` is also passed in the constructor, the persisted conversation-level state from the previous turn is overwritten by the initial default. This is Issue #3895 ("initial values set in code always overwrite states saved on the database").

**Why it happens:**
The `build_session_workflow()` factory uses `additional_data` (not `session_state`) to pass contextual data into steps — this is the safe pattern because `additional_data` is not persisted and does not collide with the DB-persisted `session_state`. If a Team is naively built with `session_state={"notes": notes}` in the `Team(...)` constructor, this same collision occurs on every subsequent run.

**Prevention:**
Do not pass `notes` or grounding context via `session_state` in the `Team(...)` constructor. Instead, embed the notes in the coordinator's system prompt instructions (the same pattern used in `build_chat_agent()`). The notes string is rendered once into the prompt template; it does not participate in `session_state` persistence. The Team's `session_state` should only hold data that genuinely needs to persist turn-to-turn (e.g., quiz scores, focus areas).

**Detection:**
- Second Tutor turn loses state written in the first turn (e.g., a "focus area" the advisor set in turn 1 is absent in turn 2)
- Logging `team.session_state` at the start of run 2 shows only the initial constructor values, not values written in run 1
- `agno_sessions` row for `tutor:{session_id}` shows the same initial state on every turn

**Phase to address:**
Team state design phase — design the `session_state` schema before first Team run.

**Sources:**
- [Feature Request: Team/Agent session_state/team_session_state persistence for consecutive runs — Issue #3895](https://github.com/agno-agi/agno/issues/3895)
- [Bug: Stale session_state in Prompts — Issue #3916](https://github.com/agno-agi/agno/issues/3916)
- `session_workflow.py` lines 188–274 (existing safe pattern: `additional_data` for context, `session_state` for persistence-worthy data only)

---

## Minor Pitfalls

---

### Pitfall 11: Member Agent session_id Is Silently Set to Team's session_id

**What goes wrong:**
As of agno 1.6.x, when an `Agent` is a Team member, its `session_id` is overridden to match the Team's `session_id`. If the member agent was previously used standalone (e.g., the `chat_agent` in the existing `/chat/stream` endpoint) with its own namespaced session_id, adding it to a Team may alter that standalone agent's session_id. In practice, because the app uses per-request factories (Pitfall 1 prevention), this is not a risk for the standalone chat agent — it is a different instance. But if code attempts to configure a member agent's `session_id` explicitly, the configuration is silently ignored.

**Prevention:**
Do not set `session_id` on individual member `Agent` instances when constructing the Team. Let the Team own the session_id entirely. Pass `session_id=f"tutor:{body.session_id}"` to the `team.run()` or `team.arun()` call, not to member constructors.

**Detection:**
- Member agent's `agent.session_id` attribute equals the Team's session_id after a team run, even when set differently in the constructor
- AgentOS traces for member agents appear under the same session row as the coordinator

**Phase to address:**
Team construction phase — understood as a design constraint, not a bug to fix.

**Sources:**
- [Inquiry about a Bug: Agent's Session ID Showing as Team's Session ID — Agno Community](https://community.agno.com/t/inquiry-about-a-bug-agents-session-id-showing-as-teams-session-id/1536)

---

### Pitfall 12: Coordinator Adds Unnecessary Preamble to Specialist Responses

**What goes wrong:**
In agno 1.5.1+, when a member agent responds to the coordinator, it returns a concatenated string combining tool outputs and the final answer. The coordinator may then re-wrap this in its own preamble ("Here is what our specialist found: ..."). The user sees a doubled response — the specialist's answer plus the coordinator's commentary — making Tutor responses verbose and repetitive. Issue #3376 documents this exact regression (agno 1.5.0 → 1.5.1).

**Prevention:**
Set `show_members_responses=False` on the Team coordinator. This suppresses intermediate member outputs from the final stream and makes the coordinator synthesize a clean, single response. Only enable `show_members_responses=True` for debugging.

**Detection:**
- Tutor responses repeat the same information twice with slightly different phrasing
- The response contains phrases like "According to our specialist..." followed by the specialist's verbatim output
- Response latency doubles but content does not increase

**Phase to address:**
Team coordinator configuration phase.

**Sources:**
- [Bug: Agent response to Team contains too much information — Issue #3376](https://github.com/agno-agi/agno/issues/3376)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Team factory creation | Agent instance reuse + session_state collision | Per-request factory; namespaced session_id (`tutor:{session_id}`) |
| Team router wiring | AgentOS route conflict | Include tutor router before `wrap_app_with_agent_os()` in `main.py` |
| Team persistence validation | `arun()` not persisting run_messages | Test SQLite row after first Team run before any UI work |
| Streaming implementation | Sync vs async path tension | Choose one approach (arun streaming OR to_thread sync) and test both UX and persistence |
| Coordinator prompt writing | Over-routing to wrong specialist | Explicit declarative routing rules per specialist by name; test 10 representative messages |
| Guardrail application | False positives on educational phrasing | LLM-as-judge topic guardrail; no cascade of pattern guards on every specialist |
| Member agent configuration | Output guardrail blocking JSON responses | Do not attach `validate_substantive_output` to structured-output specialists |
| Tutor history setup | Cross-session bleed; context overflow | `store_history_messages=True`; `num_history_runs` cap; `session_id` is UUID-scoped |
| Team state schema design | Code-defined `session_state` overwrites DB state | Embed notes in system prompt; use `session_state` only for turn-persistent data |
| Multi-turn Tutor testing | History not loading in new Team instances | Verify `agno_sessions` row after each turn; test full 5-turn conversation before release |

---

## Integration Gotchas

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| Existing `chat_agent.py` + new Team | Passing the `chat_agent` instance directly as a Team member | Build a separate agent instance in `build_tutor_team()` factory — never share instances |
| `session_id` from frontend | Using raw UUID as Team's session_id | `f"tutor:{session_id}"` — same namespacing pattern as `chat.py` line 60 |
| `PromptInjectionGuardrail` singleton | Attaching it to every Team member | Attach only to coordinator input; singleton is stateless and safe to reuse but cascading is harmful |
| `validate_substantive_output` hook | Attaching to JSON-returning specialists | Only attach to conversational/prose-output agents; quiz and flashcard agents return JSON |
| `main.py` router include order | Including tutor router after `wrap_app_with_agent_os()` | Include all routers before the AgentOS wrapping call |
| `Team(session_state={...})` constructor | Passing notes dict to seed session_state | Embed notes in system prompt instructions; reserve `session_state` for turn-persistent data |
| `team.arun()` vs `asyncio.to_thread(team.run, ...)` | Assuming both are equivalent | They are not — async path has known persistence issues; verify with SQLite inspection |
| `add_team_history_to_members` | Enabling it to "share context" | Default to off; it inflates each specialist's context with unrelated turns |
| AgentOS trace grouping | Expecting Team traces to appear under Workflow session in Control Plane | They appear under `tutor:{session_id}` row — separate from the Workflow's row (intended) |

---

## "Looks Done But Isn't" Checklist

- [ ] **Session isolation**: Two concurrent users open the Tutor tab — each sees only their own content. No cross-user history in responses.
- [ ] **Session_id namespace**: `agno_sessions` table has separate rows for `<uuid>` (Workflow), `chat:<uuid>` (chat tab), and `tutor:<uuid>` (Tutor tab). No overwriting between rows.
- [ ] **History persistence**: Send three Tutor messages. On the fourth message, verify the Team's context includes all three previous turns (check `agno_sessions` directly).
- [ ] **Streaming works**: The Tutor tab shows tokens appearing progressively, not the full response appearing at once.
- [ ] **Routing accuracy**: Send "explain X", "quiz me on X", and "make me flashcards for X" — each routes to a different specialist. Confirm via trace logs.
- [ ] **Guardrail false positive rate**: Run 20 representative Tutor questions (including phrasing like "forget what I said" and "pretend you're a student") — none should trigger `InputCheckError`.
- [ ] **Output guardrail does not block specialists**: Ask Tutor to generate a quiz — the quiz specialist's JSON array reaches the coordinator without triggering `OutputCheckError`.
- [ ] **AgentOS route**: `POST /tutor/stream` appears in `/docs` with the correct schema. Opening it returns an SSE stream, not a JSON body.
- [ ] **Existing endpoints unbroken**: `POST /chat/stream`, `GET /sessions/{id}`, `POST /sessions`, `POST /sessions/upload` all return correct responses after tutor router is added.
- [ ] **`store_history_messages=True`**: Confirm explicitly set on Team — do not rely on framework defaults across versions.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agent instance shared across requests (data leak found) | HIGH | Introduce per-request factory immediately; revoke any sessions that may have been contaminated |
| session_id collision overwrites Workflow row | HIGH | Restore session data from last-known-good backup of SQLite traces.db; implement `tutor:` namespace |
| Team.arun() history not persisting | MEDIUM | Switch to `asyncio.to_thread(team.run, ...)`; implement simulated streaming on frontend |
| Streaming broken (TypeError from to_thread + async generator) | LOW | Separate concerns: use `to_thread` for a non-streaming save-and-reply mode, or use `arun(stream=True)` for streaming without `to_thread` |
| Coordinator over-routing (found in testing) | LOW | Rewrite coordinator instructions with explicit per-specialist routing rules; no code change needed |
| Guardrail false positives in production | MEDIUM | Deploy updated guardrail with LLM-as-judge topic check; pattern-match guardrail remains for prompt injection but is not sole gate |
| Output guardrail blocking specialist JSON | LOW | Remove hook from specialist agent builders; re-run integration tests |
| AgentOS route conflict (POST /tutor/stream returns wrong response) | LOW | Reorder router include in `main.py` to before AgentOS wrapping |

---

## Sources

- [CVE-2025-64168: Agno Session State Data Leak — miggo.io](https://www.miggo.io/vulnerability-database/cve/CVE-2025-64168)
- [CVE-2025-64168: Agno session state overwrites — GitLab Advisory Database](https://advisories.gitlab.com/pkg/pypi/agno/CVE-2025-64168/)
- [Bug: Thread-unsafe session state management in agno 1.7.5 — Issue #4663](https://github.com/agno-agi/agno/issues/4663)
- [Are concurrent runs safe? — Discussion #4251](https://github.com/agno-agi/agno/discussions/4251)
- [Bug: Team.arun() does not register run_messages — Issue #4214](https://github.com/agno-agi/agno/issues/4214)
- [Bug: Incorrect message conversion in Team AG-UI — Issue #4204](https://github.com/agno-agi/agno/issues/4204)
- [Bug: Team routes queries to wrong agents and responses are frequently incorrect — Issue #3422](https://github.com/agno-agi/agno/issues/3422)
- [Bug: Agno 1.6.0 Critical regressions in team routing — Issue #3534](https://github.com/agno-agi/agno/issues/3534)
- [Bug: Agent response to Team contains too much information — Issue #3376](https://github.com/agno-agi/agno/issues/3376)
- [Bug: Team session state storage error — Issue #3884](https://github.com/agno-agi/agno/issues/3884)
- [Bug: Stale session_state in Prompts — Issue #3916](https://github.com/agno-agi/agno/issues/3916)
- [Feature Request: Team/Agent session_state persistence for consecutive runs — Issue #3895](https://github.com/agno-agi/agno/issues/3895)
- [Bug: Team History Not Loading in New Team Instances — Issue #4831](https://github.com/agno-agi/agno/issues/4831)
- [Inquiry about a Bug: Agent's Session ID Showing as Team's Session ID — Agno Community](https://community.agno.com/t/inquiry-about-a-bug-agents-session-id-showing-as-teams-session-id/1536)
- [Memory Context Loss in Asynchronous Team Execution — Agno Community](https://community.agno.com/t/memory-context-loss-in-asynchronous-team-execution/1204)
- [Response Time and Coordinator Routing Timing — Agno Community](https://community.agno.com/t/response-time-and-coordinator-routing-timing-in-agno/1984)
- [Guardrails — Agno docs](https://docs.agno.com/concepts/teams/guardrails)
- [Guardrails for AI Agents — Agno blog](https://www.agno.com/blog/guardrails-for-ai-agents)
- [What are AI Guardrails? Hands On Implementation With Agno](https://thepipeandtheline.substack.com/p/what-are-ai-guardrails-hands-on-implementation)
- [Overriding Routes — Agno docs](https://docs.agno.com/agent-os/custom-fastapi/override-routes)
- [Team Session State — Agno docs](https://docs.agno.com/basics/state/team/overview)
- [Sessions — Agno docs](https://docs.agno.com/basics/sessions/overview)
- Internal codebase: `backend/app/agents/guardrails.py`, `backend/app/agents/chat_agent.py`, `backend/app/routers/chat.py`, `backend/app/workflows/session_workflow.py`, `.planning/PROJECT.md` (v7.0, 2026-03-15)

---

*Pitfalls research for: Super Tutor v7.0 — Personal Tutor (Agno Team + guardrails)*
*Researched: 2026-03-15*
