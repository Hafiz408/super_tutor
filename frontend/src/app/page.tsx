import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      <section>
        <h1>Turn any article into a complete study session</h1>
        <p>
          Paste a URL, pick your learning style, and get structured notes,
          flashcards, and a quiz — all in minutes.
        </p>
        <Link href="/create">
          <button>Start studying →</button>
        </Link>
      </section>

      <section>
        <h2>Three ways to learn</h2>
        <div>
          <article>
            <h3>Micro Learning</h3>
            <p>Short, punchy bullets. Just the essentials.</p>
          </article>
          <article>
            <h3>Teaching a Kid</h3>
            <p>Plain language, everyday analogies. No jargon.</p>
          </article>
          <article>
            <h3>Advanced</h3>
            <p>Full depth. Technical terminology. Graduate-level nuance.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
