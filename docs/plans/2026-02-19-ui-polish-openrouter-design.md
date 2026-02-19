# Design: UI Polish + OpenRouter Provider

**Date:** 2026-02-19
**Scope:** Frontend UI redesign (globals.css + OAT UI) + backend generic API key + OpenRouter provider

---

## Part 1 — Frontend UI

### Problem
All five pages use raw HTML with zero OAT UI classes and scattered inline styles. OAT UI ships `--primary`, `--muted`, `--border`, `--card`, `--radius-*`, `--space-*`, `--shadow-*` variables plus `.container`, `.card`, `.flex`, `.vstack`, `.hstack`, `.badge`, `.spinner` utilities — none are used.

### Approach
**globals.css design system on top of OAT UI.** Define ~60 lines of component classes in `globals.css` that reference OAT UI tokens. Replace inline styles and bare HTML across all five pages with these classes + OAT UI layout utilities.

### Component Classes (globals.css additions)
- `.btn` — base button (padding, radius, transition, cursor)
- `.btn-primary` — filled with `--primary` background
- `.btn-ghost` — transparent with `--foreground` border
- `.input-field` — text/url/textarea input using `--input` bg, `--border` border, `--radius-medium`
- `.mode-card` — tutoring mode selector card, hover shadow, `--radius-medium`
- `.mode-card[aria-selected="true"]` — `--primary` border to indicate selection
- `.nav-link` — sidebar nav link, hover `--faint` bg
- `.nav-link-active` — bold, `--faint` bg, `--primary` left accent
- `.quiz-option` — answer button, `--border`, hover lift
- `.quiz-option-correct` — `--success` bg + border
- `.quiz-option-wrong` — `--danger` bg + border
- `.progress-bar-track` / `.progress-bar-fill` — SSE loading bar using `--primary`

### Page Changes
| Page | Key changes |
|------|-------------|
| `layout.tsx` | System font stack, `--background` body color |
| `page.tsx` | `.container` hero, `.card` feature grid, `.btn-primary` CTA |
| `create/page.tsx` | `.mode-card` selector, `.input-field` inputs, `.btn-primary` submit, `--danger` error |
| `loading/page.tsx` | `.spinner`, `.progress-bar-*`, `--muted-foreground` subtext |
| `study/[sessionId]/page.tsx` | Sidebar `.nav-link` states, `.card` flashcards, `.quiz-option` feedback |

---

## Part 2 — Backend: Generic API Key + OpenRouter

### Problem
Config has three provider-specific keys (`openai_api_key`, `anthropic_api_key`, `groq_api_key`). Each new provider requires a new env var. OpenRouter support is missing.

### Approach
Single `AGENT_API_KEY` env var — passed explicitly to whichever provider is active. One key to set regardless of provider.

### Config changes (`config.py`)
Remove: `openai_api_key`, `anthropic_api_key`, `groq_api_key`
Add: `agent_api_key: str = ""`

### Model factory changes (`model_factory.py`)
- All branches pass `api_key=settings.agent_api_key`
- New `openrouter` branch: `OpenAIChat(id=model_id, api_key=settings.agent_api_key, base_url="https://openrouter.ai/api/v1")`

### .env usage (identical pattern for any provider)
```
AGENT_PROVIDER=openrouter        # openai | anthropic | groq | openrouter
AGENT_MODEL=openai/gpt-4o        # any model ID valid for the chosen provider
AGENT_API_KEY=sk-or-...          # the single key for the active provider
```

### Files modified
- `backend/app/config.py`
- `backend/app/agents/model_factory.py`
