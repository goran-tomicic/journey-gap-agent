"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import NextSteps from "./NextSteps";
import ReportView from "./ReportView";
import { useAnalysisRun } from "./useAnalysisRun";

export default function UploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const run = useAnalysisRun();

  const [fileName, setFileName] = useState<string>();
  const [dragActive, setDragActive] = useState(false);

  function runAnalysis(file: File | null, useSample: boolean) {
    if (!useSample && !file) {
      run.fail("Choose a CSV file, or use the sample journey.");
      return;
    }
    const form = new FormData();
    if (useSample) form.set("useSample", "true");
    else if (file) form.set("file", file);
    void run.start(form);
  }

  function handleFileChosen(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
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

  const { running, showResults: showTimeline, phase: displayPhase, error, summary, total, revealed, revealedCount, reportId } = run;

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
          <ReportView
            summary={summary}
            sequence={revealed}
            totalSteps={displayPhase === "running" ? total : revealedCount}
            resolvedStyle
          />
          {displayPhase === "done" && reportId && (
            <>
              <p style={{ marginTop: 12 }}>
                Saved. <Link href={`/reports/${reportId}`}>View this report</Link>
              </p>
              <NextSteps key={reportId} reportId={reportId} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
