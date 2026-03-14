# Technology Stack

**Project:** Super Tutor — v7.0 Personal Tutor milestone
**Researched:** 2026-03-15
**Agno version verified against:** 2.5.8 (installed in `backend/venv/lib/python3.14/site-packages/agno/`)
**Source authority:** Direct inspection of installed package source — not training data

---

## Summary: What Changes for v7.0

No new pip packages are needed. Every API surface required for the Personal Tutor feature
already exists in agno 2.5.8, and the existing `SqliteDb` + `traces_db` pattern covers
persistent team conversation storage without any new infrastructure.

The additions are purely within the existing agno package:

1. `agno.team.Team` — already in the installed package, not yet used by the app
2. `agno.team.TeamMode` — enum controlling coordinator/route/broadcast behavior
3. `agno.run.team.TeamRunEvent`, `TeamRunOutput`, `TeamRunOutputEvent` — for stream filtering

No pip installs. No new SQLite files. No schema changes.

---

## Verified APIs (agno 2.5.8)

### 1. Agno Teams

**Import path (verified from `agno/team/__init__.py`):**
```python
from agno.team import Team, TeamMode
from agno.run.team import TeamRunEvent, TeamRunOutput, TeamRunOutputEvent
```

**`Team.__init__` — verified key parameters (from `agno/team/team.py`):**

| Parameter | Type | Purpose |
|-----------|------|---------|
| `members` | `List[Agent \| Team]` | Member agents — required, positional first arg |
| `model` | `Model \| str \| None` | Coordinator's LLM (required for `coordinate`/`route` modes) |
| `name` | `str \| None` | Team name for traces |
| `mode` | `TeamMode \| None` | Execution mode (see TeamMode table below) |
| `instructions` | `str \| List[str] \| None` | Coordinator system instructions |
| `description` | `str \| None` | Description injected into system message |
| `db` | `BaseDb \| AsyncBaseDb \| None` | Persistent storage — pass `traces_db` directly |
| `session_id` | `str \| None` | Default session; overridden per-call in `arun()` |
| `add_history_to_context` | `bool` | Re-inject past runs from DB into each run |
| `num_history_runs` | `int \| None` | How many past runs to include |
| `pre_hooks` | `List[Callable \| BaseGuardrail \| BaseEval] \| None` | Input guardrails |
| `post_hooks` | `List[Callable \| BaseGuardrail \| BaseEval] \| None` | Output guardrails |
| `share_member_interactions` | `bool` | Pass member responses to subsequent members |
| `respond_directly` | `bool` | Skip coordinator synthesis — return member output directly |
| `determine_input_for_members` | `bool` | Coordinator crafts per-member prompts (default `True`) |
| `enable_session_summaries` | `bool` | Auto-generate session summaries (default `False`) |

**`TeamMode` enum values (verified from `agno/team/mode.py`):**

| Mode | Value | Behavior |
|------|-------|---------|
| `TeamMode.coordinate` | `"coordinate"` | Coordinator picks members, crafts task inputs, synthesizes final response. Default supervisor pattern. |
| `TeamMode.route` | `"route"` | Coordinator picks ONE member and returns that member's response directly — no synthesis pass. |
| `TeamMode.broadcast` | `"broadcast"` | Coordinator delegates the same task to ALL members simultaneously. |
| `TeamMode.tasks` | `"tasks"` | Autonomous loop: coordinator decomposes goal into tasks, assigns to members, loops until done or `max_iterations`. |

**Recommendation: use `TeamMode.route`** for the Personal Tutor. The coordinator reads
the user message, picks the best specialist (chat, quiz, flashcard, advisor), and returns
that specialist's response directly. No synthesis overhead. The user gets the specialist
response verbatim, which is correct for a tutoring use case.

**`Team.arun()` — verified signature (from `agno/team/team.py`):**

```python
# Non-streaming (returns coroutine resolving to TeamRunOutput):
result: TeamRunOutput = await team.arun(
    input="student message",
    stream=False,
    session_id="tutor:<session_id>",
)

# Streaming (returns AsyncIterator):
async for chunk in team.arun(
    input="student message",
    stream=True,
    stream_events=False,  # set True to also receive tool-call/lifecycle events
    session_id="tutor:<session_id>",
):
    # chunk is TeamRunOutputEvent or RunOutputEvent
    if chunk.event == TeamRunEvent.run_content:  # value: "TeamRunContent"
        yield chunk.content
```

