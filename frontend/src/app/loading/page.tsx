"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildExpectedSteps, ProgressEvent, CompleteEvent, ErrorEvent, WarningEvent } from "@/types/session";

function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const tutoringType = searchParams.get("tutoring_type") ?? "";
  const focusPrompt = searchParams.get("focus_prompt") ?? "";
  const inputMode = (searchParams.get("input_mode") ?? "url") as "url" | "topic" | "paste";
  const generateFlashcards = searchParams.get("generate_flashcards") === "true";
  const generateQuiz = searchParams.get("generate_quiz") === "true";

  const steps = buildExpectedSteps(inputMode, generateFlashcards, generateQuiz);

  const [currentMessage, setCurrentMessage] = useState<string>(steps[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/create");
      return;
    }

    // Fast path: session already completed in a previous connection — skip the stream.
    const cached = localStorage.getItem(`session:${sessionId}`);
    if (cached) {
      router.replace(`/study/${sessionId}`);
      return;
    }

    // Guard against React StrictMode's double-mount in development, which would
    // open a second EventSource for the same session_id after the first already
    // consumed the PENDING_STORE entry on the backend (causing a 404).
    if (connectedRef.current) return;
    connectedRef.current = true;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    // Polls GET /sessions/{sessionId} up to maxAttempts times, spacing attempts by
    // delayMs. On success stores to localStorage and navigates to study. On
    // exhaustion redirects to the error page.
    async function recoverFromBackend(maxAttempts = 24, delayMs = 5000) {
      setRecovering(true);
      setCurrentMessage("Checking your session…");
      let networkErrorStreak = 0;
      for (let i = 0; i < maxAttempts; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
        try {
          const res = await fetch(`${apiUrl}/sessions/${sessionId}`);
          networkErrorStreak = 0; // reset streak on any HTTP response
          if (res.status === 202) continue; // still in progress — keep polling
          if (res.ok) {
            const data: CompleteEvent = await res.json();
            localStorage.setItem(`session:${data.session_id}`, JSON.stringify(data));
            setStepIndex(steps.length - 1);
            setTimeout(() => router.push(`/study/${data.session_id}`), 400);
            return;
          }
          // 404 or other non-ok status — session not found, stop polling
          break;
        } catch {
          // network error (backend unreachable) — give up after 3 consecutive failures
          if (++networkErrorStreak >= 3) break;
        }
      }
      router.push(`/create?error=unreachable&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}&input_mode=${inputMode}`);
    }

    const es = new EventSource(`${apiUrl}/sessions/${sessionId}/stream`);
    esRef.current = es;

    es.addEventListener("progress", (e: MessageEvent) => {
      const data: ProgressEvent = JSON.parse(e.data);
      setCurrentMessage(data.message);
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    });

    es.addEventListener("complete", (e: MessageEvent) => {
      const data: CompleteEvent = JSON.parse(e.data);
      localStorage.setItem(`session:${data.session_id}`, JSON.stringify(data));
      es.close();
      setStepIndex(steps.length - 1);
      setTimeout(() => router.push(`/study/${data.session_id}`), 400);
    });

    es.addEventListener("warning", (e: MessageEvent) => {
      const data: WarningEvent = JSON.parse(e.data);
      setWarningMessage(data.message);
    });

    es.addEventListener("error", (e: MessageEvent) => {
      es.close();
      try {
        const data: ErrorEvent = JSON.parse(e.data);
        router.push(`/create?error=${data.kind}&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}&input_mode=${inputMode}`);
      } catch {
        router.push(`/create?error=empty&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}&input_mode=${inputMode}`);
      }
    });

    es.onerror = () => {
      es.close();
      recoverFromBackend();
    };

    return () => es.close();
  }, [sessionId, router, tutoringType, focusPrompt, inputMode, steps]);

  // Progress bar: proportional to step index across dynamic step count
  const progressPercent = steps.length > 1
    ? Math.round(10 + (stepIndex / (steps.length - 1)) * 90)
    : stepIndex === 0 ? 10 : 100;

  return (
    <main className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-8">
      {/* Thin progress bar at top of page */}
      <div className="fixed top-14 left-0 right-0 h-0.5 bg-zinc-100">
        <div
          className="h-full bg-blue-600 transition-all duration-500 ease-in-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status */}
      <div className="flex flex-col items-center text-center gap-4">
        <span className="spinner" />
        <p className="text-base font-medium text-zinc-900">{currentMessage}</p>
        <p className="text-sm text-zinc-400">
          {recovering ? "Your session is still being prepared — checking again shortly…" : "This usually takes 30–60 seconds"}
        </p>
        {warningMessage && (
          <p className="text-xs text-amber-600 max-w-xs text-center mt-2">{warningMessage}</p>
        )}
      </div>
    </main>
  );
}

export default function LoadingPage() {
  return (
    <Suspense>
      <LoadingContent />
    </Suspense>
  );
}
