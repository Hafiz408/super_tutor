---
phase: 16-frontend-tutor-tab
plan: "01"
subsystem: ui
tags: [react, typescript, nextjs, sse, localStorage, streaming]

# Dependency graph
requires:
  - phase: 15-full-specialist-roster-guardrails
    provides: "POST /tutor/{sessionId}/stream endpoint with token/error/rejected SSE events"
provides:
  - "Tab type union extended with 'tutor'"
  - "TAB_ICONS graduation-cap entry"
  - "Desktop sidebar shows Personal Tutor as 4th nav item"
  - "Mobile bottom bar shows Tutor as 4th tab"
  - "tutorHistory state with localStorage initialization"
  - "isTutorStreaming independent of isStreaming"
  - "sendTutorMessage() SSE streaming function"
affects: [16-02-tutor-ui-panel, 17-content-envelope, 18-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Independent tutor state namespace (tutor_history:, tutor_intro_seen:) separate from chat: namespace"
    - "SSE streaming with token/error/rejected event triaging — mirrors existing chat sendMessage pattern"
    - "Sentinel intro string to satisfy backend min_length=1 constraint when sending empty trigger"

key-files:
  created: []
  modified:
    - "frontend/src/app/study/[sessionId]/page.tsx"

key-decisions:
  - "TAB_LABELS record used for mobile bar (short labels) while inline ternary used for desktop sidebar (Personal Tutor label)"
  - "tutorHistory localStorage key tutor_history:{sessionId} is independent of chat:{sessionId} namespace — no collision"
  - "isTutorStreaming is entirely separate from isStreaming — existing floating chat panel state is untouched"
  - "Sentinel fallback string handles backend TutorStreamRequest min_length=1 when intro triggered with empty input"

patterns-established:
  - "Pattern: tutor state variables declared as a named block after chat panel state, clearly delimited by comment"
  - "Pattern: sendTutorMessage mirrors sendMessage structure (reader loop, buffer, SSE parse) for maintainability"

requirements-completed: [TUTOR-01, TUTOR-04]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 16 Plan 01: Frontend Tutor Tab — State Foundation Summary

**Tab union extended to include "tutor", desktop/mobile nav wired, tutorHistory localStorage state and sendTutorMessage() SSE function added — independent of existing floating chat panel**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T08:34:07Z
- **Completed:** 2026-03-15T08:35:43Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Extended `Tab = "notes" | "flashcards" | "quiz" | "tutor"` and added graduation-cap SVG icon
- Added `TAB_LABELS` record; desktop sidebar shows "Personal Tutor", mobile bar shows "Tutor"
- Added independent tutor state: `tutorHistory` (localStorage-initialized), `tutorIntroSeen`, `isTutorStreaming`, `tutorReaderRef`, `tutorIntroTriggeredRef`
- Added localStorage persistence useEffect for `tutorHistory` with quota-error guard
- Implemented `sendTutorMessage()` with full token accumulation, `error` event display, and `reason` (guardrail rejection) event handling

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Extend Tab union, nav entries, tutor state, and sendTutorMessage()** - `c5109a2` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `frontend/src/app/study/[sessionId]/page.tsx` - Tab union, TAB_ICONS, TAB_LABELS, nav arrays, tutor state variables, localStorage effect, sendTutorMessage()

## Decisions Made
- `TAB_LABELS` record used for mobile bar labels (short "Tutor") while the desktop sidebar uses an inline ternary to render "Personal Tutor" — avoids a separate record for a single special case
- `tutorHistory:` and `tutor_intro_seen:` localStorage keys are namespaced separately from `chat:` to prevent any collision
- `isTutorStreaming` is a wholly independent state variable — `isStreaming` (floating chat panel) is never touched
- Sentinel string `"Hello! Please introduce yourself and your capabilities."` sent when `userMessage.trim()` is empty, satisfying backend `min_length=1`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `sendTutorMessage()` is ready for consumption by the Tutor tab UI panel (Plan 02)
- `tutorHistory`, `isTutorStreaming`, `tutorIntroSeen`, `tutorIntroTriggeredRef` are all available in scope for Plan 02's render block
- No blockers

---
*Phase: 16-frontend-tutor-tab*
*Completed: 2026-03-15*
