# Super Tutor

## What This Is

Super Tutor is an AI-powered tutoring web app that creates personalized study sessions from any URL or topic description. Users choose a learning style, and the AI generates a complete study package — structured notes, flashcards, and a quiz — all accessible on a single page with an in-session AI chat assistant for asking questions about the material.

## Core Value

A user gives a topic (URL or description), picks how they want to learn, and gets a complete, ready-to-study session in minutes — no account needed, no friction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can create a study session by providing an article/doc URL + focus prompt
- [ ] User can create a study session by providing a topic description (AI deep-researches it)
- [ ] User selects a tutoring type (Micro Learning / Teaching a Kid / Advanced) that adapts tone and complexity of all generated content
- [ ] AI generates structured notes from the session content
- [ ] AI generates flashcards from the session content
- [ ] AI generates a multiple-choice quiz (4 options per question) from the session content
- [ ] All study materials are presented on one page (tabbed: Notes | Flashcards | Quiz)
- [ ] Flashcard and quiz completion state is tracked within the session
- [ ] An in-session AI chat lets the user ask questions about the material being studied
- [ ] Sessions are ephemeral — no accounts required in v1

### Out of Scope

- User accounts and authentication — deferred to v2 to keep v1 frictionless
- Cross-session progress tracking — requires accounts, deferred
- YouTube / video URL support — text-based content only for v1
- Mixed quiz formats (true/false, short answer) — multiple choice only
- Export to PDF / Anki — study in-app only for v1
- Mobile app — web-first

## Context

- **UI Library**: OAT UI (oat.ink) — design system chosen by the developer
- **Backend**: FastAPI (Python) — handles AI pipeline, content extraction, and session generation
- **AI Pipeline**:
  - URL path: Scrapes/extracts text from article or documentation page, applies user's focus prompt to shape the output
  - Topic path: Performs deep research on the provided description to gather source material
  - All paths then generate notes + flashcards + quiz tuned to the selected tutoring type
- **No auth in v1**: Sessions are in-browser and ephemeral — simplifies v1 considerably

## Constraints

- **Tech Stack**: OAT UI (frontend) + FastAPI (backend) — both decided upfront
- **Content Sources**: Articles and documentation URLs only — no video, no paywalled content
- **Session Storage**: Ephemeral (browser session) — no database persistence in v1
- **Quiz Format**: Multiple choice only — 4 options per question, AI selects correct answer

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No accounts in v1 | Reduces scope, eliminates auth friction for first users | — Pending |
| Tone-only tutoring types (not structural) | Simpler to implement, same output shape for all types | — Pending |
| URL input: articles/docs only | Avoids video transcription complexity, handles majority of study material | — Pending |
| Multiple choice quiz only | Simpler to generate and grade reliably with AI | — Pending |
| OAT UI + FastAPI | Developer preference and familiarity | — Pending |

---
*Last updated: 2026-02-18 after initialization*
