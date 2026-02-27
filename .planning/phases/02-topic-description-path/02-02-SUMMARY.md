---
plan: 02-02
phase: 02-topic-description-path
status: complete
completed: 2026-02-28
commits:
  - 788c8ad
  - b9bf774
---

# Plan 02-02 Summary: Backend Router + Workflow Wiring

## What Was Built

### Task 1 — `backend/app/workflows/session_workflow.py`
Extended `SessionWorkflow.run()` with two new optional parameters:
- `session_type: str = "url"` — discriminator passed through to the final result
- `sources: list | None = None` — source URLs from research agent

The final `workflow_completed` RunResponse content dict now includes both fields alongside the existing keys (`source_title`, `tutoring_type`, `notes`, `flashcards`, `quiz`). Backward compatible — existing URL-path callers get `session_type="url"` and `sources=None` by default.

### Task 2 — `backend/app/routers/sessions.py`
Added full topic description path to `stream_session`:

- **Import**: `from app.agents.research_agent import run_research`
- **Three-way branch**: `topic_description → research → workflow`, `paste_text → workflow`, `url → extraction → workflow`
- **Vague topic detection**: < 3 words emits `warning` SSE event before proceeding
- **Research fallback**: empty/short content falls back to LLM knowledge prompt + emits warning event
- **Input validation**: topic < 10 chars triggers error event immediately
- **workflow.run()** receives `session_type` and `sources` kwargs

## Verification Passed
- `from app.routers.sessions import router` — no ImportError
- `SessionWorkflow.run()` signature confirmed to include `session_type` and `sources`

## key-files
### created
(none — both files were extended)

### modified
- backend/app/workflows/session_workflow.py
- backend/app/routers/sessions.py

## Self-Check: PASSED
