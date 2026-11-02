import type { GapReport, Issue, StepResult } from "../../src/types.js";

const ISSUE_LABEL: Record<Issue["type"], string> = {
  gap: "GAP",
  ownership_conflict: "OWNERSHIP CONFLICT",
  channel_mismatch: "CHANNEL MISMATCH",
};

function beforeIssues(step: StepResult): Issue[] {
  return step.issues.filter((i) => i.position === "before");
}

function onIssues(step: StepResult): Issue[] {
  return step.issues.filter((i) => i.position === "on");
}

function confidenceLabel(text: string): string {
  const head = text.split(/[—-]/)[0]?.trim();
  return head && head.length <= 24 ? head.toUpperCase() : "FLAGGED";
}

function CalloutCard({ issue }: { issue: Issue }) {
  const kind = issue.type === "gap" ? "gap" : "mismatch";
  return (
    <div className={`callout-card callout-${kind}`}>
      <div className="callout-header">
        <span className="callout-label">
          {ISSUE_LABEL[issue.type]} &middot; {confidenceLabel(issue.confidence)}
        </span>
      </div>
      <div className="callout-text">{issue.description}</div>
      <span className="callout-confidence">{issue.confidence}</span>
    </div>
  );
}

function Connector({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return <div className="connector-clean" />;
  }
  const kind = issues[0].type === "gap" ? "var(--gap)" : "var(--mismatch)";
  return (
    <div className="connector">
      <div className="connector-stem" style={{ backgroundImage: `linear-gradient(${kind} 60%, transparent 0%)` }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {issues.map((issue, i) => (
          <CalloutCard key={i} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function StepCard({ step, index, resolved }: { step: StepResult; index: number; resolved?: boolean }) {
  const flagged = onIssues(step);
  const team = step.team.trim() || "(none)";

  return (
    <div className={`step-card${resolved ? " step-card-resolved" : ""}`}>
      <div className="step-index">{index + 1}</div>
      <div className="step-body">
        <div className="step-name-row">
          <span className="step-name">{step.step_name}</span>
          {flagged.length > 0 && <span className="badge badge-conflict">Ownership conflict</span>}
        </div>
        <div className="step-meta">
          {team} &middot; {step.channel}
        </div>
        {flagged.map((issue, i) => (
          <div className="issue-inline" key={i}>
            <span className="issue-dot issue-dot-conflict" />
            <span>
              {issue.description} <span style={{ color: "var(--muted)" }}>({issue.confidence})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="step-card skeleton-card" aria-hidden="true">
      <div className="step-index skeleton-block" />
      <div className="step-body">
        <div className="skeleton-line skeleton-line-name" style={{ animationDelay: `${index * 60}ms` }} />
        <div className="skeleton-line skeleton-line-meta" style={{ animationDelay: `${index * 60 + 60}ms` }} />
      </div>
    </div>
  );
}

interface GapTimelineProps {
  summary?: Partial<GapReport["summary"]>;
  sequence: StepResult[];
  /** Total steps expected. If greater than sequence.length, the remainder
   * render as skeleton placeholders (used while a report is still streaming
   * in). Defaults to sequence.length (no skeletons). */
  totalSteps?: number;
  /** Steps rendered with the "just resolved" card style instead of the
   * finished report's plain card style (used on the live analysis view). */
  resolvedStyle?: boolean;
}

export default function GapTimeline({ summary, sequence, totalSteps, resolvedStyle }: GapTimelineProps) {
  const expected = totalSteps ?? sequence.length;
  const skeletonCount = Math.max(0, expected - sequence.length);

  return (
    <>
      <div className="summary">
        <span className="pill">{summary?.steps ?? expected} steps</span>
        <span className="pill pill-gap">{summary?.gaps ?? "…"} gaps</span>
        <span className="pill pill-conflict">{summary?.ownership_conflicts ?? "…"} ownership conflicts</span>
        <span className="pill pill-mismatch">{summary?.channel_mismatches ?? "…"} channel mismatches</span>
      </div>
      <div className="timeline">
        {sequence.map((step, i) => (
          <div key={i}>
            {i > 0 && <Connector issues={beforeIssues(step)} />}
            <StepCard step={step} index={i} resolved={resolvedStyle} />
          </div>
        ))}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={`skeleton-${i}`}>
            {(sequence.length > 0 || i > 0) && <div className="connector-clean" />}
            <SkeletonCard index={i} />
          </div>
        ))}
      </div>
    </>
  );
}
