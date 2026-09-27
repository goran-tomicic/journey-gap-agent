"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { GapReport, StepResult } from "../../src/types.js";
import GapTimeline from "./GapTimeline";

type Phase = "idle" | "running" | "done" | "error";

interface RunState {
  phase: Phase;
  total: number;
  sequence: StepResult[];
  summary?: Partial<GapReport["summary"]>;
  reportId?: string;
  error?: string;
}

const IDLE: RunState = { phase: "idle", total: 0, sequence: [] };

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<RunState>(IDLE);

  async function submit(useSample: boolean) {
    const file = fileInputRef.current?.files?.[0];
    if (!useSample && !file) {
      setState({ ...IDLE, phase: "error", error: "Choose a CSV file, or use the sample journey." });
      return;
    }

    setState({ ...IDLE, phase: "running" });

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
            setState((s) => ({ ...s, total: event.total }));
          } else if (event.type === "progress") {
            setState((s) => ({ ...s, sequence: event.sequence, summary: event.summary }));
          } else if (event.type === "done") {
            setState((s) => ({
              ...s,
              phase: "done",
              sequence: event.report.sequence,
              summary: event.report.summary,
              reportId: event.id,
            }));
            router.refresh();
          } else if (event.type === "error") {
            setState((s) => ({ ...s, phase: "error", error: event.error }));
          }
        }
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "error",
        error: err instanceof Error ? err.message : "Analysis failed.",
      }));
    }
  }

  const running = state.phase === "running";

  return (
    <div className="panel">
      <h2>Run analysis</h2>
      <div className="form-row">
        <input ref={fileInputRef} type="file" accept=".csv" disabled={running} />
        <button className="primary" disabled={running} onClick={() => submit(false)}>
          {running ? "Analyzing…" : "Analyze CSV"}
        </button>
        <button disabled={running} onClick={() => submit(true)}>
          Use sample journey
        </button>
      </div>
      {state.phase === "error" && <div className="error">{state.error}</div>}

      {(state.phase === "running" || state.phase === "done") && (
        <div style={{ marginTop: 20 }}>
          <GapTimeline summary={state.summary} sequence={state.sequence} totalSteps={state.total} />
          {state.phase === "done" && state.reportId && (
            <p style={{ marginTop: 12 }}>
              Saved. <Link href={`/reports/${state.reportId}`}>View this report</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
