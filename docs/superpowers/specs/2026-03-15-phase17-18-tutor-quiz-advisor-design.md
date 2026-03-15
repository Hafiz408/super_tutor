# Phase 17 & 18 Design: In-Tutor Quiz Mode + Adaptive Intelligence

**Date:** 2026-03-15
**Milestone:** v7.0 Personal Tutor
**Phases:** 17 (In-Tutor Quiz Mode), 18 (Adaptive Intelligence)
**Approach:** Extend existing TutorTeam with QuizMaster and Advisor agents + AgentOS registration

---

## Overview

Extend the existing Agno Team (`TutorTeam`) with two new specialist members:
- **QuizMaster** — delivers MCQs one at a time, evaluates typed answers, tracks Q&A state in conversation history
- **Advisor** — detects weak areas from conversation patterns, surfaces focus suggestions, delegates content generation back through ContentWriter

AgentOS registration is fixed so the TutorTeam is visible in the control plane UI alongside existing agents.

End-to-end testing covers backend (pytest smoke test) and frontend (Playwright browser walkthrough).

---

## Architecture

### Existing Team Structure (Phase 14–16)

```
TutorTeam (coordinator, TeamMode.coordinate)
├── Explainer       — answers from session material
├── Researcher      — extends with Tavily external research
└── ContentWriter   — generates notes/flashcards/quiz inline
```

### Extended Team Structure (Phase 17–18)

```
TutorTeam (coordinator, TeamMode.coordinate)
├── Explainer       — answers from session material
├── Researcher      — extends with Tavily external research
├── ContentWriter   — generates notes/flashcards/quiz inline
├── QuizMaster      — delivers one MCQ at a time, evaluates typed answers  [Phase 17]
└── Advisor         — detects weak areas, surfaces focus suggestions        [Phase 18]
```

---

## Phase 17: QuizMaster Agent

### Agent Design

**File:** `backend/app/agents/tutor_team.py` — new `quiz_master` agent block inside `build_tutor_team()`

**Role:** `"Deliver one multiple-choice question at a time from session material, evaluate the student's typed answer, and guide them through a quiz session"`

**System prompt rules:**
- Generate questions **strictly** from session material — never from general knowledge
- Format: plain text, question on one line, then A/B/C/D options each on their own line
- Deliver **one question at a time** — do not list multiple questions together
- Never repeat a question already in the conversation history (scan history before generating)
- After evaluating a typed answer: explain the correct answer → ask "Want another question?"
- If the user shares Quiz tab results (e.g., "I got 3/5"), acknowledge and calibrate difficulty
- Track implicit quiz state from conversation — no external state needed

**Answer evaluation pattern:**
```
Student: A
QuizMaster: That's correct! [explanation of why A is right and others are wrong]
Want another question?
```

```
Student: B
QuizMaster: Not quite — the correct answer is A. [explanation]
Want another question?
```

### Coordinator Routing Additions

New routing rules added to coordinator `instructions` in `build_tutor_team()`:

```
Routing rules (in priority order):
1. User says "quiz me" / "test me" / "give me a question" / "start a quiz"
   → dispatch to QuizMaster

2. User types a single letter (A, B, C, or D) after a quiz question was the last QuizMaster message
   → dispatch to QuizMaster

3. User says "how many did I get right" / "my quiz score" / "quiz results" / shares Quiz tab result
   → dispatch to QuizMaster

4. All existing rules (Explainer, Researcher, ContentWriter, off-topic reject) remain unchanged
```

**Future-proofing:** Each routing case is labeled and commented in the coordinator prompt — extend by appending new cases without touching existing ones.

### Data Flow

```
User: "quiz me"
  → Coordinator: "Sure, let me quiz you!" (1 sentence acknowledgment)
  → QuizMaster: generates Q1 with A/B/C/D
User: "B"
  → Coordinator: "Let me check that." (1 sentence)
  → QuizMaster: evaluates B, explains, offers next question
```

No new endpoints. No frontend changes. No new DB schema.

---

## Phase 18: Advisor Agent

### Agent Design

**File:** `backend/app/agents/tutor_team.py` — new `advisor` agent block inside `build_tutor_team()`

**Role:** `"Analyze the student's conversation patterns to identify weak areas and surface proactive focus suggestions"`

**System prompt rules:**
- Read the full conversation history to detect: repeated questions on the same concept, incorrectly answered quiz questions, topics the student asked to explain multiple times
- Surface **named focus areas** — concrete concept names, not vague "you struggled"
- Offer targeted content via explicit suggestion: "Want me to generate extra flashcards on [concept]?"
- Do NOT generate content itself — the coordinator will route to ContentWriter if the student accepts
- Keep suggestions concise: 2-3 sentences max
- If no clear weak areas found: give encouraging summary instead of forced suggestions

**Struggle detection heuristics (read from conversation history):**
- ≥2 wrong quiz answers on related concepts → flag as weak area
- Same concept phrase appears in ≥3 student messages → flag as repeated confusion
- Student explicitly says "I don't understand X" → immediately flag X

