---
phase: 16-add-prompt-injection-and-output-guardrai
plan: 16
subsystem: backend/agents
tags: [security, guardrails, prompt-injection, agno, agents]
dependency_graph:
  requires: []
  provides: [guardrails.py, agent-pre-hooks, agent-post-hooks, InputCheckError-handling]
  affects: [notes_agent, chat_agent, flashcard_agent, quiz_agent, research_agent, session_workflow]
tech_stack:
  added: [agno.guardrails.PromptInjectionGuardrail, agno.exceptions.InputCheckError, agno.exceptions.OutputCheckError]
  patterns: [pre_hooks/post_hooks singleton pattern, InputCheckError-to-RuntimeError conversion at call sites]
key_files:
  created:
    - backend/app/agents/guardrails.py
  modified:
    - backend/app/agents/notes_agent.py
    - backend/app/agents/chat_agent.py
    - backend/app/agents/flashcard_agent.py
    - backend/app/agents/quiz_agent.py
    - backend/app/agents/research_agent.py
    - backend/app/workflows/session_workflow.py
decisions:
  - "20-char output threshold chosen as intentionally low floor — catches true failures without false positives on short valid outputs"
  - "PROMPT_INJECTION_GUARDRAIL defined as module-level singleton — PromptInjectionGuardrail is stateless, safe to share across all agent instances"
  - "_generate_title existing except Exception unchanged — falls back gracefully, InputCheckError doesn't need special handling there"
  - "InputCheckError caught only at run_with_retry call sites in notes_step and run_research, not in agent builders themselves"
metrics:
  duration: ~5min
  completed: 2026-03-07
  tasks_completed: 2
  files_modified: 7
---

# Quick Task 16: Prompt Injection and Output Guardrails Summary

**One-liner:** Shared agno PromptInjectionGuardrail (pre-hook) and custom output length validator (post-hook) applied to all five agents, with InputCheckError caught and converted to clean RuntimeError at workflow call sites.

## What Was Done

### Task 1: Create shared guardrails module

Created `backend/app/agents/guardrails.py` with:
- `PROMPT_INJECTION_GUARDRAIL` — module-level singleton of `agno.guardrails.PromptInjectionGuardrail`. Raises `InputCheckError` on injection detection, before the LLM sees the input.
- `validate_substantive_output(run_output: RunOutput)` — post-hook that raises `OutputCheckError` if content is under 20 characters, catching empty/error strings propagating as valid output.

### Task 2: Wire guardrails into all agents and handle InputCheckError

**Agent updates (5 files):** Added `pre_hooks=[PROMPT_INJECTION_GUARDRAIL], post_hooks=[validate_substantive_output]` to:
- `NotesAgent` in `notes_agent.py`
- `ChatAgent` in `chat_agent.py`
- `FlashcardAgent` in `flashcard_agent.py`
- `QuizAgent` in `quiz_agent.py`
- `ResearchAgent` in `research_agent.py`

**InputCheckError handling:**
- `session_workflow.py`: Added `from agno.exceptions import InputCheckError`; wrapped `run_with_retry` in `notes_step` with `except InputCheckError` converting to user-facing `RuntimeError`.
- `research_agent.py`: Added `from agno.exceptions import InputCheckError`; wrapped `run_with_retry` in `run_research()` with same conversion pattern.

## Verification Results

- `guardrails module OK` — module imports cleanly, both exports available.
- `4 agents: guardrails wired OK` — notes, chat, flashcard, quiz verified via Python assert.
- `ResearchAgent: guardrails wired OK` — verified with `TAVILY_API_KEY=dummy` (key required at TavilyTools() construction time, not at hook wiring).

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Items

**Pre-existing test failure** (unrelated to this task):
- `test_agent_api_key_defaults_to_empty_string` in `tests/test_config.py` fails because a real API key is present in the dev environment. This test was already failing before this task's changes. No action taken.

## Self-Check: PASSED

- backend/app/agents/guardrails.py: FOUND
- Commit 65cb13f (Task 1): FOUND
- Commit d6aeb02 (Task 2): FOUND
