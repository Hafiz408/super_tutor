# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15 after v7.0 milestone start)

**Core value:** A user gives a topic (URL, description, or document), picks how they want to learn, and gets a complete, ready-to-study session in minutes — no account needed, no friction.
**Current focus:** Phase 15 (Full Specialist Roster + Guardrails)

## Current Position

Phase: 15 of 18 (Full Specialist Roster + Guardrails) — IN PROGRESS
Plan: 2 of 3 in current phase
Status: In Progress
Last activity: 2026-03-15 — Phase 15 Plan 02 complete; Researcher (TEAM-04) + ContentWriter (TEAM-05) specialists added; TopicRelevanceGuardrail + validate_team_output wired onto Team constructor

Progress: [███████████████░░░░] 15/18 phases in progress (v1.0–v7.0 Team Foundation shipped; Phase 15 guardrails started)

## Performance Metrics

**Velocity:**
- Total plans completed: 28 (v1.0: 17, v2.0: 4, v3.0: 5, v4.0: 2, v5.0: 2; quick tasks excluded)
- Average duration: ~4 min
- Total execution time: ~111 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-url-session-pipeline | 8 | ~38min | ~5min |
| 02-topic-description-path | 4 | ~20min | ~5min |
| 03-study-experience-polish | 5 | ~10min | ~2min |
| 04-chat-backend | 2 | ~4min | ~2min |
| 05-chat-frontend | 3 | ~6min | ~2min |
| 06-agentos-core-integration | 3 | ~11min | ~4min |
| 07-control-plane-connection | 2 | ~13min | ~6min |
| 08-storage-and-workflow-foundation | 2 | ~5min | ~2.5min |
| 09-backend-api-simplification | 1 | ~2min | ~2min |
| 10-frontend-cleanup | 1 | ~1min | ~1min |
| 12-backend-upload-endpoint | 3 | ~10min | ~3.3min |
| 14-team-foundation | 2 | ~4min | ~2min |

**Recent Trend:**
- Last 5 plans: ~4min, ~2min, ~2min, ~1min, ~1min
- Trend: Stable (small focused plans executing fast)

*Updated after each plan completion*
| Phase 14-team-foundation P02 | 2 | 2 tasks | 2 files |
| Phase 15-guardrails P01 | 5min | 2 tasks | 2 files |
| Phase 15-full-specialist-roster-guardrails P02 | 3min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

All v1.0–v6.0 decisions logged in PROJECT.md Key Decisions table.

**Phase 15 Plan 01 decisions (2026-03-15):**
- TopicRelevanceGuardrail uses asyncio.to_thread in async_check() to avoid blocking event loop on synchronous model.invoke() (RESEARCH.md Pitfall 1)
- rejected SSE event (not error) for InputCheckError — polite topic redirect is not a server failure
- Judge prompt includes explicit YES rules for educational phrasing to prevent false positives
- validate_team_output mirrors validate_substantive_output 20-char threshold for consistency

**Phase 14 Plan 01 decisions (2026-03-15):**
- TeamMode.coordinate chosen over route: coordinate gives coordinator framing tokens before Explainer; route suppresses coordinator output (respond_directly=True) — violates the brief-acknowledgment-prefix requirement
- team.arun() async persistence CONFIRMED working in agno 2.5.8 (_arun_stream → _acleanup_and_store → asave_session). No asyncio.to_thread workaround needed.
- Agent.role parameter CONFIRMED in agno 2.5.8 Agent.__init__
- History managed at Team level only — Explainer has no db= to avoid duplicate session rows
- PROMPT_INJECTION_GUARDRAIL on Explainer only; coordinator does rejection via system prompt
- tutor_history_window default 10 (tutor conversations deeper per turn but shorter total)
- [Phase 14-team-foundation]: HTTP 422 for missing source_content (not 400) — client error in session data per CONTEXT.md locked decision
- [Phase 14-team-foundation]: tutor:{session_id} namespace prevents workflow session row overwrite in agno_sessions SQLite table
- [Phase 15-02]: Graceful TavilyTools fallback: factory catches MissingAPIKeyError and sets researcher_tools=[] with warning — prevents startup crash when TAVILY_API_KEY is not configured
- [Phase 15-02]: ContentWriter strictly prohibits raw JSON — avoids confusion with standalone flashcard_agent.py and quiz_agent.py which produce JSON
- [Phase 15-02]: Coordinator routing rules updated to four cases: Explainer (material questions), Researcher (go deeper/external), ContentWriter (flashcards/notes/quiz), off-topic (direct reject)

### Pending Todos

None.

### Blockers/Concerns

- [Phase 17-18 research flag]: Content envelope protocol (SSE-embedded structured JSON for MCQ options and flashcard blocks) has no existing codebase pattern — research spike needed before Phase 17 planning.

## Session Continuity

Last session: 2026-03-15
Stopped at: Completed 15-02-PLAN.md — Researcher (TEAM-04) + ContentWriter (TEAM-05) + guardrail hooks on Team. Phase 15 Plan 02 complete. Ready for Phase 15 Plan 03.
Resume file: None
