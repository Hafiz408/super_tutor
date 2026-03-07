---
phase: 08-storage-and-workflow-foundation
plan: "01"
subsystem: workflow
tags: [agno, workflow, sqlite, session-state, persistence]
dependency_graph:
  requires: []
  provides: [session_db_path, agno-workflow-composition, notes_step, session-state-persistence]
  affects: [backend/app/routers/sessions.py]
tech_stack:
  added: [agno.workflow.Workflow, agno.workflow.Step, agno.workflow.types.StepInput, agno.workflow.types.StepOutput]
  patterns: [Workflow composition (not subclassing), per-request factory, lazy singleton DB, asyncio.to_thread for sync step executor]
key_files:
  created: []
  modified:
    - backend/app/config.py
    - backend/app/workflows/session_workflow.py
    - backend/app/routers/sessions.py
decisions:
  - "Use asyncio.to_thread(workflow.run, ...) — arun() does not persist session_state (GitHub #3819)"
  - "Per-request Workflow instantiation via build_session_workflow() — never share across requests (CVE-2025-64168)"
  - "session_state param detected by agno via inspection — name must be exactly `session_state`"
  - "Separate SqliteDb for sessions (id=super_tutor_sessions) from traces (id=super_tutor_traces)"
metrics:
  duration: ~2 min
  completed: 2026-03-07
  tasks_completed: 2
  files_modified: 3
---

# Phase 8 Plan 01: agno Workflow Composition + Session DB Path Summary

**One-liner:** agno Workflow composition with notes_step executor writing to session_state for automatic SQLite persistence via SqliteDb(id="super_tutor_sessions").

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add session_db_path to Settings | a700b64 | backend/app/config.py |
| 2 | Refactor session_workflow.py — Workflow composition + notes_step executor | 02d19df | backend/app/workflows/session_workflow.py, backend/app/routers/sessions.py |

## What Was Built

### Task 1 — session_db_path Setting
Added `session_db_path: str = "tmp/super_tutor_sessions.db"` to the `Settings` class immediately after `trace_db_path`, following the identical pattern. Overridable via `SESSION_DB_PATH` env var through pydantic-settings auto-mapping.

### Task 2 — agno Workflow Composition
Replaced the `SessionWorkflow` plain Python class with agno-native composition:

- **`_get_session_db()`**: Lazy singleton creating `SqliteDb(id="super_tutor_sessions")` from `settings.session_db_path`. Separate file and identity from the traces DB.
- **`notes_step(step_input, session_state)`**: Synchronous executor. agno detects the `session_state: dict` parameter via inspection and injects the session dict. After notes generation, writes `notes`, `tutoring_type`, `session_type`, `sources` to `session_state` — agno's `save_session()` in the finally block persists to SQLite automatically.
- **`build_session_workflow(session_id, session_db)`**: Per-request factory returning `Workflow(steps=[Step(executor=notes_step)], ...)`. Never reused across requests.
- **`run_session_workflow()`**: Async generator replacing `SessionWorkflow.run()`. Wraps sync `workflow.run()` via `asyncio.to_thread`. Yields `RunResponse(content="Crafting your notes...")` first, then `RunResponse(event="workflow_completed", content={...})` — drop-in compatible with the router's `async for` loop.

All helper functions preserved verbatim: `_extract_title`, `_is_valid_title`, `_generate_title`, `_parse_json_safe`, `_TITLE_ERROR_PREFIXES`, `_TITLE_ERROR_SUBSTRINGS`.

### Router Update (Deviation — Rule 3)
`backend/app/routers/sessions.py` imported `build_workflow` and called `workflow.run(...)`. Since `build_workflow` was removed in the refactor, the router import would fail at startup — a blocking issue. Updated import to `run_session_workflow` and replaced the `build_workflow(...) + workflow.run(...)` call pattern with `run_session_workflow(session_id=..., ..., traces_db=_get_traces_db())`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated sessions.py router to use new interface**
- **Found during:** Task 2
- **Issue:** Router imported `build_workflow` (removed) and called `workflow.run()` (old async generator on plain class). Would cause `ImportError` at startup.
- **Fix:** Updated import to `run_session_workflow` and replaced the workflow instantiation + `workflow.run()` call pattern with `run_session_workflow(session_id=..., traces_db=_get_traces_db())`.
- **Files modified:** `backend/app/routers/sessions.py`
- **Commit:** 02d19df (included with Task 2)

## Verification Results

All plan verification checks passed:
- `Settings.session_db_path` exists with default `tmp/super_tutor_sessions.db` and overridable via env var
- `from app.workflows.session_workflow import build_session_workflow, notes_step, run_session_workflow, _parse_json_safe` — OK
- `build_session_workflow('test-sid', _get_session_db())` returns `Workflow type: Workflow`
- `notes_step` has `session_state: dict` in its signature
- No `class SessionWorkflow` in source files
- Existing tests: 2 pass, 1 pre-existing failure (`test_agent_api_key_defaults_to_empty_string` fails because local `.env` has a real API key, overriding the default empty string — confirmed pre-existing before this plan)

## Self-Check: PASSED

Files exist:
- backend/app/config.py — FOUND
- backend/app/workflows/session_workflow.py — FOUND
- backend/app/routers/sessions.py — FOUND

Commits exist:
- a700b64 (feat(08-01): add session_db_path to Settings) — FOUND
- 02d19df (feat(08-01): refactor session_workflow to agno Workflow composition) — FOUND
