---
phase: quick-1-logging
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/main.py
  - backend/app/agents/model_factory.py
  - backend/app/routers/sessions.py
  - backend/app/workflows/session_workflow.py
  - backend/app/extraction/chain.py
  - backend/app/agents/research_agent.py
autonomous: true
requirements: []

must_haves:
  truths:
    - "App startup logs the active provider, model, and allowed origins"
    - "Each incoming session POST logs the session_id and input type (url/topic/paste)"
    - "Stream open and stream close (complete or error) are logged with session_id"
    - "Each workflow agent step (notes, flashcards, quiz, title) logs start and elapsed time"
    - "Extraction chain logs which layer succeeded or that all layers failed"
    - "Research agent logs start, topic, and whether content was returned"
    - "All errors are logged at ERROR level with context before being re-raised or yielded"
  artifacts:
    - path: "backend/app/main.py"
      provides: "Logging basicConfig + startup log"
      contains: "logging.basicConfig"
    - path: "backend/app/routers/sessions.py"
      provides: "Request/stream lifecycle logs"
      contains: "logger.info"
    - path: "backend/app/workflows/session_workflow.py"
      provides: "Agent step timing logs"
      contains: "time.perf_counter"
    - path: "backend/app/extraction/chain.py"
      provides: "Extraction layer outcome logs"
      contains: "logger.info"
    - path: "backend/app/agents/research_agent.py"
      provides: "Research run logs"
      contains: "logger.info"
  key_links:
    - from: "backend/app/main.py"
      to: "all modules"
      via: "logging.basicConfig called once at module level in main.py; all loggers inherit root config"
      pattern: "logging\\.basicConfig"
---

<objective>
Add structured observability logging across all key backend layers using Python's stdlib `logging` module.

Purpose: Enable debugging of production issues and session flow tracing without adding any new dependencies.
Output: Log statements covering app startup, session lifecycle, agent step timing, extraction outcomes, and all error paths.
</objective>

<execution_context>
@/Users/mohammedhafiz/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mohammedhafiz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mohammedhafiz/Desktop/Personal/super_tutor/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Logging config in main.py and provider/model log in model_factory.py</name>
  <files>
    backend/app/main.py
    backend/app/agents/model_factory.py
  </files>
  <action>
**backend/app/main.py** — Add logging setup at the top of the file and a startup lifespan event:

1. Import `logging` at the top.
2. Call `logging.basicConfig` immediately after imports (before any FastAPI setup):
   ```python
   logging.basicConfig(
       level=logging.INFO,
       format="%(asctime)s %(levelname)s %(name)s — %(message)s",
       datefmt="%Y-%m-%d %H:%M:%S",
   )
   ```
3. Create a module logger: `logger = logging.getLogger("super_tutor.main")`
4. Replace the bare `FastAPI(...)` construction with a lifespan context manager so startup is logged. Use `contextlib.asynccontextmanager`:
   ```python
   from contextlib import asynccontextmanager

   @asynccontextmanager
   async def lifespan(app: FastAPI):
       settings = get_settings()
       logger.info(
           "Super Tutor API starting — provider=%s model=%s origins=%s",
           settings.agent_provider,
           settings.agent_model,
           settings.allowed_origins,
       )
       yield
       logger.info("Super Tutor API shutting down")

   app = FastAPI(title="Super Tutor API", ..., lifespan=lifespan)
   ```
5. Remove the bare `settings = get_settings()` call that currently sits at module level (it's now inside the lifespan). Keep it only inside the lifespan function (CORS middleware reads settings at import time via `get_settings()` which is lru_cached — that's fine, no change needed there).

   Actually: CORS `allow_origins=settings.allowed_origins` is evaluated at `app.add_middleware(...)` time which happens before lifespan runs. Keep the module-level `settings = get_settings()` for the middleware line, and separately log inside lifespan.

**backend/app/agents/model_factory.py** — Log which provider and model are resolved:

