---
phase: 02-topic-description-path
plan: 01
subsystem: api
tags: [agno, duckduckgo, pydantic, research-agent, web-search]

# Dependency graph
requires:
  - phase: 01-url-session-pipeline
    provides: model_factory.get_model(), existing notes/flashcard/quiz agent patterns
provides:
  - ResearchResult dataclass + build_research_agent() + run_research() in research_agent.py
  - SessionType = Literal["url", "topic"] alias in session.py
  - topic_description field on SessionRequest
  - session_type and sources fields on SessionResult
affects:
  - 02-02 (session router — routes on topic_description, calls run_research)
  - 02-03 (SSE emitter — passes sources through to frontend)
  - 02-04 (frontend — renders source URLs for topic sessions)

# Tech tracking
tech-stack:
  added: [ddgs>=6.0.0]
  patterns:
    - "DuckDuckGoTools wired into Agno Agent via tools=[DuckDuckGoTools(enable_search=True)]"
    - "_parse_json_safe helper: strip markdown fences with regex then json.loads with empty-dict fallback"
    - "run_research() wraps agent.run() with try/except returning empty ResearchResult on any failure"

key-files:
  created:
    - backend/app/agents/research_agent.py
  modified:
    - backend/app/models/session.py
    - backend/requirements.txt

key-decisions:
  - "ddgs>=6.0.0 added to requirements.txt — agno DuckDuckGoTools depends on the ddgs package (not duckduckgo-search)"
  - "run_research() returns ResearchResult(content='', sources=[]) on exception — caller (router) checks empty content as research failure signal"
  - "SessionType discriminator defaults to 'url' on SessionResult — zero-change backward compatibility for existing URL sessions"

patterns-established:
  - "JSON-only agent output: system prompt ends with 'Return ONLY valid JSON, no markdown fences, no explanation' (same as flashcard/quiz agents)"
  - "All agents use get_model() factory for provider-agnostic model selection"

requirements-completed: [SESS-02]

# Metrics
duration: 8min
completed: 2026-02-27
---

# Phase 2 Plan 01: Research Agent and Session Model Extension Summary

**ResearchAgent using Agno + DuckDuckGoTools that web-searches a topic and returns synthesized content + source URLs, with SessionRequest/SessionResult extended for the topic-description path**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-27T00:00:00Z
- **Completed:** 2026-02-27T00:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `research_agent.py` with `ResearchResult` dataclass, `build_research_agent()` factory, and `run_research()` function
- Wired `DuckDuckGoTools` into an Agno `Agent` using the same `get_model()` factory as all other agents
- Extended `SessionRequest` with `topic_description: Optional[str] = None`
- Extended `SessionResult` with `session_type: SessionType = "url"` and `sources: Optional[List[str]] = None`
- All existing URL-path model usage remains backward compatible (new fields have defaults)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create research_agent.py with Agno + DuckDuckGoTools** - `e34ca80` (feat)
2. **Task 2: Extend Pydantic models with topic_description, session_type, sources** - `285b591` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/app/agents/research_agent.py` - ResearchResult dataclass, build_research_agent() factory, run_research() with JSON parsing
- `backend/app/models/session.py` - Added SessionType alias, topic_description on SessionRequest, session_type + sources on SessionResult
- `backend/requirements.txt` - Added ddgs>=6.0.0 (required by agno DuckDuckGoTools)

## Decisions Made
- Used `ddgs` package (not `duckduckgo-search`) — agno's DuckDuckGoTools imports from `ddgs` directly
- `run_research()` catches all exceptions and returns empty `ResearchResult` — router layer decides how to handle research failure
- `session_type` defaults to `"url"` on `SessionResult` — existing URL sessions require zero code changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing ddgs package**
- **Found during:** Task 1 (research_agent.py creation)
- **Issue:** agno's DuckDuckGoTools raised `ImportError: ddgs not installed` when imported
- **Fix:** Ran `pip install "ddgs>=6.0.0"` and added `ddgs>=6.0.0` to `backend/requirements.txt`
- **Files modified:** backend/requirements.txt
- **Verification:** `from agno.tools.duckduckgo import DuckDuckGoTools` imports cleanly
- **Committed in:** e34ca80 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking dependency)
**Impact on plan:** The ddgs install was strictly required by DuckDuckGoTools — no scope creep.

## Issues Encountered
- `ddgs` package was not pre-installed in the venv despite being an agno dependency — added to requirements.txt to ensure reproducibility.

## User Setup Required
None - no external service configuration required. DuckDuckGoTools uses free web search (no API key).

## Next Phase Readiness
- `run_research()` is ready to be called from the session router (Plan 02-02)
- `SessionRequest.topic_description` is ready to drive routing logic in the router
- `SessionResult.session_type` and `.sources` are ready to be populated and returned to the frontend
- No blockers

---
*Phase: 02-topic-description-path*
*Completed: 2026-02-27*
