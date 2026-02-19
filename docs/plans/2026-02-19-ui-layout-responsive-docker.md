# UI Layout, Responsive Design & Docker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken card grid, add sticky header with branding, add app description to homepage, make all pages fully responsive with a mobile bottom tab bar on the study page, and add Docker + Compose files for dev.

**Architecture:** All layout fixes stay in the existing OAT CSS + globals.css component system. A global sticky header is added inline in `layout.tsx`. The study page gains a CSS-driven mobile bottom tab bar (visible only on `<768px`) and a compact mobile meta-header; the existing sidebar is hidden on mobile via media query. Docker uses slim images with bind-mount volumes so `next dev` and `uvicorn --reload` hot-reload work inside containers.

**Tech Stack:** Next.js 16, React 19, TypeScript, OAT CSS (CDN), FastAPI, Python 3.12-slim, Playwright (Chromium), Docker, Docker Compose v2

---

## Task 1: Add responsive CSS to globals.css

**Files:**
- Modify: `frontend/src/app/globals.css`

**Step 1: Append new CSS sections to globals.css**

Open `frontend/src/app/globals.css` and **append** the following at the end (do not replace existing content):

```css
/* ─── Site header ───────────────────────────────────────────────── */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--background);
  border-bottom: 1px solid var(--border);
  padding: 0 var(--space-5);
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.site-header-logo {
  font-weight: var(--font-bold);
  font-size: var(--text-3);
  color: var(--foreground);
  text-decoration: none;
  letter-spacing: -0.01em;
}

/* ─── Badge fix ─────────────────────────────────────────────────── */
.badge {
  white-space: nowrap;
}

/* ─── Feature cards grid (homepage) ────────────────────────────── */
.feature-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
  gap: var(--space-4);
}

/* ─── Study page: mobile meta-header ───────────────────────────── */
.study-mobile-header {
  display: none;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
  gap: var(--space-2);
}

/* ─── Study page: bottom tab bar ───────────────────────────────── */
.study-bottom-nav {
  display: none;
}

/* ─── Responsive breakpoint: mobile (<768px) ────────────────────── */
@media (max-width: 767px) {
  /* Hide desktop sidebar */
  .study-sidebar {
    display: none;
  }

  /* Show mobile meta-header */
  .study-mobile-header {
    display: flex;
    flex-direction: column;
  }

  /* Show bottom tab bar */
  .study-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--background);
    border-top: 1px solid var(--border);
    z-index: 100;
    /* Safe-area inset for iOS notch */
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* Add bottom padding to study content so it's not hidden behind tab bar */
  .study-main-content {
    padding-bottom: 72px;
  }

  /* Shrink hero padding on mobile */
  .hero-section {
    padding-top: var(--space-12) !important;
    padding-bottom: var(--space-12) !important;
  }

  /* Full-width container padding on small screens */
  .container {
    padding-left: var(--space-5);
    padding-right: var(--space-5);
  }
}

/* ─── Bottom tab bar items ──────────────────────────────────────── */
.bottom-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-1);
  gap: 3px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  color: var(--muted-foreground);
  font-family: var(--font-sans);
  text-transform: capitalize;
  min-height: 56px;
  transition: color var(--transition-fast);
  text-decoration: none;
}

.bottom-tab-active {
  color: var(--primary);
  font-weight: var(--font-semibold);
}

/* ─── Bottom tab bar icons ──────────────────────────────────────── */
.bottom-tab-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
```