1. Import `logging` and create `logger = logging.getLogger("super_tutor.model_factory")`.
2. At the end of each branch in `get_model()`, before returning, add:
   ```python
   logger.debug("Model resolved: provider=%s model=%s", provider, model_id)
   ```
   Use `DEBUG` level here — this fires on every agent instantiation (notes, flashcards, quiz, title, research), so INFO would be noisy. The startup log in main.py already covers the configuration once at INFO.
  </action>
  <verify>
    Start the backend: `cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/backend && uvicorn app.main:app --port 8000 2>&1 | head -10`
    Expected output contains a line like:
    `INFO super_tutor.main — Super Tutor API starting — provider=openrouter model=... origins=...`
  </verify>
  <done>
    Backend starts and emits a timestamped INFO log line showing provider, model, and allowed origins.
    Format is `YYYY-MM-DD HH:MM:SS LEVEL name — message` for all subsequent log lines.
  </done>
</task>

<task type="auto">
  <name>Task 2: Runtime event logging — sessions router, workflow, extraction chain, research agent</name>
  <files>
    backend/app/routers/sessions.py
    backend/app/workflows/session_workflow.py
    backend/app/extraction/chain.py
    backend/app/agents/research_agent.py
  </files>
  <action>
Add a module-level logger (`logger = logging.getLogger("super_tutor.{module}")`) and targeted log statements in each file. Do NOT add per-line debug noise — only meaningful lifecycle events.

---

**backend/app/routers/sessions.py**

Add at top:
```python
import logging
logger = logging.getLogger("super_tutor.sessions")
```

In `create_session()`, after generating `session_id`:
```python
logger.info("Session created — session_id=%s input_type=%s tutoring_type=%s",
    session_id,
    "topic" if request.topic_description else ("paste" if request.paste_text else "url"),
    request.tutoring_type,
)
```

In `stream_session()`, right after popping from PENDING_STORE:
```python
logger.info("Stream opened — session_id=%s", session_id)
```

In `event_generator()`:
- When yielding the `"complete"` event:
  ```python
  logger.info("Stream complete — session_id=%s", session_id)
  ```
- In the outer `except Exception as e` block (the workflow catch-all), before yielding the error:
  ```python
  logger.error("Workflow error — session_id=%s error=%s", session_id, e, exc_info=True)
  ```
- When yielding an `"error"` event from `ExtractionError`, before the `yield`:
  ```python
  logger.warning("Extraction error — session_id=%s kind=%s message=%s", session_id, e.kind, e.message)
  ```
- When the research `run_research()` call raises (the inner try/except around `run_research`), before yielding the error event:
  ```python
  logger.error("Research failed — session_id=%s error=%s", session_id, e, exc_info=True)
  ```

Note: `session_id` is accessible inside `event_generator()` as a closure variable from the outer `stream_session()` scope — no change needed.

---

**backend/app/workflows/session_workflow.py**

Add at top:
```python
import logging
import time
logger = logging.getLogger("super_tutor.workflow")
```

Wrap each agent `.run()` call with timing. Replace the three bare `agent.run()` calls:

Notes step (currently lines 103-108):
```python
logger.info("Workflow step start — step=notes tutoring_type=%s", tutoring_type)
_t = time.perf_counter()
notes_result = self.notes_agent.run(input_text)
logger.info("Workflow step done — step=notes elapsed=%.2fs", time.perf_counter() - _t)
```

Flashcards step (currently inside try, around line 113):
```python
logger.info("Workflow step start — step=flashcards")
_t = time.perf_counter()
flashcard_result = self.flashcard_agent.run(input_text)
logger.info("Workflow step done — step=flashcards elapsed=%.2fs", time.perf_counter() - _t)
```
In the flashcards `except Exception as e`:
```python
logger.error("Workflow step error — step=flashcards error=%s", e, exc_info=True)
```

Quiz step (similarly around line 125):
```python
logger.info("Workflow step start — step=quiz")
_t = time.perf_counter()
quiz_result = self.quiz_agent.run(input_text)
logger.info("Workflow step done — step=quiz elapsed=%.2fs", time.perf_counter() - _t)
```
In the quiz `except Exception as e`:
```python
logger.error("Workflow step error — step=quiz error=%s", e, exc_info=True)
```

