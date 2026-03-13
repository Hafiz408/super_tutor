"use client";
import Link from "next/link";
import { useRecentSessions } from "@/app/hooks/useRecentSessions";

const FEATURES = [
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
];

export default function LandingPage() {
  const { sessions, removeSession } = useRecentSessions();

  return (
    <main className="max-w-3xl mx-auto px-5 flex flex-col" style={{ minHeight: "calc(100vh - 96px)" }}>
      {/* Hero — flex-1 so it grows to fill available space and centers its content */}
      <section className="flex-1 flex flex-col items-center justify-center text-center py-10">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-3">
          AI-powered study companion
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 leading-tight tracking-tight max-w-xl">
          Turn any article into a complete study session
        </h1>
        <p className="text-base text-zinc-500 max-w-md mt-5 leading-relaxed">
          Super Tutor transforms any article or doc URL into structured notes,
          interactive flashcards, and a quiz — tailored to your learning style,
          ready in under a minute.
        </p>
        <Link
          href="/create"
          className="mt-7 inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Start studying →
        </Link>
      </section>

      {/* Feature cards */}
      <section className="py-6 border-t border-zinc-100">
        <h2 className="text-center text-xl font-semibold text-zinc-900 mb-5">
          Three ways to learn
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((card) => (
            <article
              key={card.title}
              className="border border-zinc-200 rounded-xl p-5 bg-white"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{card.icon}</span>
                <h3 className="font-semibold text-zinc-900 text-sm">{card.title}</h3>
              </div>
              <p className="text-sm text-zinc-500 leading-relaxed">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <section className="py-6 border-t border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
            Recent sessions
          </h2>
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div key={s.session_id} className="group relative flex items-center border border-zinc-200 rounded-xl bg-white hover:border-zinc-300 hover:bg-zinc-50 transition-colors">
                <Link
                  href={`/study/${s.session_id}`}
                  className="flex flex-1 items-center justify-between px-4 py-3 min-w-0"
                >
                  <span className="text-sm font-medium text-zinc-900 truncate max-w-[70%]">
                    {s.source_title}
                  </span>
                  <span className="text-xs text-zinc-400 shrink-0 ml-3">
                    {new Date(s.saved_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </Link>
                <button
                  onClick={() => removeSession(s.session_id)}
                  aria-label="Discard session"
                  className="shrink-0 mr-2 p-1.5 rounded-lg text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