**`TeamRunEvent` stream event values (verified from `agno/run/team.py`):**

| Event | String value | When emitted |
|-------|-------------|--------------|
| `TeamRunEvent.run_started` | `"TeamRunStarted"` | Run begins |
| `TeamRunEvent.run_content` | `"TeamRunContent"` | Content tokens |
| `TeamRunEvent.run_completed` | `"TeamRunCompleted"` | Run finishes |
| `TeamRunEvent.run_error` | `"TeamRunError"` | Run fails |

For the SSE endpoint, filter on `chunk.event == TeamRunEvent.run_content` (or its string
value `"TeamRunContent"`) to emit only content tokens. Mirror the existing pattern in
`chat.py` line 84: `if chunk.event == "RunContent" and chunk.content`.

**Critical: session_id namespacing.** The `traces_db` SQLite table (`agno_sessions`)
uses `session_id` as a primary key shared across all component types (workflow, agent,
team). The tutor team session_id must be namespaced to avoid colliding with the workflow
row for the same study session:

```python
tutor_session_id = f"tutor:{body.session_id}"
```

This is the exact same pattern already applied for the chat agent in `routers/chat.py`
line 63: `f"chat:{body.session_id}"`.

**Coordinator `Agent.role` on member agents:** Each member agent should have a `role`
string set so the coordinator can route correctly. In route mode, the coordinator selects
a member by matching its role description against the user request. Set `role=` in the
member agent kwargs or in a thin wrapper passed to `Team(members=[...])`.

---

### 2. Agno Guardrails

**Import paths (verified from `agno/guardrails/__init__.py`):**
```python
from agno.guardrails import BaseGuardrail, PromptInjectionGuardrail
from agno.exceptions import CheckTrigger, InputCheckError, OutputCheckError
from agno.run.agent import RunOutput        # type for post-hook callable signatures
from agno.run.team import TeamRunInput      # type for BaseGuardrail.check() input arg
```

**Guardrails already in the app (`app/agents/guardrails.py`):**

| Guardrail | Type | How it works |
|-----------|------|-------------|
| `PROMPT_INJECTION_GUARDRAIL` | `PromptInjectionGuardrail` (pre-hook) | Keyword scanner; raises `InputCheckError` with `CheckTrigger.PROMPT_INJECTION` |
| `validate_substantive_output` | callable post-hook | Rejects outputs shorter than 20 chars; raises `OutputCheckError` |

Both can be passed directly to `Team(pre_hooks=..., post_hooks=...)` without modification.
`Team` accepts the same `pre_hooks`/`post_hooks` interface as `Agent` (verified from
`agno/team/team.py` lines 255–257).

**`BaseGuardrail` interface (verified from `agno/guardrails/base.py`):**
```python
class BaseGuardrail(ABC):
    def check(self, run_input: RunInput | TeamRunInput) -> None: ...
    async def async_check(self, run_input: RunInput | TeamRunInput) -> None: ...
```
Raise `InputCheckError(message, check_trigger=CheckTrigger.OFF_TOPIC)` to block input.
Raise `OutputCheckError(message, check_trigger=CheckTrigger.OUTPUT_NOT_ALLOWED)` from
post-hooks to block output.

**`CheckTrigger` enum values (verified from `agno/exceptions.py`):**
```python
class CheckTrigger(Enum):
    OFF_TOPIC          = "off_topic"
    INPUT_NOT_ALLOWED  = "input_not_allowed"
    OUTPUT_NOT_ALLOWED = "output_not_allowed"
    VALIDATION_FAILED  = "validation_failed"
    PROMPT_INJECTION   = "prompt_injection"
    PII_DETECTED       = "pii_detected"
```

**For the `TopicRelevanceGuardrail` (new, for GUARD-01–03):** implement as a
`BaseGuardrail` subclass in `app/agents/guardrails.py` alongside the existing
guardrails. It should check whether the user's message is sufficiently related to
studying/learning/session content, and raise `InputCheckError` with
`CheckTrigger.OFF_TOPIC` if not. Do not use `OpenAIModerationGuardrail` or
`PIIDetectionGuardrail` — those make external API calls and are overkill here.

**`PromptInjectionGuardrail` constructor (verified from `agno/guardrails/prompt_injection.py`):**
```python
PromptInjectionGuardrail(injection_patterns: Optional[List[str]] = None)
```
Default patterns include 16 phrases (`"ignore previous instructions"`, `"jailbreak"`,
`"pretend you are"`, etc.). Pass a custom list to extend or replace defaults.

