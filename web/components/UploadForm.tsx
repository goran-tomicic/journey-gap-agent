"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GapReport, StepResult } from "../../src/types.js";
import GapTimeline from "./GapTimeline";

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

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const networkRef = useRef<NetworkState>(IDLE_NETWORK);
  const revealedCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [total, setTotal] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [displayPhase, setDisplayPhase] = useState<NetworkPhase>("idle");
  const [summary, setSummary] = useState<Partial<GapReport["summary"]> | undefined>();
  const [reportId, setReportId] = useState<string>();
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [dragActive, setDragActive] = useState(false);

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

  async function runAnalysis(file: File | null, useSample: boolean) {
    if (!useSample && !file) {
      setError("Choose a CSV file, or use the sample journey.");
      setDisplayPhase("error");
      return;
    }

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
      const form = new FormData();
      if (useSample) {
        form.set("useSample", "true");
      } else if (file) {
        form.set("file", file);
      }

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

  function handleFileChosen(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setError(undefined);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileChosen(file);
    }
  }

  const running = displayPhase === "running";
  const showTimeline = displayPhase === "running" || displayPhase === "done";

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2>Run analysis</h2>
        {running && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "500 13px var(--font-body)", color: "var(--accent)" }}>
            <span className="pulse-dot" /> Analyzing…
          </div>
        )}
      </div>

      {!running && (
        <div
          className={`dropzone${dragActive ? " dropzone-active" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <svg className="dropzone-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <div className="dropzone-title">{fileName ?? "Drop a CSV here, or choose a file"}</div>
          <div className="dropzone-hint">step_name, owning_team, channel, description</div>
          <label htmlFor="csv-input" className="btn" style={{ marginTop: 4 }}>
            Choose file…
          </label>
          <input
            id="csv-input"
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="visually-hidden"
            disabled={running}
            onChange={(e) => handleFileChosen(e.target.files?.[0])}
          />
        </div>
      )}

      {!running && (
        <div className="form-row">
          <button onClick={() => runAnalysis(null, true)}>Use sample journey</button>
          <button className="primary" onClick={() => runAnalysis(fileInputRef.current?.files?.[0] ?? null, false)}>
            Analyze CSV
          </button>
        </div>
      )}

      {displayPhase === "error" && <div className="error">{error}</div>}

      {showTimeline && (
        <div style={{ marginTop: 20 }}>
          <GapTimeline
            summary={summary}
            sequence={networkRef.current.sequence.slice(0, revealedCount)}
            totalSteps={displayPhase === "running" ? total : revealedCount}
            resolvedStyle
          />
          {displayPhase === "done" && reportId && (
            <p style={{ marginTop: 12 }}>
              Saved. <Link href={`/reports/${reportId}`}>View this report</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
