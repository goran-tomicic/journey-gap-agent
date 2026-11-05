"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GapReport, StepResult } from "../../src/types.js";

type NetworkPhase = "idle" | "running" | "done" | "error";

// The model can finish generating its whole tool call in well under a
// second once it starts (most of the real wait is "thinking" time before
// any output begins) — too fast for a step-by-step reveal to be visible
// on the wire. So "data has arrived" (network) is decoupled from "shown to
// the user" (display): real results land in a ref as they stream in, and a
// fixed-cadence pacer reveals them one card at a time, continuing to drain
// even after the network call has already fully finished.
const REVEAL_INTERVAL_MS = 350;

interface NetworkState {
  phase: NetworkPhase;
  sequence: StepResult[];
  summary?: Partial<GapReport["summary"]>;
  reportId?: string;
  error?: string;
}

const IDLE_NETWORK: NetworkState = { phase: "idle", sequence: [] };

/** Runs an analysis against /api/analyze and exposes its paced, streaming
 * progress. Shared by the CSV upload form and the manual journey form. */
export function useAnalysisRun() {
  const router = useRouter();

  const networkRef = useRef<NetworkState>(IDLE_NETWORK);
  const revealedCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [total, setTotal] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [displayPhase, setDisplayPhase] = useState<NetworkPhase>("idle");
  const [summary, setSummary] = useState<Partial<GapReport["summary"]> | undefined>();
  const [reportId, setReportId] = useState<string>();
  const [error, setError] = useState<string>();
  const [started, setStarted] = useState(false);
  const [label, setLabel] = useState("");

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function stopPacer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startPacer() {
    stopPacer();
    timerRef.current = setInterval(() => {
      const net = networkRef.current;
      if (revealedCountRef.current < net.sequence.length) {
        revealedCountRef.current += 1;
        setRevealedCount(revealedCountRef.current);
        setSummary(net.summary);
        return;
      }
      if (net.phase === "done" || net.phase === "error") {
        stopPacer();
        setDisplayPhase(net.phase);
        setSummary(net.summary);
        if (net.phase === "done") setReportId(net.reportId);
        if (net.phase === "error") setError(net.error);
      }
    }, REVEAL_INTERVAL_MS);
  }

  /** Shows an error without starting a run (e.g. failed client-side validation). */
  function fail(message: string) {
    setError(message);
    setDisplayPhase("error");
  }

  /** Back to the idle state (e.g. "New analysis"). */
  function reset() {
    stopPacer();
    networkRef.current = IDLE_NETWORK;
    revealedCountRef.current = 0;
    setTotal(0);
    setRevealedCount(0);
    setSummary(undefined);
    setReportId(undefined);
    setError(undefined);
    setDisplayPhase("idle");
    setStarted(false);
  }

  /** `title` names the run on the results view (file name, journey name). */
  async function start(form: FormData, title = "") {
    setLabel(title);
    setStarted(true);
    networkRef.current = { ...IDLE_NETWORK, phase: "running" };
    revealedCountRef.current = 0;
    setTotal(0);
    setRevealedCount(0);
    setSummary(undefined);
    setReportId(undefined);
    setError(undefined);
    setDisplayPhase("running");
    startPacer();

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      if (!res.body) throw new Error("No response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);

          if (event.type === "start") {
            setTotal(event.total);
          } else if (event.type === "progress") {
            networkRef.current = { ...networkRef.current, sequence: event.sequence, summary: event.summary };
          } else if (event.type === "done") {
            networkRef.current = {
              ...networkRef.current,
              phase: "done",
              sequence: event.report.sequence,
              summary: event.report.summary,
              reportId: event.id,
            };
            router.refresh();
          } else if (event.type === "error") {
            networkRef.current = { ...networkRef.current, phase: "error", error: event.error };
          }
        }
      }
    } catch (err) {
      networkRef.current = {
        ...networkRef.current,
        phase: "error",
        error: err instanceof Error ? err.message : "Analysis failed.",
      };
    }
  }

  return {
    start,
    fail,
    reset,
    started,
    label,
    phase: displayPhase,
    running: displayPhase === "running",
    showResults: displayPhase === "running" || displayPhase === "done",
    total,
    summary,
    reportId,
    error,
    revealed: networkRef.current.sequence.slice(0, revealedCount),
    revealedCount,
  };
}

export type AnalysisRun = ReturnType<typeof useAnalysisRun>;
