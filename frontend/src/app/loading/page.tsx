"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SSE_STEPS, ProgressEvent, CompleteEvent, ErrorEvent } from "@/types/session";

const PROGRESS_WEIGHTS = [10, 40, 70, 100] as const;

export default function LoadingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  // These are passed from the create page so they can be forwarded in the error redirect
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
      setStepIndex(SSE_STEPS.length - 1); // ensure bar hits 100%
      // Small delay so user sees 100% before redirect
      setTimeout(() => {
        router.push(`/study/${data.session_id}`);
      }, 400);
    });

    es.addEventListener("error", (e: MessageEvent) => {
      es.close();
      try {
        const data: ErrorEvent = JSON.parse(e.data);
        // Forward tutoring_type and focus_prompt so create page can restore mode and focus fields
        router.push(
          `/create?error=${data.kind}&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}`
        );
      } catch {
        router.push(`/create?error=empty&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}`);
      }
    });

    // Handle EventSource connection errors (network failure etc.)
    es.onerror = () => {
      es.close();
      router.push(`/create?error=unreachable&tutoring_type=${tutoringType}&focus_prompt=${encodeURIComponent(focusPrompt)}`);
    };

    return () => es.close();
  }, [sessionId, router, tutoringType, focusPrompt]);

  const progressPercent = PROGRESS_WEIGHTS[Math.min(stepIndex, PROGRESS_WEIGHTS.length - 1)];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      {/* Progress bar at top of viewport */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progressPercent}%`,
            background: "currentColor",
            transition: "width 400ms ease-in-out",
          }}
        />
      </div>

      {/* Step message */}
      <p style={{ fontSize: "1.25rem", textAlign: "center" }}>{currentMessage}</p>
      <p style={{ opacity: 0.5, fontSize: "0.875rem" }}>This usually takes 30–60 seconds</p>
    </main>
  );
}
