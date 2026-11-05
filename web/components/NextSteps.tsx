"use client";

import { useState } from "react";
import type { IssueType, NextStepAction, NextSteps as NextStepsData } from "../../src/types.js";

const ISSUE_LABEL: Record<IssueType, string> = {
  gap: "missing step",
  ownership_conflict: "ownership",
  channel_mismatch: "channel mismatch",
};

function isQuickWin(a: NextStepAction): boolean {
  return a.effort.score <= 2 && a.impact.score >= 3;
}

function Scores({ action }: { action: NextStepAction }) {
  return (
    <div className="ns-scores">
      <span className="pill" title={action.impact.reason}>
        impact {action.impact.score}/5
      </span>
      <span className="pill" title={action.effort.reason}>
        effort {action.effort.score}/5
      </span>
      {isQuickWin(action) && <span className="pill pill-gap">quick win</span>}
    </div>
  );
}

function ActionBody({ action }: { action: NextStepAction }) {
  return (
    <>
      <div className="ns-title">{action.title}</div>
      <p className="ns-what">{action.what_to_do}</p>
      <div className="ns-meta">
        Suggested owner: <strong>{action.suggested_owner}</strong>
      </div>
      <Scores action={action} />
      <div className="ns-reasons">
        <div>Impact: {action.impact.reason}</div>
        <div>Effort: {action.effort.reason}</div>
      </div>
      {action.resolves.length > 0 && (
        <div className="ns-resolves">
          Resolves:{" "}
          {action.resolves.map((r, i) => (
            <span className="ns-chip" key={i}>
              {ISSUE_LABEL[r.type]} · step {r.step}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** Next-steps section for a saved report. Generated on click and persisted
 * with the report, so a report that already has them shows them directly. */
export default function NextSteps({ reportId, initial }: { reportId: string; initial?: NextStepsData }) {
  const [data, setData] = useState<NextStepsData | undefined>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function generate() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/next-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate next steps.");
      setData(body.nextSteps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate next steps.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div className="next-steps">
        <div className="ns-header">
          <h2>Next steps</h2>
          <button className="primary" onClick={generate} disabled={loading}>
            {loading ? "Thinking…" : "Suggest next steps"}
          </button>
        </div>
        <p className="ns-hint">Get a prioritized list of what to fix, and which action is most worth doing first.</p>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "500 13px var(--font-body)" }}>
            <span className="pulse-dot" /> Prioritizing actions…
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  const [top, ...rest] = data.actions;
  return (
    <div className="next-steps">
      <div className="ns-header">
        <h2>Next steps</h2>
      </div>
      {!top ? (
        <p className="ns-hint">{data.top_pick_rationale}</p>
      ) : (
        <>
          <div className="ns-top">
            <div className="ns-top-label">Do this first</div>
            <ActionBody action={top} />
            <p className="ns-why">
              <strong>Why this one:</strong> {data.top_pick_rationale}
            </p>
          </div>
          {rest.length > 0 && (
            <ol className="ns-list" start={2}>
              {rest.map((a) => (
                <li key={a.priority}>
                  <span className="ns-rank">{a.priority}</span>
                  <div className="ns-item-body">
                    <ActionBody action={a} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
