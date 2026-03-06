---
phase: 06-agentos-core-integration
plan: 02
subsystem: infra
tags: [agno, agentos, sqlite, sqlalchemy, tracing, agents]

# Dependency graph
requires:
  - phase: 06-01
    provides: agno>=2.5.7 available and settings.trace_db_path configured
provides:
  - AgentOS wrapping of FastAPI app with tracing=True and SqliteDb at trace_db_path
  - All five agent builder functions accept optional db= parameter (notes, chat, flashcard, quiz, research)
  - SessionWorkflow and build_workflow accept db= and thread it to notes agent and inline title Agent
  - sqlalchemy>=2.0.0 added to requirements.txt (required by agno.db.sqlite)
affects:
  - 06-03 (router db= injection — uses build_notes_agent, build_chat_agent etc. with db= param)
  - 06-04 (trace verification — depends on AgentOS being active and traces_db wired)

# Tech tracking
tech-stack:
  added: [sqlalchemy>=2.0.0]
  patterns:
    - "AgentOS wrapping at module bottom via _wrap_with_agentos() helper after all routes registered"
    - "on_route_conflict=preserve_base_app prevents AgentOS from overriding application routes"
    - "One representative agent in agents=[] satisfies AgentOS startup; per-request agents receive db= at call time in routers"

key-files:
  created: []
  modified:
    - backend/app/main.py
    - backend/app/agents/notes_agent.py
    - backend/app/agents/chat_agent.py
    - backend/app/agents/flashcard_agent.py
    - backend/app/agents/quiz_agent.py
    - backend/app/agents/research_agent.py
    - backend/app/workflows/session_workflow.py
    - backend/requirements.txt

key-decisions:
  - "on_route_conflict=preserve_base_app required to prevent AgentOS overriding POST /sessions and GET /health routes"
  - "sqlalchemy added as explicit dependency — agno.db.sqlite imports it at module level; was missing from requirements.txt"
  - "One representative NotesAgent registered in agents=[] to satisfy AgentOS startup requirements — does NOT replace per-request instances"
  - "tracing=True warning about OpenTelemetry packages is informational — SQLite tracing still works; OTEL is for external observability only"

patterns-established:
  - "AgentOS wrapping pattern: imports and _wrap_with_agentos() function placed at bottom of main.py after all routes, app = _wrap_with_agentos(app) as final app reassignment"
  - "db= parameter pattern: all agent builders accept db: SqliteDb | None = None as last param; db=db passed to Agent() constructor"

requirements-completed: [INT-01, INT-02, STOR-02, TRAC-01, TRAC-02]

# Metrics
duration: 6min
completed: 2026-03-06
---

# Phase 6 Plan 02: AgentOS Core Integration Summary

**FastAPI app wrapped with AgentOS(tracing=True, db=SqliteDb) and all six agent construction points wired with db= for automatic SQLite trace capture**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-06T12:18:21Z
- **Completed:** 2026-03-06T12:24:38Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- All five agent builder functions (notes, chat, flashcard, quiz, research) and build_workflow now accept `db: SqliteDb | None = None` and pass it to `Agent()`
- SessionWorkflow stores `self.db` and threads it to both the notes agent and inline title Agent via `_generate_title(text, fallback, db=self.db)`
- main.py wraps FastAPI app with `AgentOS(base_app=app, db=traces_db, tracing=True)` at module bottom after all routes
- `on_route_conflict="preserve_base_app"` prevents AgentOS from hijacking application routes (`POST /sessions`, `GET /health`)
- Server starts cleanly; `/health` returns `{"status":"ok"}` and `POST /sessions` returns app-native `{"session_id":"..."}` response
- sqlalchemy added to requirements.txt (missing transitive dependency of agno.db.sqlite)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add db= parameter to all five agent builders and session_workflow** - `9f4863a` (feat)
2. **Task 2: Wrap FastAPI app with AgentOS in main.py** - `21a5463` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `backend/app/main.py` - AgentOS wrapping via `_wrap_with_agentos()` helper; agent builder imports; `on_route_conflict="preserve_base_app"`
- `backend/app/agents/notes_agent.py` - SqliteDb import; `db: SqliteDb | None = None` param; `db=db` in Agent()
- `backend/app/agents/chat_agent.py` - SqliteDb import; `db=` param added to `build_chat_agent`; `db=db` in Agent()
- `backend/app/agents/flashcard_agent.py` - SqliteDb import; `db=` param; `db=db` in Agent()
- `backend/app/agents/quiz_agent.py` - SqliteDb import; `db=` param; `db=db` in Agent()
- `backend/app/agents/research_agent.py` - SqliteDb import; `db=` param on `build_research_agent`; `db=db` in Agent()
- `backend/app/workflows/session_workflow.py` - SqliteDb import; `db=` on `__init__` and `build_workflow`; `self.db` stored; passed to notes agent and `_generate_title`
- `backend/requirements.txt` - Added `sqlalchemy>=2.0.0` (required by agno.db.sqlite)

