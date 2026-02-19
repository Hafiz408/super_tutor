# UI Polish + OpenRouter Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle all five frontend pages using OAT UI variables + a globals.css component system; consolidate backend API keys into a single `AGENT_API_KEY`; add OpenRouter as a fourth provider.

**Architecture:** globals.css gains ~70 lines of component classes (`.btn`, `.mode-card`, `.nav-link`, `.quiz-option`, etc.) that reference OAT UI CSS custom properties (`--primary`, `--border`, `--muted-foreground`, etc.). Each page's inline styles and bare HTML are replaced with these classes + OAT UI layout utilities (`.container`, `.card`, `.row`, `.vstack`, `.hstack`). Backend config collapses three provider-specific key fields into `agent_api_key`, which `model_factory.py` passes explicitly to all four provider branches.

**Tech Stack:** Next.js 15, OAT UI (CDN), Tailwind v4 (already installed), Python/FastAPI, Agno, Pydantic Settings

---

## Task 1: Migrate backend config to generic agent_api_key

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/tests/test_config.py` (create)

**Step 1: Write the failing test**

Create `backend/tests/test_config.py`:
```python
"""Tests for Settings: verifies generic agent_api_key replaces provider-specific keys."""
from pydantic_settings import BaseSettings


def test_settings_has_agent_api_key():
    from app.config import Settings
    fields = Settings.model_fields
    assert "agent_api_key" in fields


def test_settings_no_provider_specific_keys():
    from app.config import Settings
    fields = Settings.model_fields
    assert "openai_api_key" not in fields
    assert "anthropic_api_key" not in fields
    assert "groq_api_key" not in fields


def test_agent_api_key_defaults_to_empty_string():
    from app.config import Settings
    s = Settings()
    assert s.agent_api_key == ""
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_config.py -v
```
Expected: FAIL — `agent_api_key not in fields` and old keys still present.

**Step 3: Update config.py**

Replace the three provider-specific keys with one generic key:
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    # AI provider config — set all three in .env
    agent_provider: str = "openai"     # openai | anthropic | groq | openrouter
    agent_model: str = "gpt-4o"        # model ID valid for chosen provider
    agent_api_key: str = ""            # single key for whichever provider is active

    # URL extraction
    jina_api_key: str = ""

    # CORS
    allowed_origins: List[str] = ["http://localhost:3000"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_config.py -v
```
Expected: 3 PASS

Also verify existing extraction tests still pass (they mock settings independently):
```bash
cd backend && python -m pytest tests/test_extraction.py -v
```
Expected: 8 PASS

**Step 5: Commit**

```bash
cd backend && git add app/config.py tests/test_config.py
git commit -m "refactor(config): replace provider-specific keys with generic agent_api_key"
```

---

## Task 2: Update model_factory + add OpenRouter provider

**Files:**
- Modify: `backend/app/agents/model_factory.py`

**Step 1: Update model_factory.py**

Pass `api_key=settings.agent_api_key` to every branch and add the `openrouter` branch. OpenRouter uses the same `OpenAIChat` class but with a custom `base_url`:

```python
from app.config import get_settings


def get_model():
    settings = get_settings()
    provider = settings.agent_provider.lower()
    model_id = settings.agent_model
    api_key = settings.agent_api_key

    if provider == "anthropic":
        from agno.models.anthropic import Claude
        return Claude(id=model_id, api_key=api_key)
    elif provider == "groq":
        from agno.models.groq import Groq
        return Groq(id=model_id, api_key=api_key)
    elif provider == "openrouter":
        from agno.models.openai import OpenAIChat
        return OpenAIChat(
            id=model_id,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )
    else:
        # Default: OpenAI
        from agno.models.openai import OpenAIChat
        return OpenAIChat(id=model_id, api_key=api_key)
```

**Step 2: Smoke test — verify imports and startup**

```bash
cd backend && python -c "
from app.agents.model_factory import get_model
from app.config import get_settings
s = get_settings()
print('Provider:', s.agent_provider)
print('Model:', s.agent_model)
print('Key set:', bool(s.agent_api_key))
print('Import OK')
"
```
Expected: prints provider/model/key info and `Import OK` with no exceptions.