---

### 3. Persistent Tutor Conversation Storage

**No new mechanism.** The `add_history_to_context=True` + `db=traces_db` pattern
already used by `ChatAgent` (verified in `chat_agent.py` lines 18–23) applies
identically to `Team`. No additional table, file, or migration is needed.

**How persistence works:**

- `Team(db=traces_db, add_history_to_context=True, num_history_runs=N)` stores every
  run's messages in the `agno_sessions` table in `traces_db`.
- On the next `arun()` with the same `session_id`, agno reads the past N runs from
  SQLite and prepends them to the LLM context automatically.
- The `session_id` is the lookup key — namespacing (`"tutor:<session_id>"`) keeps
  tutor rows isolated from workflow and chat rows.

**Tutor conversation persists across page refreshes.** The session row lives in SQLite
on the server. The client does not send conversation history in the request body — it
only sends the current message and the `session_id`. This is the inverse of the existing
chat endpoint, which has the client send the last 6 turns as JSON.

**Session_id strategy for the new tutor endpoint:**
```python
# In routers/tutor.py
tutor_session_id = f"tutor:{body.session_id}"
# Optional future: allow client-initiated reset
# tutor_session_id = f"tutor:{body.session_id}:{body.tutor_reset_id}" if body.tutor_reset_id else f"tutor:{body.session_id}"
```

