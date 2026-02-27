# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** A user gives a topic (URL or description), picks how they want to learn, and gets a complete, ready-to-study session in minutes — no account needed, no friction.
**Current focus:** Phase 2 — Topic Description Path

## Current Position

Phase: 2 of 3 — In Progress
Plan: 1/4 in Phase 2 (02-01 done)
Status: Phase 2 active — research agent + session models complete, router next
Last activity: 2026-02-27 — Phase 2 Plan 01 complete (research_agent.py + session.py extended)

Progress: [███░░░░░░░] 30% (Phase 2: 1/4 plans done)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 4min
- Total execution time: ~38min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-url-session-pipeline | 8 | ~38min | ~5min |

**Recent Trend:**
- Last 5 plans: 01-04 (3min), 01-05 (5min), 01-06 (4min), 01-07 (4min), 01-08 (10min), 02-01 (8min)
- Trend: Stable

*Updated after each plan completion*

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02-topic-description-path | 1/4 | 8min | 8min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: Agno framework required for all AI agents (AGENT-01) — must be addressed in Phase 1 alongside first agent work, not retrofitted later
- [Pre-phase]: Chat deferred to v2 (CHAT-01, CHAT-02) — removes SSE chat infrastructure from v1 scope
- [Pre-phase]: Topic description path (SESS-02) deferred to Phase 2 — URL path proves the generation pipeline first
- [Pre-phase]: URL extraction chain: Jina Reader → trafilatura → Playwright → paste-text fallback — verify Jina pricing before Phase 1 implementation
- [01-01]: Lazy imports inside get_model() branches — provider SDK only imported when selected, avoiding ImportError if optional packages absent
- [01-01]: lru_cache on get_settings() — single Settings instance per process, avoiding repeated .env reads
- [01-01]: PERSONAS stored as plain dict[str, str] — system prompts editable without touching agent code
- [01-02]: OAT UI CDN URL is https://oat.ink/oat.min.css (plan had oat.css which 404s; confirmed oat.min.css returns 200)
- [01-02]: No oat-ui npm package exists; CDN link in root layout <head> is the integration approach
- [01-02]: .env.local is gitignored by Next.js defaults; NEXT_PUBLIC_API_URL must be created manually
- [01-05]: Two-step SSE flow required — POST stores params, GET /stream runs pipeline (EventSource is GET-only)
- [01-05]: asyncio.sleep(0) between workflow steps ensures SSE frame flushing step-by-step not buffered
- [01-05]: sse-starlette 3.2.0 requires fastapi>=0.115.0; upgraded from 0.104.1 to 0.129.0 to fix middleware stack ValueError
- [Phase 01-07]: useState<string> explicit type annotation needed when initializing from as-const array element — avoids literal type inference blocking string setters
- [Phase 01-07]: 400ms delay after SSE complete event lets user see 100% progress bar before router.push redirect
- [Phase 01-08]: OpenRouter free models require data policy opt-in at openrouter.ai/settings/privacy
- [Phase 01-08]: 401 "User not found" from OpenRouter = invalid/revoked API key (not a code issue)
- [Phase 01-08]: Provider switching confirmed: only .env change + backend restart needed, zero code changes
- [Phase 02-topic-description-path]: ddgs>=6.0.0 added to requirements.txt — agno DuckDuckGoTools imports from ddgs package directly (not duckduckgo-search)
- [Phase 02-topic-description-path]: run_research() returns empty ResearchResult on exception — router layer checks empty content as research failure signal
- [Phase 02-topic-description-path]: SessionType discriminator defaults to 'url' on SessionResult — existing URL sessions require zero code changes (backward compatible)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2 pre-work]: Tavily pricing and rate limits unconfirmed — verify before Phase 2 planning

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 02-topic-description-path plan 01 — research_agent.py and session.py extended
Resume file: None