**Step 3: Commit**

```bash
cd backend && git add app/agents/model_factory.py
git commit -m "feat(model-factory): add OpenRouter provider + pass agent_api_key to all providers"
```

---

## Task 3: globals.css — OAT UI component classes

**Files:**
- Modify: `frontend/src/app/globals.css`

**Step 1: Replace globals.css content**

Keep the existing Tailwind v4 import and base tokens, then append all component classes:

```css
@import "tailwindcss";

/* ─── Base ─────────────────────────────────────────────────────── */
body {
  font-family: var(--font-sans);
  background: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
}

/* ─── Buttons ───────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-medium);
  font-weight: var(--font-medium);
  font-size: var(--text-2);
  cursor: pointer;
  transition: var(--transition-fast);
  border: 1px solid transparent;
  text-decoration: none;
  white-space: nowrap;
  line-height: 1;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.88;
}

.btn-ghost {
  background: transparent;
  color: var(--foreground);
  border-color: var(--border);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--faint);
}

/* ─── Form inputs ───────────────────────────────────────────────── */
.input-field {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-medium);
  background: var(--input);
  color: var(--foreground);
  font-size: var(--text-2);
  transition: border-color var(--transition-fast);
  font-family: var(--font-sans);
}

.input-field:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
}

.input-field::placeholder {
  color: var(--muted-foreground);
  opacity: 0.7;
}

/* ─── Mode selector cards ───────────────────────────────────────── */
.mode-card {
  border: 2px solid var(--border);
  border-radius: var(--radius-medium);
  padding: var(--space-4);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  background: var(--card);
  color: var(--card-foreground);
}

.mode-card:hover {
  border-color: var(--muted-foreground);
  box-shadow: var(--shadow-small);
}

.mode-card[aria-selected="true"] {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary);
  background: color-mix(in srgb, var(--primary) 5%, var(--card));
}

/* ─── Sidebar nav links ─────────────────────────────────────────── */
.nav-link {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-small);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: var(--text-2);
  color: var(--muted-foreground);
  transition: background var(--transition-fast), color var(--transition-fast);
  text-transform: capitalize;
  text-decoration: none;
  font-family: var(--font-sans);
}

.nav-link:hover {
  background: var(--faint);
  color: var(--foreground);
}

.nav-link-active {
  background: var(--faint);
  color: var(--foreground);
  font-weight: var(--font-semibold);
}

/* ─── Quiz option buttons ───────────────────────────────────────── */
.quiz-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-medium);
  background: var(--card);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
  font-size: var(--text-2);
  font-family: var(--font-sans);
  color: var(--foreground);
}

.quiz-option:hover:not(:disabled) {
  border-color: var(--muted-foreground);
  background: var(--faint);
}

.quiz-option:disabled {
  cursor: default;
}

.quiz-option-correct {
  background: color-mix(in srgb, var(--success) 12%, var(--card));
  border-color: var(--success);
}

.quiz-option-wrong {
  background: color-mix(in srgb, var(--danger) 10%, var(--card));
  border-color: var(--danger);
}

/* ─── SSE progress bar ──────────────────────────────────────────── */
.progress-bar-track {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--faint);
  z-index: var(--z-modal);
}

.progress-bar-fill {
  height: 100%;
  background: var(--primary);
  transition: width 400ms ease-in-out;
}

/* ─── Danger alert ──────────────────────────────────────────────── */
.alert-danger {
  padding: var(--space-4);
  border-radius: var(--radius-medium);
  border: 1px solid var(--danger);
  background: color-mix(in srgb, var(--danger) 7%, var(--background));
  color: var(--danger-foreground);
}

/* ─── Study page sidebar ────────────────────────────────────────── */
.study-sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: var(--space-6) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-height: 100vh;
}

/* ─── Prose / markdown content ──────────────────────────────────── */
.prose h1, .prose h2, .prose h3, .prose h4 {
  font-weight: var(--font-semibold);
  margin-top: var(--space-6);
  margin-bottom: var(--space-2);
  line-height: 1.3;
}

.prose h1 { font-size: var(--text-5); }
.prose h2 { font-size: var(--text-4); }
.prose h3 { font-size: var(--text-3); }

.prose p {
  margin-bottom: var(--space-4);
  line-height: var(--leading-normal);
  color: var(--foreground);
}

.prose ul, .prose ol {
  padding-left: var(--space-6);
  margin-bottom: var(--space-4);
}

.prose li {
  margin-bottom: var(--space-1);
  line-height: var(--leading-normal);
}

.prose strong {
  font-weight: var(--font-semibold);
}

.prose code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--faint);
  padding: 0.1em 0.35em;
  border-radius: var(--radius-small);
}
```

