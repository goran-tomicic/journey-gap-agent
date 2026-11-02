import type { GapReport, Issue, StepResult } from "../../src/types.js";

interface Flag {
  tag: string;
  where: string;
  issue: Issue;
  order: number;
}

/** A step owned by two teams ("Onboarding / Support") sits in both lanes. */
function owners(step: StepResult): string[] {
  return step.team
    .split(/[/,&]/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && t !== "(none)");
}

function splitConfidence(text: string): { level: string; reason: string } {
  const [head, ...rest] = text.split(/\s[—-]\s|[—]/);
  const level = (head?.trim() ?? "").replace(/\s+confidence$/i, "");
  if (level && level.length <= 20) return { level: level.toLowerCase(), reason: rest.join(" — ").trim() };
  return { level: "", reason: text };
}

function buildFlags(sequence: StepResult[]): Flag[] {
  const flags: Flag[] = [];
  sequence.forEach((step, i) => {
    step.issues.forEach((issue) => {
      let tag: string;
      let where: string;
      if (issue.type === "gap") {
        tag = "missing step";
        where = `between ${i} and ${i + 1}`;
      } else if (issue.type === "channel_mismatch") {
        tag = "no bridge";
        where = `${i} to ${i + 1}`;
      } else {
        tag = owners(step).length === 0 ? "no owner" : "two owners";
        where = `step ${i + 1}`;
      }
      flags.push({ tag, where, issue, order: i });
    });
  });
  return flags;
}

interface Column {
  /** 1-based step number, or null for a missing-step placeholder. */
  step: number | null;
  lanes: string[];
  conflict: boolean;
}

function buildColumns(sequence: StepResult[], pending: number): Column[] {
  const cols: Column[] = [];
  sequence.forEach((step, i) => {
    const hasGap = i > 0 && step.issues.some((x) => x.type === "gap" && x.position === "before");
    if (hasGap) cols.push({ step: null, lanes: [], conflict: false });
    const lanes = owners(step);
    cols.push({
      step: i + 1,
      lanes: lanes.length ? lanes : ["unowned"],
      conflict: step.issues.some((x) => x.type === "ownership_conflict"),
    });
  });
  for (let i = 0; i < pending; i++) cols.push({ step: -1, lanes: [], conflict: false });
  return cols;
}

function Swimlanes({ sequence, pending }: { sequence: StepResult[]; pending: number }) {
  const columns = buildColumns(sequence, pending);
  const laneNames: string[] = [];
  columns.forEach((c) => c.lanes.forEach((l) => !laneNames.includes(l) && laneNames.push(l)));
  // Placeholders (missing steps, not-yet-streamed steps) need a row to sit in.
  const rows = laneNames.length ? laneNames : ["…"];

  return (
    <div className="lanes" style={{ gridTemplateColumns: `max-content repeat(${columns.length}, 1fr)` }}>
      {rows.map((lane, r) => (
        <div className="lane-row" key={lane} style={{ display: "contents" }}>
          <div className="lane-label">{lane}</div>
          {columns.map((col, c) => {
            let node: React.ReactNode = null;
            if (col.step === null && r === 0) {
              node = <span className="dot dot-missing" title="missing step" />;
            } else if (col.step === -1 && r === 0) {
              node = <span className="dot dot-pending" />;
            } else if (col.step !== null && col.step > 0 && col.lanes.includes(lane)) {
              node = <span className={`dot${col.conflict ? " dot-conflict" : ""}`}>{col.step}</span>;
            }
            return (
              <div className="lane-cell" key={c}>
                {node}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FlagRow({ flag }: { flag: Flag }) {
  const { level, reason } = splitConfidence(flag.issue.confidence);
  return (
    <li className="flag">
      <div className="flag-head">
        <span className="flag-tag">{flag.tag}</span>
        <span className="flag-where">{flag.where}</span>
      </div>
      <p className="flag-text">{flag.issue.description}</p>
      <div className="flag-confidence">
        {level ? `confidence: ${level}` : "confidence"}
        {reason && <span className="flag-reason"> · {reason}</span>}
      </div>
    </li>
  );
}

interface GapTimelineProps {
  summary?: Partial<GapReport["summary"]>;
  sequence: StepResult[];
  /** Total steps expected. If greater than sequence.length, the remainder
   * render as placeholder dots (used while a report is still streaming in).
   * Defaults to sequence.length (no placeholders). */
  totalSteps?: number;
  /** Kept for the live analysis view; the swimlane layout has no separate
   * "resolved" card style. */
  resolvedStyle?: boolean;
}

export default function GapTimeline({ summary, sequence, totalSteps }: GapTimelineProps) {
  const expected = totalSteps ?? sequence.length;
  const pending = Math.max(0, expected - sequence.length);
  const flags = buildFlags(sequence);

  return (
    <div className="report">
      <div className="summary">
        <span className="pill">{summary?.steps ?? expected} steps</span>
        <span className="pill pill-flag">{summary?.gaps ?? "…"} missing</span>
        <span className="pill pill-flag">{summary?.ownership_conflicts ?? "…"} ownership</span>
        <span className="pill pill-flag">{summary?.channel_mismatches ?? "…"} no bridge</span>
      </div>

      <div className="report-frame">
        <div className="card">
          <Swimlanes sequence={sequence} pending={pending} />
        </div>

        {flags.length > 0 && (
          <ul className="card flag-list">
            {flags.map((f, i) => (
              <FlagRow key={i} flag={f} />
            ))}
          </ul>
        )}

        {sequence.length > 0 && (
          <ol className="card step-list">
            {sequence.map((s, i) => (
              <li key={i}>
                <span className="step-num">{i + 1}</span>
                <span className="step-name">{s.step_name}</span>
                <span className="step-meta">
                  {s.team.trim() || "(none)"} · {s.channel}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