### Coordinator Routing Additions

```
5. After QuizMaster evaluates an answer AND ≥3 quiz turns have occurred AND ≥2 were wrong
   → proactively dispatch Advisor (coordinator injects: "The student has answered several questions — check for patterns")

6. User says "how am I doing" / "what should I focus on" / "where am I weak"
   → dispatch to Advisor

7. Advisor identifies a weak area and student says "yes" / "sure" / accepts the suggestion
   → dispatch to ContentWriter with topic context from Advisor's message
```

### Future-Proofing

- Advisor role is cleanly scoped to **diagnosis only** — content generation stays in ContentWriter
- When Phase 17's quiz state is later persisted to SQLite (future UX improvement), the Advisor prompt can be extended to load structured scores without changing the agent's role
- Advisor can be upgraded to a smarter/larger model independently (model param in `build_tutor_team()` signature)

---

## AgentOS Registration

### Current Gap

`main.py` `_wrap_with_agentos()` contains:
```python
# TutorTeam (Phase 14+) is not registered here — Teams are traced via db= injection
# at request time.
```

Real per-request traces DO appear in AgentOS via `db=traces_db` injection. The gap is that the Team has no representative entry in the AgentOS playground UI.

### Fix

Build a placeholder TutorTeam in `_wrap_with_agentos()` and register it:

```python
placeholder_team = build_tutor_team(
    source_content="[AgentOS placeholder — not a real session]",
    notes="",
    tutoring_type="micro_learning",
    db=traces_db,
    session_topic="[placeholder]",
)
```

Pass via `teams=[placeholder_team]` if agno's `AgentOS` constructor accepts `teams=[]`.
Fallback: if `teams=` is not supported in the installed agno version, register the Team's member agents individually under descriptive names (`TutorTeam/Explainer`, etc.).

Update the inline comment to remove the "not registered" note.

---

## Testing

### Backend Smoke Test

**File:** `backend/tests/test_tutor_e2e.py`

**Flow:**
1. Create topic session via `POST /sessions/topic`
2. Wait for generation to complete (poll `GET /sessions/{id}/status`)
3. Send `"quiz me"` to `POST /tutor/{id}/stream` → assert response contains A/B/C/D options
4. Send `"A"` to `POST /tutor/{id}/stream` → assert response contains evaluation language ("correct"/"correct answer is")
5. Send `"what should I focus on"` → assert Advisor-style response (mentions a concept)

### Playwright Browser Test

**File:** `frontend/tests/tutor-quiz.spec.ts` (or `e2e/tutor-quiz.spec.ts`)

**Flow:**
1. Navigate to home page
2. Select "Topic" tab, enter test topic (e.g., "photosynthesis"), choose "Micro Learning", submit
3. Wait for study page to load (notes visible)
4. Click "Personal Tutor" tab
5. Assert intro message appears (wait for streaming to complete)
6. Type "quiz me", click Send
7. Wait for MCQ response, assert A/B/C/D options present in chat
8. Type "A", click Send
9. Assert evaluation response appears
10. Screenshot final state

---

## Requirements Mapping

| Requirement | Phase | Agent | Done when |
|-------------|-------|-------|-----------|
| QUIZ-01 | 17 | QuizMaster | "quiz me" → MCQ with A/B/C/D delivered |
| QUIZ-02 | 17 | QuizMaster | Typed answer → evaluation + explanation |
| QUIZ-03 | 17 | QuizMaster | Quiz tab result shared → acknowledged + difficulty adjusted |
| TEAM-06 | 17 | Coordinator | New routing rules for QuizMaster |
| TEAM-07 | 18 | Coordinator | Routing rules for Advisor + ContentWriter handoff |
| QUIZ-04 | 18 | Advisor | Quiz score patterns detected from history |
| ADVISE-01 | 18 | Advisor | Named weak areas surfaced in conversation |
| ADVISE-02 | 18 | Advisor | Targeted content offer → ContentWriter dispatched |
| ADVISE-03 | 18 | Advisor | Focus suggestions triggered after quiz struggle pattern |

---

## Success Criteria

### Phase 17
1. `"quiz me"` in tutor chat → response contains a question with A, B, C, D options
2. Typing `"A"` (or any letter) → QuizMaster evaluates and explains before offering next question
3. Sharing `"I got 3/5 on my quiz"` → QuizMaster acknowledges and calibrates
4. QuizMaster never repeats a question already in the conversation

### Phase 18
1. After ≥2 wrong quiz answers → Advisor proactively surfaces a named focus area
2. `"what should I focus on"` → Advisor responds with specific concept names from session material
3. Advisor suggestion accepted → ContentWriter generates targeted content inline
4. Advisor gives encouraging summary (not empty response) when no weak areas detected

### AgentOS
1. TutorTeam visible in AgentOS playground UI alongside existing agents
2. Per-request traces continue to appear as before

### End-to-End Tests
1. Backend smoke test passes (all 5 assertions)
2. Playwright test completes without error, screenshot captured