Title generation in `_generate_title()`:
- Before `agent.run(text[:800])`:
  ```python
  logger.debug("Title generation start")
  ```
- After a successful title extraction, before returning:
  ```python
  logger.debug("Title generation done — title=%r", title)
  ```
- In the `except Exception` block: already silently passes, add:
  ```python
  logger.warning("Title generation failed, falling back to extract_title")
  ```

---

**backend/app/extraction/chain.py**

Add at top:
```python
import logging
logger = logging.getLogger("super_tutor.extraction")
```

In `extract_content()`:
- After `fetch_via_jina` returns truthy text:
  ```python
  logger.info("Extraction success — layer=jina url=%s chars=%d", url, len(text))
  ```
- After `fetch_via_trafilatura` returns truthy text:
  ```python
  logger.info("Extraction success — layer=trafilatura url=%s chars=%d", url, len(text))
  ```
- After `fetch_via_playwright` returns truthy text:
  ```python
  logger.info("Extraction success — layer=playwright url=%s chars=%d", url, len(text))
  ```
- Before raising `ExtractionError` at the end:
  ```python
  logger.warning("Extraction failed all layers — url=%s kind=%s", url, _classify_failure(url))
  ```

---

**backend/app/agents/research_agent.py**

Add at top:
```python
import logging
import time
logger = logging.getLogger("super_tutor.research")
```

In `run_research()`, before calling `agent.run(input_text)`:
```python
logger.info("Research start — topic=%r focus=%r", topic[:80], focus_prompt[:40] if focus_prompt else "")
_t = time.perf_counter()
```

After parsing `data`:
```python
logger.info(
    "Research done — elapsed=%.2fs content_chars=%d sources=%d",
    time.perf_counter() - _t,
    len(content),
    len(sources),
)
```
  </action>
  <verify>
    1. Run backend: `cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/backend && uvicorn app.main:app --port 8000`
    2. In a separate terminal, POST a session: `curl -s -X POST http://localhost:8000/sessions -H "Content-Type: application/json" -d '{"url":"https://example.com","tutoring_type":"student"}'`
    3. Then open the stream: `curl -s http://localhost:8000/sessions/{session_id}/stream`
    4. Observe backend logs — should see lines for: session created, stream opened, extraction layer, workflow steps with elapsed times, stream complete.
    5. Run: `cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/backend && python -c "from app.routers.sessions import router; from app.workflows.session_workflow import SessionWorkflow; from app.extraction.chain import extract_content; from app.agents.research_agent import run_research; print('imports ok')"` — should print "imports ok" with no errors.
  </verify>
  <done>
    - Each session POST produces a log line with session_id and input_type.
    - Stream open and close (complete or error) produce log lines with session_id.
    - Each workflow agent step produces start + done log lines with elapsed seconds.
    - Extraction chain logs which layer (jina/trafilatura/playwright) succeeded or that all failed.
    - Research logs topic, elapsed time, content chars, and source count.
    - All error paths log at ERROR level with exc_info=True.
    - No new dependencies introduced (stdlib logging + time only).
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. `python -c "from app.main import app; print('ok')"` from `backend/` — no ImportError.
2. Start server and hit `/health` — logs show startup line with provider/model.
3. Trigger a full URL session end-to-end — logs show the complete lifecycle: created → stream open → extraction → notes/flashcards/quiz timing → stream complete.
4. Grep for bare `print(` statements in backend — there should be none added by this plan (logging only).
</verification>

<success_criteria>
- All 6 files modified with import + logger declarations and targeted log statements.
- Log format is uniform: `YYYY-MM-DD HH:MM:SS LEVEL name — message`.
- No new packages in requirements.txt (stdlib only).
- A complete session produces at minimum 8 distinct log lines covering every key layer.
- Errors include exc_info=True for stack traces.
</success_criteria>

<output>
After completion, create `.planning/quick/1-add-minimal-but-required-logging-across-/1-SUMMARY.md`
</output>
