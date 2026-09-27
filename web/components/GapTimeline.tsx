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

function IssueNote({ issue }: { issue: Issue }) {
  return (
    <div className={`issue-note issue-${issue.type}`}>
      <span className="issue-label">⚠ {ISSUE_LABEL[issue.type]}</span>
      <span className="issue-text">{issue.description}</span>
      <span className="issue-confidence">{issue.confidence}</span>
    </div>
  );
}

function Connector({ issues }: { issues: Issue[] }) {
  const broken = issues.length > 0;
  const stroke = broken ? "var(--issue)" : "var(--line)";

  return (
    <div className={`connector${broken ? " connector-broken" : ""}`}>
      <svg className="connector-line" width="24" height="56" viewBox="0 0 24 56" aria-hidden="true">
        <line
          x1="12"
          y1="0"
          x2="12"
          y2="44"
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray={broken ? "5,5" : undefined}
        />
        <polygon points="5,42 19,42 12,54" fill={stroke} />
      </svg>
      {broken && (
        <div className="issue-notes">
          {issues.map((issue, i) => (
            <IssueNote key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepCard({ step, index }: { step: StepResult; index: number }) {
  const flagged = onIssues(step);
  const team = step.team.trim() || "(none)";

  return (
    <div className={`step-card${flagged.length > 0 ? " step-card-flagged" : ""}`}>
      <div className="step-index">{index + 1}</div>
      <div className="step-body">
        <div className="step-name">{step.step_name}</div>
        <div className="step-meta">
          {team} &middot; {step.channel}
        </div>
        {flagged.map((issue, i) => (
          <IssueNote key={i} issue={issue} />
        ))}
      </div>
    </div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div className="step-card step-card-skeleton" aria-hidden="true">
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
}

export default function GapTimeline({ summary, sequence, totalSteps }: GapTimelineProps) {
  const expected = totalSteps ?? sequence.length;
  const skeletonCount = Math.max(0, expected - sequence.length);

  return (
    <>
      <div className="summary">
        {summary?.steps ?? expected} steps &middot; {summary?.gaps ?? "…"} gaps found &middot;{" "}
        {summary?.ownership_conflicts ?? "…"} ownership conflicts &middot;{" "}
        {summary?.channel_mismatches ?? "…"} channel mismatches
      </div>
      <div className="timeline">
        {sequence.map((step, i) => (
          <div key={i}>
            {i > 0 && <Connector issues={beforeIssues(step)} />}
            <StepCard step={step} index={i} />
          </div>
        ))}
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={`skeleton-${i}`}>
            {(sequence.length > 0 || i > 0) && <div className="connector" />}
            <SkeletonCard index={i} />
          </div>
        ))}
      </div>
    </>
  );
}
