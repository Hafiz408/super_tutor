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
          structured notes, interactive flashcards, and a quiz — tailored to your learning
          style, ready in under a minute.
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