**Step 2: Run TypeScript check (no TS errors expected — this is CSS only)**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```
Expected: `TS OK`

**Step 3: Commit**

```bash
cd frontend && git add src/app/globals.css
git commit -m "feat(ui): add OAT UI component classes to globals.css"
```

---

## Task 4: Landing page + layout

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/page.tsx`

**Step 1: Update layout.tsx**

Add `lang` and `suppressHydrationWarning` (prevents hydration mismatch from browser extensions) and ensure OAT UI link is present:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Super Tutor",
  description: "Turn any article into a complete study session",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://oat.ink/oat.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Step 2: Update page.tsx (landing)**

Replace bare HTML with `.container`, OAT UI `.card`, `.row`, `.btn-primary`:

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section
        className="container vstack items-center text-center"
        style={{ paddingTop: "var(--space-18)", paddingBottom: "var(--space-18)" }}
      >
        <h1
          style={{
            fontSize: "var(--text-7)",
            fontWeight: "var(--font-bold)",
            lineHeight: "1.15",
            maxWidth: "640px",
            letterSpacing: "-0.02em",
          }}
        >
          Turn any article into a complete study session
        </h1>
        <p
          style={{
            fontSize: "var(--text-3)",
            color: "var(--muted-foreground)",
            maxWidth: "480px",
            marginTop: "var(--space-5)",
            marginBottom: "var(--space-8)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          Paste a URL, pick your learning style, and get structured notes,
          flashcards, and a quiz — all in minutes.
        </p>
        <Link
          href="/create"
          className="btn btn-primary"
          style={{ fontSize: "var(--text-3)", padding: "var(--space-4) var(--space-8)" }}
        >
          Start studying →
        </Link>
      </section>

      {/* Feature cards */}
      <section
        className="container"
        style={{
          paddingTop: "var(--space-12)",
          paddingBottom: "var(--space-16)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h2
          className="text-center"
          style={{
            fontSize: "var(--text-4)",
            fontWeight: "var(--font-semibold)",
            marginBottom: "var(--space-8)",
          }}
        >
          Three ways to learn
        </h2>
        <div className="row" style={{ gap: "var(--space-4)" }}>
          {[
            { title: "Micro Learning", body: "Short, punchy bullets. Just the essentials." },
            { title: "Teaching a Kid", body: "Plain language, everyday analogies. No jargon." },
            { title: "Advanced", body: "Full depth. Technical terminology. Graduate-level nuance." },
          ].map((card) => (
            <article
              key={card.title}
              className="card col-4"
              style={{ padding: "var(--space-6)" }}
            >
              <h3
                style={{
                  fontWeight: "var(--font-semibold)",
                  marginBottom: "var(--space-2)",
                  fontSize: "var(--text-3)",
                }}
              >
                {card.title}
              </h3>
              <p style={{ color: "var(--muted-foreground)", fontSize: "var(--text-2)" }}>
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
```

**Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```

**Step 4: Commit**

```bash
cd frontend && git add src/app/layout.tsx src/app/page.tsx
git commit -m "feat(ui): restyle landing page with OAT UI classes"
```

---

## Task 5: Create form page

**Files:**
- Modify: `frontend/src/app/create/page.tsx`

**Step 1: Update create/page.tsx**

Replace inline styles and bare HTML with component classes. All logic stays identical — only presentation changes:

```tsx
"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TutoringType, SessionRequest } from "@/types/session";

const TUTORING_MODES: { id: TutoringType; label: string; description: string }[] = [
  { id: "micro_learning", label: "Micro Learning", description: "Short, punchy bullets. Just the essentials, fast." },
  { id: "teaching_a_kid", label: "Teaching a Kid", description: "Plain language and everyday analogies. No jargon." },
  { id: "advanced", label: "Advanced", description: "Full technical depth for graduate-level understanding." },
];

const ERROR_MESSAGES: Record<string, { top: string; pointer: string }> = {
  paywall: { top: "We couldn't read that page", pointer: "This looks like a paywalled article. Try pasting the article text below." },
  invalid_url: { top: "We couldn't read that page", pointer: "The URL doesn't look valid. Check it and try again, or paste the article text." },
  empty: { top: "We couldn't read that page", pointer: "The page loaded but didn't have enough readable text. You can paste the content below." },
  unreachable: { top: "We couldn't reach that page", pointer: "The site may be down or blocked. Paste the article text below to continue." },
};

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const errorParam = searchParams.get("error");
  const tutoringTypeParam = searchParams.get("tutoring_type") as TutoringType | null;
  const focusPromptParam = searchParams.get("focus_prompt") ?? "";

  const [selectedMode, setSelectedMode] = useState<TutoringType | null>(
    errorParam && tutoringTypeParam ? tutoringTypeParam : null
  );
  const [url, setUrl] = useState("");
  const [focusPrompt, setFocusPrompt] = useState(errorParam ? focusPromptParam : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKind, setErrorKind] = useState<string | null>(errorParam);
  const [pasteText, setPasteText] = useState("");

  const errorMessages = errorKind ? ERROR_MESSAGES[errorKind] ?? ERROR_MESSAGES.empty : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMode) return;
    setIsSubmitting(true);
    setErrorKind(null);

    const payload: SessionRequest = {
      tutoring_type: selectedMode,
      focus_prompt: focusPrompt || undefined,
      ...(pasteText ? { paste_text: pasteText } : { url }),
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Server error");
      const { session_id } = await res.json();
      router.push(
        `/loading?session_id=${session_id}&tutoring_type=${selectedMode}&focus_prompt=${encodeURIComponent(focusPrompt)}`
      );
    } catch {
      setUrl("");
      setErrorKind("empty");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: "640px", paddingTop: "var(--space-12)", paddingBottom: "var(--space-12)" }}>
      <h1 style={{ fontSize: "var(--text-5)", fontWeight: "var(--font-bold)", marginBottom: "var(--space-8)" }}>
        Create a study session
      </h1>

      <form onSubmit={handleSubmit} className="vstack" style={{ gap: "var(--space-6)" }}>

        {/* Tutoring mode cards */}
        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontSize: "var(--text-2)", fontWeight: "var(--font-medium)", marginBottom: "var(--space-3)", color: "var(--muted-foreground)" }}>
            How do you want to learn?
          </legend>
          <div className="vstack" style={{ gap: "var(--space-2)" }}>
            {TUTORING_MODES.map((mode) => (
              <label key={mode.id} style={{ cursor: "pointer" }}>
                <input
                  type="radio"
                  name="tutoring_mode"
                  value={mode.id}
                  checked={selectedMode === mode.id}
                  onChange={() => setSelectedMode(mode.id)}
                  style={{ display: "none" }}
                />
                <div className="mode-card" aria-selected={selectedMode === mode.id}>
                  <p style={{ fontWeight: "var(--font-semibold)", marginBottom: "var(--space-1)", fontSize: "var(--text-2)" }}>
                    {mode.label}
                  </p>
                  <p style={{ fontSize: "var(--text-1)", color: "var(--muted-foreground)" }}>
                    {mode.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* URL input */}
        {!pasteText && (
          <div className="vstack" style={{ gap: "var(--space-2)" }}>
            <label htmlFor="url" style={{ fontSize: "var(--text-2)", fontWeight: "var(--font-medium)" }}>
              Article or doc URL
            </label>
            <input
              id="url"
              type="url"
              className="input-field"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required={!pasteText}
            />
          </div>
        )}

        {/* Inline error + paste fallback */}
        {errorMessages && (
          <div className="alert-danger vstack" style={{ gap: "var(--space-3)" }} role="alert">
            <p style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-2)" }}>{errorMessages.top}</p>
            <p style={{ fontSize: "var(--text-1)" }}>{errorMessages.pointer}</p>
            <label htmlFor="paste_text" style={{ fontSize: "var(--text-2)", fontWeight: "var(--font-medium)" }}>
              Paste the article text instead
            </label>
            <textarea
              id="paste_text"
              className="input-field"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste the full article text here (at least a few paragraphs)..."
              rows={8}
              minLength={200}
              maxLength={50000}
              style={{ resize: "vertical" }}
            />
            {pasteText.length > 0 && pasteText.length < 200 && (
              <p style={{ fontSize: "var(--text-1)", color: "var(--danger)" }}>
                Please paste at least a few paragraphs for best results.
              </p>
            )}
          </div>
        )}

        {/* Focus prompt */}
        <div className="vstack" style={{ gap: "var(--space-2)" }}>
          <label htmlFor="focus_prompt" style={{ fontSize: "var(--text-2)", fontWeight: "var(--font-medium)" }}>
            What do you want to focus on?{" "}
            <span style={{ color: "var(--muted-foreground)", fontWeight: "var(--font-normal)" }}>(optional)</span>
          </label>
          <input
            id="focus_prompt"
            type="text"
            className="input-field"
            value={focusPrompt}
            onChange={(e) => setFocusPrompt(e.target.value)}
            placeholder="e.g. 'key algorithms', 'historical causes', 'main arguments'"
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!selectedMode || isSubmitting || (pasteText.length > 0 && pasteText.length < 200)}
          style={{ alignSelf: "flex-start", fontSize: "var(--text-2)", padding: "var(--space-3) var(--space-6)" }}
        >
          {isSubmitting ? "Starting..." : "Generate my study session →"}
        </button>
      </form>

      <div style={{ marginTop: "var(--space-8)" }}>
        <Link href="/" className="btn btn-ghost" style={{ fontSize: "var(--text-1)" }}>
          ← Back
        </Link>
      </div>
    </main>
  );
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```

**Step 3: Commit**

```bash
cd frontend && git add src/app/create/page.tsx
git commit -m "feat(ui): restyle create form with OAT UI classes"
```

---

## Task 6: Loading page

**Files:**
- Modify: `frontend/src/app/loading/page.tsx`

**Step 1: Update loading/page.tsx**

Replace inline styles with component classes + OAT UI utilities. All SSE logic unchanged:

```tsx
"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SSE_STEPS, ProgressEvent, CompleteEvent, ErrorEvent } from "@/types/session";

const PROGRESS_WEIGHTS = [10, 40, 70, 100] as const;

export default function LoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const tutoringType = searchParams.get("tutoring_type") ?? "";
  const focusPrompt = searchParams.get("focus_prompt") ?? "";

  const [currentMessage, setCurrentMessage] = useState<string>(SSE_STEPS[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/create");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const es = new EventSource(`${apiUrl}/sessions/${sessionId}/stream`);
    esRef.current = es;

    es.addEventListener("progress", (e: MessageEvent) => {
      const data: ProgressEvent = JSON.parse(e.data);
      setCurrentMessage(data.message);
      setStepIndex((i) => Math.min(i + 1, SSE_STEPS.length - 1));
    });

    es.addEventListener("complete", (e: MessageEvent) => {
      const data: CompleteEvent = JSON.parse(e.data);
      es.close();
      setStepIndex(SSE_STEPS.length - 1);
      setTimeout(() => router.push(`/study/${data.session_id}`), 400);
    });

    es.addEventListener("error", (e: MessageEvent) => {
      es.close();
      try {
        const data: ErrorEvent = JSON.parse(e.data);
        router.push(`/create?error=${data.kind}&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}`);
      } catch {
        router.push(`/create?error=empty&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}`);
      }
    });

    es.onerror = () => {
      es.close();
      router.push(`/create?error=unreachable&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}`);
    };

    return () => es.close();
  }, [sessionId, router, tutoringType, focusPrompt]);

  const progressPercent = PROGRESS_WEIGHTS[Math.min(stepIndex, PROGRESS_WEIGHTS.length - 1)];

  return (
    <main
      className="flex flex-col items-center justify-center"
      style={{ minHeight: "100vh", padding: "var(--space-8)" }}
    >
      {/* Progress bar */}
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Status */}
      <div className="vstack items-center text-center" style={{ gap: "var(--space-3)" }}>
        <span className="spinner" />
        <p style={{ fontSize: "var(--text-3)", fontWeight: "var(--font-medium)" }}>
          {currentMessage}
        </p>
        <p style={{ fontSize: "var(--text-1)", color: "var(--muted-foreground)" }}>
          This usually takes 30–60 seconds
        </p>
      </div>
    </main>
  );
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```

**Step 3: Commit**

```bash
cd frontend && git add src/app/loading/page.tsx
git commit -m "feat(ui): restyle loading page with OAT UI classes and spinner"
```

---

## Task 7: Study page

**Files:**
- Modify: `frontend/src/app/study/[sessionId]/page.tsx`

**Step 1: Update study/[sessionId]/page.tsx**

Replace all inline styles with component classes. All quiz/tab/fetch logic unchanged:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SessionResult, TutoringType } from "@/types/session";

const MODE_LABELS: Record<TutoringType, string> = {
  micro_learning: "Micro Learning",
  teaching_a_kid: "Teaching a Kid",
  advanced: "Advanced",
};

type Tab = "notes" | "flashcards" | "quiz";

export default function StudyPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("notes");

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizPhase, setQuizPhase] = useState<"answering" | "reviewing">("answering");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    fetch(`${apiUrl}/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found");
        return res.json();
      })
      .then((data: SessionResult) => {
        setSession(data);
        setAnswers(new Array(data.quiz.length).fill(null));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <main className="flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <span className="spinner" />
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="container flex items-center justify-center" style={{ minHeight: "100vh" }}>
        <p style={{ color: "var(--muted-foreground)" }}>
          Session not found.{" "}
          <Link href="/create" style={{ color: "var(--primary)" }}>Start a new session</Link>
        </p>
      </main>
    );
  }

  function selectAnswer(optionIndex: number) {
    if (answers[currentQ] !== null) return;
    const next = [...answers];
    next[currentQ] = optionIndex;
    setAnswers(next);
  }

  function nextQuestion() {
    if (currentQ < session!.quiz.length - 1) {
      setCurrentQ((q) => q + 1);
    } else {
      setQuizPhase("reviewing");
    }
  }

  const correctCount = answers.filter((a, i) => a === session!.quiz[i]?.answer_index).length;

  return (
    <div className="flex" style={{ minHeight: "100vh" }}>

      {/* Sidebar */}
      <aside className="study-sidebar">
        <div style={{ marginBottom: "var(--space-6)" }}>
          <p style={{ fontWeight: "var(--font-semibold)", marginBottom: "var(--space-1)", fontSize: "var(--text-2)" }}>
            {session.source_title}
          </p>
          <span className="badge" style={{ fontSize: "var(--text-1)" }}>
            {MODE_LABELS[session.tutoring_type]}
          </span>
        </div>

        <nav className="vstack" style={{ gap: "var(--space-1)" }}>
          {(["notes", "flashcards", "quiz"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nav-link${activeTab === tab ? " nav-link-active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto" }}>
          <Link href="/create" className="nav-link" style={{ fontSize: "var(--text-1)" }}>
            + New session
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, padding: "var(--space-8)", maxWidth: "780px" }}>

        {/* Notes */}
        {activeTab === "notes" && (
          <article className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{session.notes}</ReactMarkdown>
          </article>
        )}

        {/* Flashcards */}
        {activeTab === "flashcards" && (
          <div>
            <h2 style={{ fontSize: "var(--text-4)", fontWeight: "var(--font-semibold)", marginBottom: "var(--space-6)" }}>
              Flashcards
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
              {session.flashcards.map((card, i) => (
                <article key={i} className="card" style={{ padding: "var(--space-5)", minHeight: "120px" }}>
                  <p style={{ fontWeight: "var(--font-medium)", fontSize: "var(--text-2)" }}>{card.front}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Quiz */}
        {activeTab === "quiz" && (
          <div>
            <h2 style={{ fontSize: "var(--text-4)", fontWeight: "var(--font-semibold)", marginBottom: "var(--space-6)" }}>
              Quiz
            </h2>

            {quizPhase === "answering" && session.quiz[currentQ] && (
              <div className="vstack" style={{ gap: "var(--space-4)" }}>
                <p style={{ fontSize: "var(--text-1)", color: "var(--muted-foreground)" }}>
                  Question {currentQ + 1} of {session.quiz.length}
                </p>
                <p style={{ fontSize: "var(--text-3)", fontWeight: "var(--font-semibold)" }}>
                  {session.quiz[currentQ].question}
                </p>

                <div className="vstack" style={{ gap: "var(--space-2)" }}>
                  {session.quiz[currentQ].options.map((option, i) => {
                    const answered = answers[currentQ] !== null;
                    const isSelected = answers[currentQ] === i;
                    const isCorrect = i === session.quiz[currentQ].answer_index;
                    let extraClass = "";
                    if (answered && isCorrect) extraClass = " quiz-option-correct";
                    else if (answered && isSelected) extraClass = " quiz-option-wrong";

                    return (
                      <button
                        key={i}
                        onClick={() => selectAnswer(i)}
                        disabled={answered}
                        className={`quiz-option${extraClass}`}
                      >
                        {option}
                        {answered && isCorrect && " ✓"}
                        {answered && isSelected && !isCorrect && " ✗"}
                      </button>
                    );
                  })}
                </div>

                {answers[currentQ] !== null && (
                  <button onClick={nextQuestion} className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>
                    {currentQ < session.quiz.length - 1 ? "Next question →" : "See results →"}
                  </button>
                )}
              </div>
            )}

            {quizPhase === "reviewing" && (
              <div className="vstack" style={{ gap: "var(--space-6)" }}>
                <div>
                  <h3 style={{ fontSize: "var(--text-4)", fontWeight: "var(--font-bold)" }}>
                    You scored {correctCount} / {session.quiz.length}
                  </h3>
                  <p style={{ color: "var(--muted-foreground)", marginTop: "var(--space-2)" }}>
                    Review your answers below.
                  </p>
                </div>

                <div className="vstack" style={{ gap: "var(--space-4)" }}>
                  {session.quiz.map((q, i) => {
                    const userAnswer = answers[i];
                    const correct = userAnswer === q.answer_index;
                    return (
                      <article
                        key={i}
                        className="card"
                        style={{
                          padding: "var(--space-4)",
                          borderLeft: `4px solid var(${correct ? "--success" : "--danger"})`,
                        }}
                      >
                        <p style={{ fontWeight: "var(--font-semibold)", marginBottom: "var(--space-2)" }}>
                          {i + 1}. {q.question}
                        </p>
                        <p style={{ fontSize: "var(--text-1)", color: "var(--success-foreground)" }}>
                          ✓ {q.options[q.answer_index]}
                        </p>
                        {!correct && userAnswer !== null && (
                          <p style={{ fontSize: "var(--text-1)", color: "var(--danger-foreground)", marginTop: "var(--space-1)" }}>
                            ✗ Your answer: {q.options[userAnswer]}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>

                <button
                  className="btn btn-ghost"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => {
                    setCurrentQ(0);
                    setAnswers(new Array(session!.quiz.length).fill(null));
                    setQuizPhase("answering");
                  }}
                >
                  Retake quiz
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit && echo "TS OK"
```

**Step 3: Commit**

```bash
cd frontend && git add src/app/study/[sessionId]/page.tsx
git commit -m "feat(ui): restyle study page with OAT UI classes"
```

---

## Final verification

```bash
# Backend: all tests pass
cd backend && python -m pytest tests/ -v

# Frontend: no TS errors
cd frontend && npx tsc --noEmit && echo "Frontend OK"

# Backend: server starts cleanly
cd backend && python -c "from app.main import app; from app.config import get_settings; s = get_settings(); print('agent_api_key field exists:', hasattr(s, 'agent_api_key')); print('OK')"
```
