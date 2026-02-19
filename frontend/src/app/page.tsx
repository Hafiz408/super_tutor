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
