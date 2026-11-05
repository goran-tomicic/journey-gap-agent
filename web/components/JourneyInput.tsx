"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import JourneyForm from "./JourneyForm";
import ReportTabs from "./ReportTabs";
import ReportView from "./ReportView";
import UploadForm from "./UploadForm";
import { useAnalysisRun } from "./useAnalysisRun";

/** Home page. Shows the input (build a journey or upload a CSV) and history;
 * once an analysis starts it switches to a results view of its own, with the
 * live skeleton, until the user starts a new analysis. */
export default function JourneyInput({ history }: { history: ReactNode }) {
  const [mode, setMode] = useState<"form" | "csv">("form");
  const run = useAnalysisRun();

  // The input forms stay mounted (just hidden) while results show, so the
  // chosen file and form state survive "New analysis".
  return (
    <>
      <div hidden={run.started}>
        <div className="eyebrow">Journey analysis</div>
        <h1>Journey Gap Agent</h1>
        <div className="subtitle">
          Describe a cross-team journey, or upload a touchpoint CSV, and flag gaps, ownership
          conflicts, and channel mismatches.
        </div>

        <div className="view-toggle" role="group" aria-label="Input method">
          <button aria-pressed={mode === "form"} onClick={() => setMode("form")}>
            Build manually
          </button>
          <button aria-pressed={mode === "csv"} onClick={() => setMode("csv")}>
            Upload CSV
          </button>
        </div>
        <div hidden={mode !== "form"}>
          <JourneyForm run={run} />
        </div>
        <div hidden={mode !== "csv"}>
          <UploadForm run={run} />
        </div>

        {history}
      </div>

      {run.started && (
        <div>
          <button className="back-link back-link-button" onClick={run.reset}>
            &larr; New analysis
          </button>
          <div className="eyebrow" style={{ marginTop: 14 }}>
            {run.phase === "error" ? "Analysis failed" : "Journey gap report"}
          </div>
          <h1>{run.label}</h1>
          {run.phase !== "error" && (
            <>
              <div className="subtitle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {run.running ? (
                  <>
                    <span className="pulse-dot" /> Analyzing…
                  </>
                ) : (
                  "Saved to history."
                )}
              </div>
              <ReportTabs id={run.reportId} active="report" hasNextSteps={false} />
            </>
          )}
          {run.phase === "error" && (
            <>
              <div className="error">{run.error}</div>
              <button style={{ marginTop: 14 }} onClick={run.reset}>
                Try again
              </button>
            </>
          )}
          {run.showResults && (
            <ReportView
              summary={run.summary}
              sequence={run.revealed}
              totalSteps={run.phase === "running" ? run.total : run.revealedCount}
              resolvedStyle
            />
          )}
        </div>
      )}
    </>
  );
}
