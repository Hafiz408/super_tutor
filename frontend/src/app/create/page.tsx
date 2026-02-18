"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TutoringType, SessionRequest } from "@/types/session";

const TUTORING_MODES: { id: TutoringType; label: string; description: string }[] = [
  {
    id: "micro_learning",
    label: "Micro Learning",
    description: "Short, punchy bullets. Just the essentials, fast.",
  },
  {
    id: "teaching_a_kid",
    label: "Teaching a Kid",
    description: "Plain language and everyday analogies. No jargon.",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "Full technical depth for graduate-level understanding.",
  },
];

const ERROR_MESSAGES: Record<string, { top: string; pointer: string }> = {
  paywall: {
    top: "We couldn't read that page",
    pointer: "This looks like a paywalled article. Try pasting the article text below.",
  },
  invalid_url: {
    top: "We couldn't read that page",
    pointer: "The URL doesn't look valid. Check it and try again, or paste the article text.",
  },
  empty: {
    top: "We couldn't read that page",
    pointer: "The page loaded but didn't have enough readable text. You can paste the content below.",
  },
  unreachable: {
    top: "We couldn't reach that page",
    pointer: "The site may be down or blocked. Paste the article text below to continue.",
  },
};

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // When redirected back from the loading page after an SSE error, restore mode and focus prompt.
  // The loading page includes tutoring_type and focus_prompt in the redirect URL so they are not lost.
  const errorParam = searchParams.get("error");
  const tutoringTypeParam = searchParams.get("tutoring_type") as TutoringType | null;
  const focusPromptParam = searchParams.get("focus_prompt") ?? "";

  const [selectedMode, setSelectedMode] = useState<TutoringType | null>(
    errorParam && tutoringTypeParam ? tutoringTypeParam : null
  );
  const [url, setUrl] = useState(""); // URL field always starts empty (cleared on error redirect)
  const [focusPrompt, setFocusPrompt] = useState(
    errorParam ? focusPromptParam : ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorKind, setErrorKind] = useState<string | null>(
    errorParam // pre-populate error from redirect if SSE returned error
  );
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
      // Pass tutoring_type and focus_prompt in the URL so the loading page can forward them
      // in the error redirect back to /create — this keeps mode and focus prompt filled on failure.
      router.push(
        `/loading?session_id=${session_id}&tutoring_type=${selectedMode}&focus_prompt=${encodeURIComponent(focusPrompt)}`
      );
    } catch {
      // Explicitly clear the URL field so the error state only shows the paste fallback
      setUrl("");
      setErrorKind("empty");
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Create a study session</h1>
      <form onSubmit={handleSubmit}>

        {/* Tutoring mode cards */}
        <fieldset>
          <legend>How do you want to learn?</legend>
          <div>
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
                <article
                  aria-selected={selectedMode === mode.id}
                  style={{
                    border: selectedMode === mode.id ? "2px solid currentColor" : "2px solid transparent",
                    padding: "1rem",
                    cursor: "pointer",
                  }}
                >
                  <h3>{mode.label}</h3>
                  <p>{mode.description}</p>
                </article>
              </label>
            ))}
          </div>
        </fieldset>

        {/* URL input — only shown when no paste fallback is active */}
        {!pasteText && (
          <div>
            <label htmlFor="url">Article or doc URL</label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required={!pasteText}
            />
          </div>
        )}

        {/* Inline error + fallback textarea */}
        {errorMessages && (
          <div role="alert">
            <p><strong>{errorMessages.top}</strong></p>
            <p>{errorMessages.pointer}</p>
            <label htmlFor="paste_text">Paste the article text instead</label>
            <textarea
              id="paste_text"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste the full article text here (at least a few paragraphs)..."
              rows={8}
              minLength={200}
              maxLength={50000}
            />
            {pasteText.length > 0 && pasteText.length < 200 && (
              <p>Please paste at least a few paragraphs for best results.</p>
            )}
          </div>
        )}

        {/* Optional focus prompt */}
        <div>
          <label htmlFor="focus_prompt">
            What do you want to focus on? <small>(optional)</small>
          </label>
          <input
            id="focus_prompt"
            type="text"
            value={focusPrompt}
            onChange={(e) => setFocusPrompt(e.target.value)}
            placeholder="e.g. 'key algorithms', 'historical causes', 'main arguments'"
          />
        </div>

        <button
          type="submit"
          disabled={!selectedMode || isSubmitting || (pasteText.length > 0 && pasteText.length < 200)}
        >
          {isSubmitting ? "Starting..." : "Generate my study session →"}
        </button>
      </form>

      <Link href="/">← Back</Link>
    </main>
  );
}
