# Phase 2: Topic Description Path - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a second ingestion path: user provides a topic description (no URL), AI researches it via web search and synthesizes content, then produces the same tabbed study output (notes, flashcards, quiz) as the URL path. The study page shows an AI-researched disclaimer with clickable source links. Creating new agent types, changing the study page layout, or adding search/filtering are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Topic input UX
- Toggle/switch on the landing page to swap between URL mode and topic mode
- Switching modes clears the input field (clean slate)
- Topic mode shows an open-ended placeholder prompt (e.g. "Describe a topic you want to learn about…")
- Topic mode retains the same focus prompt field and tutoring mode selector as the URL path — no differences in the form structure
- Loading/progress page is reused from the URL path, but step labels are topic-specific (e.g. "Researching topic…" instead of "Extracting content…")

### Research approach
- Web search + synthesis: AI queries the web, pulls real sources, synthesizes into a content body
- 3–5 sources per topic
- Synthesized research text is transient — passed through to existing agents, not stored separately
- Reuse existing Phase 1 agents (notes, flashcard, quiz) — they receive synthesized research text instead of extracted URL content
- A new upstream research agent handles web search and synthesis before handing off to existing agents

### Source disclaimer design
- Disclaimer appears only on topic-description sessions (URL sessions are unaffected)
- Clickable source links (the actual URLs used) are shown alongside the disclaimer
- Disclaimer placement and tone are at Claude's discretion — should be visible without disrupting the study flow

### Edge case handling
- Vague/broad topics (e.g. "science"): proceed with generation, but surface a warning to the user that broad topics may produce general content
- Web research failure (search API error, no results): fall back to LLM knowledge, but notify the user that live research was unavailable and content was generated from AI knowledge
- Thin content (obscure topic, few sources found): create the session but surface a note in the study page that limited source material was available
- Input validation minimum: Claude's discretion — prevent empty/accidental submissions without being unnecessarily restrictive

### Claude's Discretion
- Exact disclaimer placement on the study page (banner, per-tab, or header badge)
- Disclaimer tone (neutral vs. friendly)
- Input validation threshold (character count, word count, or other)

</decisions>

<specifics>
## Specific Ideas

No specific product references or "I want it like X" moments — open to standard approaches for all areas delegated to Claude's discretion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-topic-description-path*
*Context gathered: 2026-02-27*
