"use client";

import { useState } from "react";
import ActionMatrix from "./ActionMatrix";
import ScoreMeter from "./ScoreMeter";
import type { IssueType, NextStepAction, NextSteps as NextStepsData } from "../../src/types.js";
import { actionToTicket, groupByOwner, planToMarkdown } from "../lib/nextStepsText";

type View = "list" | "team" | "matrix";

const ISSUE_LABEL: Record<IssueType, string> = {
  gap: "missing step",
  ownership_conflict: "ownership",
  channel_mismatch: "channel mismatch",
};

function isQuickWin(a: NextStepAction): boolean {
  return a.effort.score <= 2 && a.impact.score >= 3;
}

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this text:", text);
    }
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "Copied" : label}
    </button>
  );
}

function ActionCard({
  action,
  open,
  onToggle,
  rationale,
  journeyName,
}: {
  action: NextStepAction;
  open: boolean;
  onToggle: () => void;
  rationale?: string;
  journeyName?: string;
}) {
  const first = action.priority === 1;
  return (
    <li className={`ns-card${first ? " ns-card-first" : ""}${open ? " ns-card-open" : ""}`}>
      <button className="ns-card-head" aria-expanded={open} onClick={onToggle}>
        <span className="ns-rank">{action.priority}</span>
        <span className="ns-card-main">
          <span className="ns-title">
            {action.title}
            {first && <span className="ns-start">start here</span>}
            {!first && isQuickWin(action) && <span className="ns-quick">quick win</span>}
          </span>
          <span className="ns-owner">{action.suggested_owner}</span>
        </span>
        <span className="ns-card-side">
          <ScoreMeter label="Impact" value={action.impact.score} title={action.impact.reason} tone="good" />
          <ScoreMeter label="Effort" value={action.effort.score} title={action.effort.reason} tone="warn" />
        </span>
        <span className="ns-chevron" aria-hidden="true" />
      </button>

      <p className="ns-what">{action.what_to_do}</p>

      {open && (
        <div className="ns-details">
          {rationale && (
            <div className="ns-detail">
              <div className="ns-detail-label">Why start here</div>
              <p>{rationale}</p>
            </div>
          )}
          {action.done_when && (
            <div className="ns-detail ns-detail-wide">
              <div className="ns-detail-label">Done when</div>
              <p>{action.done_when}</p>
            </div>
          )}
          <div className="ns-detail">
            <div className="ns-detail-label">Impact {action.impact.score}/5</div>
            <p>{action.impact.reason}</p>
          </div>
          <div className="ns-detail">
            <div className="ns-detail-label">Effort {action.effort.score}/5</div>
            <p>{action.effort.reason}</p>
          </div>
          {action.resolves.length > 0 && (
            <div className="ns-detail">
              <div className="ns-detail-label">Clears</div>
              <p>
                {action.resolves.map((r, i) => (
                  <span className="ns-chip" key={i}>
                    {ISSUE_LABEL[r.type]} · step {r.step}
                  </span>
                ))}
              </p>
            </div>
          )}
          <div className="ns-detail-wide ns-card-actions">
            <CopyButton className="ns-copy" label="Copy as ticket" text={actionToTicket(action, journeyName)} />
          </div>
        </div>
      )}
    </li>
  );
}

/** Next-steps section for a saved report. Generated on click and persisted
 * with the report, so a report that already has them shows them directly. */
export default function NextSteps({
  reportId,
  initial,
  journeyName,
}: {
  reportId: string;
  initial?: NextStepsData;
  journeyName?: string;
}) {
  const [data, setData] = useState<NextStepsData | undefined>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<Set<number>>(new Set([1]));
  const [view, setView] = useState<View>("list");
  const [picked, setPicked] = useState<number>(1);

  async function generate(force = false) {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/next-steps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, force }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not generate next steps.");
      setData(body.nextSteps);
      setOpen(new Set([1]));
      setPicked(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate next steps.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(priority: number) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(priority)) next.add(priority);
      return next;
    });
  }

  if (!data) {
    return (
      <div className="next-steps ns-empty">
        <p className="ns-hint">Get a prioritized list of what to fix, and which action is most worth doing first.</p>
        <button className="primary" onClick={() => generate()} disabled={loading}>
          {loading ? "Thinking…" : "Suggest next steps"}
        </button>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, font: "500 13px var(--font-body)" }}>
            <span className="pulse-dot" /> Prioritizing actions…
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  const actions = data.actions;
  const allOpen = actions.length > 0 && actions.every((a) => open.has(a.priority));
  const quickWins = actions.filter(isQuickWin).length;
  const card = (a: NextStepAction, isOpen: boolean, onToggle: () => void) => (
    <ActionCard
      key={a.priority}
      action={a}
      open={isOpen}
      onToggle={onToggle}
      rationale={a.priority === 1 ? data.top_pick_rationale : undefined}
      journeyName={journeyName}
    />
  );
  const pickedAction = actions.find((a) => a.priority === picked) ?? actions[0];

  return (
    <div className="next-steps">
      {actions.length === 0 ? (
        <p className="ns-hint">{data.top_pick_rationale}</p>
      ) : (
        <>
          <div className="ns-summary">
            <span>
              {actions.length} action{actions.length === 1 ? "" : "s"}
              {quickWins > 0 && ` · ${quickWins} quick win${quickWins === 1 ? "" : "s"}`}
            </span>
            <span className="ns-tools">
              <span className="view-toggle ns-view-toggle" role="group" aria-label="Group actions by">
                {(["list", "team", "matrix"] as View[]).map((v) => (
                  <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                    {v === "list" ? "List" : v === "team" ? "By team" : "Matrix"}
                  </button>
                ))}
              </span>
              <CopyButton className="ns-toggle-all" label="Copy plan" text={planToMarkdown(data, journeyName)} />
              {view === "list" && (
                <button
                  className="ns-toggle-all"
                  onClick={() => setOpen(allOpen ? new Set() : new Set(actions.map((a) => a.priority)))}
                >
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              )}
              <button
                className="ns-toggle-all"
                disabled={loading}
                onClick={() => {
                  if (window.confirm("Regenerate next steps? This replaces the current ones.")) void generate(true);
                }}
              >
                {loading ? "Regenerating…" : "Regenerate"}
              </button>
            </span>
          </div>
          {error && <div className="error">{error}</div>}

          {view === "list" && (
            <ol className="ns-cards">
              {actions.map((a) =>
                card(a, open.has(a.priority), () => toggle(a.priority)),
              )}
            </ol>
          )}

          {view === "team" &&
            groupByOwner(actions).map((g) => (
              <section className="ns-group" key={g.team}>
                <h3 className="ns-group-title">
                  {g.team} <span>{g.actions.length} action{g.actions.length === 1 ? "" : "s"}</span>
                </h3>
                <ol className="ns-cards">{g.actions.map((a) => card(a, open.has(a.priority), () => toggle(a.priority)))}</ol>
              </section>
            ))}

          {view === "matrix" && (
            <>
              <ActionMatrix actions={actions} selected={pickedAction.priority} onSelect={setPicked} />
              <ol className="ns-cards" style={{ marginTop: 18 }}>
                {card(pickedAction, true, () => {})}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}