**Critical difference from `Workflow.arun()` persistence bug (agno #3819):**
`Team.arun()` uses a different code path (`_storage._cleanup_and_store` called in the
`finally` block of `_arun_coordinate`, `_arun_route`, etc.) that persists correctly in
async mode. No `asyncio.to_thread` workaround is needed for `Team`. This is verified by
reading `agno/team/_run.py` — the async team runners all call `_cleanup_and_store`
directly, unlike the Workflow async path that skipped `save_session()`.

---

## New Files to Create

| File | Purpose |
|------|---------|
| `backend/app/agents/tutor_team.py` | `build_tutor_team(session_id, notes, tutoring_type, db)` factory |
| `backend/app/agents/advisor_agent.py` | `build_advisor_agent(tutoring_type, db)` — new specialist |
| `backend/app/routers/tutor.py` | `POST /tutor/stream` SSE endpoint |

### Pattern for `build_tutor_team()` (verified API shape):

```python
from agno.team import Team, TeamMode
from agno.agents.guardrails import PROMPT_INJECTION_GUARDRAIL, validate_substantive_output

def build_tutor_team(
    session_id: str,
    notes: str,
    tutoring_type: str,
    db: SqliteDb | None = None,
) -> Team:
    return Team(
        members=[
            build_chat_agent(tutoring_type, notes, db=db),    # role="Content Q&A specialist"
            build_quiz_agent(tutoring_type, db=db),           # role="Quiz and assessment specialist"
            build_flashcard_agent(tutoring_type, db=db),      # role="Flashcard generation specialist"
            build_advisor_agent(tutoring_type, db=db),        # role="Learning advisor"
        ],
        model=get_model(),
        name="PersonalTutor",
        mode=TeamMode.route,
        instructions=[...coordinator routing instructions...],
        db=db,
        add_history_to_context=True,
        num_history_runs=get_settings().tutor_history_window,
        enable_session_summaries=False,
        pre_hooks=[PROMPT_INJECTION_GUARDRAIL, TopicRelevanceGuardrail(notes=notes)],
        post_hooks=[validate_substantive_output],
    )
```

## Existing Files to Extend

| File | Change |
|------|--------|
| `backend/app/agents/guardrails.py` | Add `TopicRelevanceGuardrail(BaseGuardrail)` subclass |
| `backend/app/config.py` | Add `tutor_history_window: int = 20` setting |
| `backend/app/main.py` | Register `tutor` router under `/tutor` prefix |

## Member Agent Roles

Each member must have `role=` set so the coordinator can route in `TeamMode.route`:

| Member | `role=` string | What it handles |
|--------|----------------|-----------------|
| ChatAgent variant | `"Content Q&A specialist"` | Concept explanation, clarification, general questions about the session material |
| QuizAgent variant | `"Quiz and assessment specialist"` | In-chat quiz mode, answer evaluation, quiz result discussion |
| FlashcardAgent variant | `"Flashcard generation specialist"` | Generate inline flashcards on demand |
| AdvisorAgent (new) | `"Learning advisor"` | Surface focus areas, identify gaps, give study guidance based on quiz performance |

The `role` parameter is passed to `Agent(role=...)` (verified as a field on `Agent` class;
mirrors the same field on `Team`). The coordinator's routing prompt should reference these
roles.

---

## No New Dependencies

| Candidate | Verdict | Reason |
|-----------|---------|--------|
| New SQLite file for tutor chat | Do not add | Existing `traces_db` stores team sessions in `agno_sessions` — namespacing the session_id is sufficient |
| Separate `agno.storage` or memory module | Do not add | `add_history_to_context=True` + `db=traces_db` handles persistence transparently |
| LangChain or LlamaIndex | Do not add | No dependency; agno Team is self-contained |
| `asyncio.to_thread` for Team | Do not add | `Team.arun()` persists correctly in async (unlike `Workflow.arun()`) — no workaround needed |
| `OpenAIModerationGuardrail` | Do not add | Makes external OpenAI API call; overkill for topic-relevance guardrail |
| `PIIDetectionGuardrail` | Do not add | Out of scope for v7.0; adds noise without PII use case |
| New Pydantic response models for tutor | Defer | Team returns `TeamRunOutput.content: str`; structured content (flashcards, quiz) rendered from member agent JSON within SSE |
| `react-query` or state lib for frontend | Do not add | Existing React state + SSE pattern is sufficient for the tutor tab |

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| `Team.__init__` parameters | HIGH | Direct read of `agno/team/team.py` at 2.5.8 |
| `TeamMode` enum values | HIGH | Direct read of `agno/team/mode.py` |
| `Team.arun()` signature | HIGH | Direct read of `agno/team/team.py` overloads |
| `TeamRunEvent` event strings | HIGH | Direct read of `agno/run/team.py` |
| Guardrail APIs (`BaseGuardrail`, `PromptInjectionGuardrail`) | HIGH | Direct read of `agno/guardrails/` |
| `CheckTrigger` values | HIGH | Direct read of `agno/exceptions.py` |
| Team persistence via `db=` + `add_history_to_context` | HIGH | Direct read of `agno/team/_storage.py` + `_session.py` |
| `Team.arun()` persists correctly without `to_thread` | HIGH | Direct read of `agno/team/_run.py` (`_cleanup_and_store` in all async paths) |
| Session_id namespacing requirement | HIGH | Inferred from existing `chat.py` pattern + `agno_sessions` PK behavior |
| `Agent.role` parameter available | MEDIUM | Seen in Team source references to `agent.role`; not directly verified in `Agent.__init__` |

---

## Sources

All HIGH confidence sources are direct reads of the installed package at 2.5.8:

- `backend/venv/lib/python3.14/site-packages/agno/team/team.py` — `Team` class and `arun()` overloads
- `backend/venv/lib/python3.14/site-packages/agno/team/mode.py` — `TeamMode` enum
- `backend/venv/lib/python3.14/site-packages/agno/team/_run.py` — async run dispatch and `_cleanup_and_store`
- `backend/venv/lib/python3.14/site-packages/agno/team/_storage.py` — session persistence helpers
- `backend/venv/lib/python3.14/site-packages/agno/team/_session.py` — `get_session()` accessors
- `backend/venv/lib/python3.14/site-packages/agno/team/__init__.py` — public export surface
- `backend/venv/lib/python3.14/site-packages/agno/guardrails/__init__.py` — guardrail exports
- `backend/venv/lib/python3.14/site-packages/agno/guardrails/base.py` — `BaseGuardrail` ABC
- `backend/venv/lib/python3.14/site-packages/agno/guardrails/prompt_injection.py` — `PromptInjectionGuardrail`
- `backend/venv/lib/python3.14/site-packages/agno/exceptions.py` — `CheckTrigger`, `InputCheckError`, `OutputCheckError`
- `backend/venv/lib/python3.14/site-packages/agno/run/team.py` — `TeamRunEvent`, `TeamRunInput`, `TeamRunOutput`
- `backend/venv/lib/python3.14/site-packages/agno/db/sqlite/sqlite.py` — `SqliteDb` constructor
- Existing app: `backend/app/agents/guardrails.py`, `backend/app/agents/chat_agent.py`, `backend/app/routers/chat.py`

---

*Stack research for: Super Tutor v7.0 — Personal Tutor (Agno Teams, guardrails, persistent chat)*
*Researched: 2026-03-15*
