"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SSE_STEPS, TOPIC_SSE_STEPS, ProgressEvent, CompleteEvent, ErrorEvent, WarningEvent } from "@/types/session";

const PROGRESS_WEIGHTS = [20, 100] as const;

function LoadingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const tutoringType = searchParams.get("tutoring_type") ?? "";
  const focusPrompt = searchParams.get("focus_prompt") ?? "";
  const inputMode = searchParams.get("input_mode") ?? "url";

  const steps = inputMode === "topic" ? TOPIC_SSE_STEPS : SSE_STEPS;
  const [currentMessage, setCurrentMessage] = useState<string>(steps[0]);
  const [stepIndex, setStepIndex] = useState(0);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
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
      router.push(`/create?error=unreachable&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}&input_mode=${inputMode}`);
    };

    return () => es.close();
  }, [sessionId, router, tutoringType, focusPrompt, inputMode, steps]);

  const progressPercent = PROGRESS_WEIGHTS[Math.min(stepIndex, PROGRESS_WEIGHTS.length - 1)];

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
        <p className="text-sm text-zinc-400">This usually takes 30–60 seconds</p>
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
