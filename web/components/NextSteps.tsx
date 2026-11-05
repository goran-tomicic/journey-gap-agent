"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActionMatrix from "./ActionMatrix";
import ScoreMeter from "./ScoreMeter";
import type { IssueType, NextStepAction, NextSteps as NextStepsData } from "../../src/types.js";
import { actionToTicket, groupByOwner, planToMarkdown } from "../lib/nextStepsText";
import { applyChanges, buildRevisionDraft, describeChange, DRAFT_KEY } from "../lib/revise";
import type { BaseStep } from "../lib/revise";

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
  applied,
  onToggleApply,
}: {
  action: NextStepAction;
  open: boolean;
  onToggle: () => void;
  rationale?: string;
  journeyName?: string;
  applied: boolean;
  onToggleApply: () => void;
}) {
  const change = action.proposed_change && action.proposed_change.type !== "none" ? action.proposed_change : undefined;
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
          <span className="ns-owner">
            {action.suggested_owner}
            {change && <span className="ns-change-flag">{applied ? " · change applied" : " · proposes a change"}</span>}
          </span>
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
          {change && (
            <div className="ns-detail ns-detail-wide">
              <div className="ns-detail-label">Proposed change</div>
              <p>{describeChange(change)}</p>
            </div>
          )}
          <div className="ns-detail-wide ns-card-actions">
            {change && (
              <button type="button" className={`ns-copy${applied ? "" : " primary"}`} onClick={onToggleApply}>
                {applied ? "Applied · undo" : "Apply change"}
              </button>
            )}
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
  baseSteps,
}: {
  reportId: string;
  initial?: NextStepsData;
  journeyName?: string;
  baseSteps?: BaseStep[];
}) {
  const router = useRouter();
  const [data, setData] = useState<NextStepsData | undefined>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<Set<number>>(new Set([1]));
  const [view, setView] = useState<View>("list");
  const [picked, setPicked] = useState<number>(1);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const appliedKey = `journey-gap-applied:${reportId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(appliedKey) ?? "[]");
      if (Array.isArray(saved)) setApplied(new Set(saved.filter((n) => typeof n === "number")));
    } catch {
      // ignore a corrupt value
    }
  }, [appliedKey]);

  function saveApplied(next: Set<number>) {
    setApplied(next);
    localStorage.setItem(appliedKey, JSON.stringify([...next]));
  }

  function toggleApply(priority: number) {
    const next = new Set(applied);
    if (!next.delete(priority)) next.add(priority);
    saveApplied(next);
  }

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
      saveApplied(new Set()); // a new set of actions invalidates earlier selections
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
      applied={applied.has(a.priority)}
      onToggleApply={() => toggleApply(a.priority)}
    />
  );
  const proposals = actions.filter((a) => a.proposed_change && a.proposed_change.type !== "none");
  const chosen = actions.filter((a) => applied.has(a.priority) && proposals.includes(a));

  function reviseJourney() {
    if (!baseSteps || chosen.length === 0) return;
    const draft = buildRevisionDraft(journeyName ?? "Journey", reportId, applyChanges(baseSteps, chosen), chosen.length);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    router.push("/");
  }

  const pickedAction = actions.find((a) => a.priority === picked) ?? actions[0];

  return (
    <div className="next-steps">
      {actions.length === 0 ? (
        <p className="ns-hint">{data.top_pick_rationale}</p>
      ) : (
        <>
          <div className="ns-summary">
            <span className="ns-summary-left">
              <span className="view-toggle ns-view-toggle" role="group" aria-label="Group actions by">
                {(["list", "team", "matrix"] as View[]).map((v) => (
                  <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                    {v === "list" ? "List" : v === "team" ? "By team" : "Matrix"}
                  </button>
                ))}
              </span>
              <span>
                {actions.length} action{actions.length === 1 ? "" : "s"}
                {quickWins > 0 && ` · ${quickWins} quick win${quickWins === 1 ? "" : "s"}`}
              </span>
            </span>
            <span className="ns-tools">
              <CopyButton className="ns-toggle-all" label="Copy plan" text={planToMarkdown(data, journeyName)} />
              {/* Always rendered (hidden outside List) so the other buttons don't move. */}
              <button
                className="ns-toggle-all"
                style={view === "list" ? undefined : { visibility: "hidden" }}
                tabIndex={view === "list" ? 0 : -1}
                onClick={() => setOpen(allOpen ? new Set() : new Set(actions.map((a) => a.priority)))}
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
              <button
                className="ns-toggle-all"
                disabled={loading}
                aria-busy={loading}
                onClick={() => {
                  if (window.confirm("Regenerate next steps? This replaces the current ones.")) void generate(true);
                }}
              >
                Regenerate
              </button>
            </span>
          </div>
          {error && <div className="error">{error}</div>}

          {baseSteps && proposals.length > 0 && (
            <div className="ns-revise">
              <span>
                {proposals.length} action{proposals.length === 1 ? "" : "s"} propose a change to the journey.
                Apply the ones you want, then re-analyze the revised journey to see what improves.
              </span>
              <button className="primary" disabled={chosen.length === 0} onClick={reviseJourney}>
                Revise journey{chosen.length > 0 ? ` (${chosen.length})` : ""}
              </button>
            </div>
          )}

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