**Step 2: TypeScript check (CSS-only — check compilation doesn't break)**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend && npx tsc --noEmit && echo "TS OK"
```
Expected: `TS OK`

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add frontend/src/app/globals.css && git commit -m "feat(ui): add responsive CSS — site-header, mobile tab bar, feature-cards grid"
```

---

## Task 2: Add global sticky header to layout.tsx

**Files:**
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Update layout.tsx**

Replace the entire file content:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
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
      <body>
        <header className="site-header">
          <Link href="/" className="site-header-logo">
            Super Tutor
          </Link>
          <Link
            href="/create"
            className="btn btn-primary"
            style={{ fontSize: "var(--text-1)", padding: "var(--space-2) var(--space-4)" }}
          >
            New session →
          </Link>
        </header>
        {children}
      </body>
    </html>
  );
}
```

**Step 2: TypeScript check**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend && npx tsc --noEmit && echo "TS OK"
```
Expected: `TS OK`

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add frontend/src/app/layout.tsx && git commit -m "feat(ui): add sticky site header with logo and new-session CTA"
```

---

## Task 3: Fix homepage — card grid + app description

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Replace page.tsx**

The two changes:
1. The hero section gains an "About" paragraph between the heading and the description.
2. The feature cards section drops `.row` + `col-4` and uses `.feature-cards-grid`.

```tsx
import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section
        className="container vstack items-center text-center hero-section"
        style={{ paddingTop: "var(--space-18)", paddingBottom: "var(--space-18)" }}
      >
        <p
          style={{
            fontSize: "var(--text-1)",
            fontWeight: "var(--font-semibold)",
            color: "var(--primary)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "var(--space-3)",
          }}
        >
          AI-powered study companion
        </p>
        <h1
          style={{
            fontSize: "clamp(var(--text-5), 5vw, var(--text-7))",
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
            maxWidth: "520px",
            marginTop: "var(--space-5)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          Super Tutor is an AI study companion that transforms any article or doc URL into
          structured notes, interactive flashcards, and a quiz — tailored to your learning style,
          ready in under a minute.
        </p>
        <Link
          href="/create"
          className="btn btn-primary"
          style={{
            fontSize: "var(--text-3)",
            padding: "var(--space-4) var(--space-8)",
            marginTop: "var(--space-8)",
          }}
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
        <div className="feature-cards-grid">
          {[
            {
              title: "Micro Learning",
              body: "Short, punchy bullets. Just the essentials, fast.",
              icon: "⚡",
            },
            {
              title: "Teaching a Kid",
              body: "Plain language and everyday analogies. No jargon.",
              icon: "🎯",
            },
            {
              title: "Advanced",
              body: "Full technical depth for graduate-level understanding.",
              icon: "🎓",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="card"
              style={{ padding: "var(--space-6)" }}
            >
              <div style={{ fontSize: "var(--text-5)", marginBottom: "var(--space-3)" }}>
                {card.icon}
              </div>
              <h3
                style={{
                  fontWeight: "var(--font-semibold)",
                  marginBottom: "var(--space-2)",
                  fontSize: "var(--text-3)",
                }}
              >
                {card.title}
              </h3>
              <p style={{ color: "var(--muted-foreground)", fontSize: "var(--text-2)", lineHeight: "var(--leading-normal)" }}>
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

**Step 2: TypeScript check**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend && npx tsc --noEmit && echo "TS OK"
```
Expected: `TS OK`

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add frontend/src/app/page.tsx && git commit -m "feat(ui): fix homepage card grid, add app description and feature icons"
```

---

## Task 4: Study page — responsive sidebar + mobile bottom tab bar

**Files:**
- Modify: `frontend/src/app/study/[sessionId]/page.tsx`

**Step 1: Replace study page**

Key structural changes:
- Wrap the entire page in a `<div>` that tracks the full viewport
- Add `.study-mobile-header` block (hidden on desktop, shown on mobile) with title + badge
- Add `.study-main-content` class to the `<main>` tag so the CSS padding-bottom applies
- Add `.study-bottom-nav` with three tab buttons at the bottom of the component
- The tab SVG icons are inline SVG (no extra dependency)

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

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  notes: (
    <svg className="bottom-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
    </svg>
  ),
  flashcards: (
    <svg className="bottom-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="7" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z" />
    </svg>
  ),
  quiz: (
    <svg className="bottom-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
    </svg>
  ),
};

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
      <main className="vstack items-center justify-center" style={{ minHeight: "80vh" }}>
        <span className="spinner" />
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="vstack items-center justify-center" style={{ minHeight: "80vh" }}>
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
    <div style={{ display: "flex", minHeight: "calc(100vh - 52px)" }}>

      {/* Desktop sidebar (hidden on mobile via CSS) */}
      <aside className="study-sidebar">
        <div style={{ marginBottom: "var(--space-6)" }}>
          <p style={{
            fontWeight: "var(--font-semibold)",
            marginBottom: "var(--space-2)",
            fontSize: "var(--text-2)",
            lineHeight: "1.4",
          }}>
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

      {/* Mobile meta-header (hidden on desktop via CSS) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div className="study-mobile-header">
          <p style={{
            fontWeight: "var(--font-semibold)",
            fontSize: "var(--text-2)",
            lineHeight: "1.4",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {session.source_title}
          </p>
          <span className="badge" style={{ fontSize: "var(--text-1)", alignSelf: "flex-start" }}>
            {MODE_LABELS[session.tutoring_type]}
          </span>
        </div>

        {/* Main content */}
        <main className="study-main-content" style={{ flex: 1, padding: "var(--space-8)", maxWidth: "780px" }}>

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

        {/* Mobile bottom tab bar (hidden on desktop via CSS) */}
        <nav className="study-bottom-nav">
          {(["notes", "flashcards", "quiz"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`bottom-tab${activeTab === tab ? " bottom-tab-active" : ""}`}
            >
              {TAB_ICONS[tab]}
              {tab}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend && npx tsc --noEmit && echo "TS OK"
```
Expected: `TS OK`

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add frontend/src/app/study/[sessionId]/page.tsx && git commit -m "feat(ui): study page — responsive layout with mobile bottom tab bar"
```

---

## Task 5: Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps required by playwright's Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libatspi2.0-0 wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium browser
RUN playwright install chromium

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 2: Verify Dockerfile syntax**

```bash
docker build --no-cache -f /Users/mohammedhafiz/Desktop/Personal/super_tutor/backend/Dockerfile /Users/mohammedhafiz/Desktop/Personal/super_tutor/backend 2>&1 | tail -5
```
Expected: `Successfully built ...` (or skip if Docker is not running — just verify the file is present)

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add backend/Dockerfile && git commit -m "feat(docker): add backend Dockerfile with Playwright Chromium"
```

---

## Task 6: Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

**Step 1: Create frontend/Dockerfile**

Uses Node 20 alpine for a lean image. The `node_modules` volume in Compose prevents the host `node_modules` from being mounted over the container's installed packages.

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm install

# Copy source (overridden by bind-mount in dev)
COPY . .

EXPOSE 3000

ENV NEXT_TELEMETRY_DISABLED=1
# Required for Next.js to listen on all interfaces inside Docker
ENV HOSTNAME=0.0.0.0

CMD ["npm", "run", "dev"]
```

**Step 2: Verify the file is present**

```bash
ls /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend/Dockerfile && echo "File OK"
```
Expected: prints path and `File OK`

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add frontend/Dockerfile && git commit -m "feat(docker): add frontend Dockerfile for Next.js dev server"
```

---

## Task 7: Docker Compose for dev

**Files:**
- Create: `docker-compose.yml` (project root)

**Step 1: Create docker-compose.yml**

Notes:
- Both services use bind-mount volumes so code changes hot-reload without rebuilding the image.
- Frontend's `node_modules` is a named volume to prevent the host folder from shadowing the container's installed packages.
- `NEXT_PUBLIC_API_URL` points to `http://localhost:8000` because the browser fetches from the host network, not the Docker network.
- `env_file` for backend reads `backend/.env` (copy from `backend/.env.example` before first run).

```yaml
services:
  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    env_file:
      - ./backend/.env
    environment:
      - ALLOWED_ORIGINS=http://localhost:3000

  frontend:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - WATCHPACK_POLLING=true
    depends_on:
      - backend

volumes:
  frontend_node_modules:
```

**Step 2: Validate compose file syntax**

```bash
docker compose -f /Users/mohammedhafiz/Desktop/Personal/super_tutor/docker-compose.yml config --quiet && echo "Compose OK"
```
Expected: `Compose OK`

**Step 3: Commit**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor && git add docker-compose.yml && git commit -m "feat(docker): add docker-compose for dev (backend + frontend with hot reload)"
```

---

## Final verification

**TypeScript — no errors**

```bash
cd /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend && npx tsc --noEmit && echo "Frontend TS OK"
```

**Check all expected files exist**

```bash
ls /Users/mohammedhafiz/Desktop/Personal/super_tutor/backend/Dockerfile \
   /Users/mohammedhafiz/Desktop/Personal/super_tutor/frontend/Dockerfile \
   /Users/mohammedhafiz/Desktop/Personal/super_tutor/docker-compose.yml && echo "All Docker files present"
```

**Usage instructions for Docker dev**

```bash
# First time: copy env example
cp backend/.env.example backend/.env
# edit backend/.env and set AGENT_API_KEY=...

# Start both dev servers
docker compose up

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
```
