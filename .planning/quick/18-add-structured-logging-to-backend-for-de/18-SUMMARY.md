---
phase: quick-18
plan: 18
subsystem: backend/logging
tags: [logging, observability, structured-logs, json, workflow]
dependency_graph:
  requires: []
  provides: [structured-json-logging, configure-logging, json-formatter]
  affects: [backend/app/main.py, backend/app/workflows/session_workflow.py]
tech_stack:
  added: []
  patterns: [JsonFormatter, extra={} structured fields, LOG_FORMAT env var]
key_files:
  created:
    - backend/app/utils/logging.py
  modified:
    - backend/app/main.py
    - backend/app/workflows/session_workflow.py
decisions:
  - Default LOG_FORMAT=text preserves existing human-readable output (no breaking change for local dev)
  - json.dumps(payload, default=str) used to handle non-serializable extra field values gracefully
  - frozenset STDLIB_LOG_KEYS used to cleanly isolate caller-provided extra fields from standard LogRecord attrs
metrics:
  duration: ~4 min
  completed: 2026-03-08
  tasks_completed: 2
  files_changed: 3
---

# Phase quick-18 Plan 18: Structured Logging Summary

**One-liner:** Zero-dep JSON structured logging via JsonFormatter + configure_logging() with standardized extra={session_id, step} fields across all five workflow steps.

## What Was Built

### Task 1: backend/app/utils/logging.py

Created `JsonFormatter(logging.Formatter)` that produces one valid JSON object per log line with fields:
- `ts` — ISO 8601 UTC timestamp
- `level` — log level name
- `logger` — logger name
- `msg` — formatted message
- Any extra fields passed via `extra={}` merged into the top-level object
- `exc` — formatted traceback when exc_info is set

Created `configure_logging(level=logging.INFO)` that:
- Reads `LOG_FORMAT` env var: `json` -> JsonFormatter, anything else -> plain text (same format as previous basicConfig)
- Calls `logging.basicConfig(force=True)` with a `StreamHandler(sys.stdout)`
- Silences `uvicorn.access`, `httpx`, `httpcore` to WARNING

No new pip dependencies — uses stdlib `logging`, `json`, `datetime`, `os`, `sys` only.

### Task 2: main.py + session_workflow.py

**main.py:** Replaced the hardcoded `logging.basicConfig(...)` block with `from app.utils.logging import configure_logging` and `configure_logging()`.

**session_workflow.py:** Standardized all step start/done/error log calls across all five step functions:

| Step | start extra | done extra | warning extra |
|------|-------------|------------|---------------|
| research | session_id, step, topic | session_id, step, elapsed | — |
| notes | session_id, step, tutoring_type | session_id, step, elapsed | — |
| flashcards | session_id, step | session_id, step, count | session_id, step, error |
| quiz | session_id, step | session_id, step, count | session_id, step, error |
| title | session_id, step | session_id, step, title | session_id, step, error |

Zero `[bracket_prefix]` style logs remain in session_workflow.py.

## Verification

All checks passed:

1. `python -c "from app.utils.logging import configure_logging, JsonFormatter; print('ok')"` -> `ok`
2. `python -c "... configure_logging(); print('text ok')"` -> `text ok`
3. `LOG_FORMAT=json python -c "... h.info('test', extra={'session_id': 's1', 'step': 'notes', 'elapsed': 1.2})"` -> `{"ts": "...", "level": "INFO", "logger": "t", "msg": "test", "session_id": "s1", "step": "notes", "elapsed": 1.2}`
4. `grep -n "\[flashcards_step\]\|\[quiz_step\]\|\[title_step\]"` -> no matches

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4fca804 | feat(quick-18): add JsonFormatter and configure_logging() to app/utils/logging.py |
| 2 | 61ece75 | feat(quick-18): wire configure_logging() into main.py and standardize step logs |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `backend/app/utils/logging.py` exists: FOUND
- Commit 4fca804 exists: FOUND
- Commit 61ece75 exists: FOUND
- No bracket-style logs in session_workflow.py: CONFIRMED