## Decisions Made
- `on_route_conflict="preserve_base_app"` — discovered AgentOS defaults to `preserve_agentos` which hijacks `POST /sessions` with its own agent session list endpoint; switching to `preserve_base_app` keeps all application routes intact
- One representative `NotesAgent("micro_learning")` registered in `agents=[]` — empty list may cause AgentOS startup errors per research; this agent is not used for tracing (db= at call time handles that)
- `tracing=True` warning about missing OpenTelemetry packages is acceptable — warns about OTEL distributed tracing only; local SQLite trace capture works without it
- sqlalchemy added as explicit requirement — `agno.db.sqlite` imports it at module load time; was blocking task 1 verification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added sqlalchemy to requirements.txt**
- **Found during:** Task 1 (verify step — running import check)
- **Issue:** `agno.db.sqlite` imports sqlalchemy at module level; `ModuleNotFoundError: No module named 'sqlalchemy'` blocked all agent imports
- **Fix:** Added `sqlalchemy>=2.0.0` to `backend/requirements.txt` and installed in venv
- **Files modified:** `backend/requirements.txt`
- **Verification:** Import check passed; all agent builders verified with db= parameter
- **Committed in:** `9f4863a` (Task 1 commit)

**2. [Rule 1 - Bug] Added on_route_conflict=preserve_base_app to AgentOS**
- **Found during:** Task 2 (server verification — testing POST /sessions response)
- **Issue:** AgentOS default `on_route_conflict="preserve_agentos"` overrode `POST /sessions` with AgentOS session list endpoint and `GET /health` with AgentOS health endpoint — existing SSE flow broken
- **Fix:** Set `on_route_conflict="preserve_base_app"` in AgentOS constructor so application routes take precedence
- **Files modified:** `backend/app/main.py`
- **Verification:** `POST /sessions` returns `{"session_id":"..."}` (app response); `GET /health` returns `{"status":"ok"}`; no route conflict warnings
- **Committed in:** `21a5463` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 bug)
**Impact on plan:** Both fixes essential for correctness — without them the app would fail to import or break existing SSE endpoints. No scope creep.

## Issues Encountered

- `tracing=True` warning about OpenTelemetry packages: informational only. SQLite tracing works without OTEL. Installing OTEL packages would enable distributed tracing to external backends (Phase 7 concern). Warning is expected and acceptable.
- AgentOS sends a telemetry POST to `os-api.agno.com` at startup — this is normal agno telemetry behavior, not an error.

## User Setup Required

None - no external service configuration required. The `sqlalchemy` dependency is installed automatically via `requirements.txt`.

## Next Phase Readiness
- All six agent construction points have `db=` parameter — ready for router-level db= injection in plan 06-03
- AgentOS is active with `tracing=True` and `db=traces_db` — trace rows will be written to `tmp/super_tutor_traces.db` once routers pass the db instance at call time
- TRAC-02 (token columns) will be verified after plan 06-03 completes an actual agent run
- All existing SSE endpoints remain intact and testable

---
*Phase: 06-agentos-core-integration*
*Completed: 2026-03-06*
