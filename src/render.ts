import type { GapReport, Issue, StepResult } from "./types.js";

const ISSUE_LABEL: Record<Issue["type"], string> = {
  gap: "GAP",
  ownership_conflict: "OWNERSHIP CONFLICT",
  channel_mismatch: "CHANNEL MISMATCH",
};

export function renderMarkdown(report: GapReport): string {
  const { summary, sequence } = report;
  const lines: string[] = [
    "# Journey Gap Report",
    "",
    `**Summary:** ${summary.steps} steps, ${summary.gaps} gaps found, ` +
      `${summary.ownership_conflicts} ownership conflicts, ${summary.channel_mismatches} channel mismatches`,
    "",
  ];

  sequence.forEach((step, i) => {
    const team = step.team.trim() || "(none)";
    lines.push(`${i + 1}. **${step.step_name}** — ${team} — ${step.channel}`);
    for (const issue of step.issues) {
      lines.push(`   > ⚠ ${ISSUE_LABEL[issue.type]}: ${issue.description} (${issue.confidence})`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function beforeIssues(step: StepResult): Issue[] {
  return step.issues.filter((i) => i.position === "before");
}

function onIssues(step: StepResult): Issue[] {
  return step.issues.filter((i) => i.position === "on");
}

function renderConnector(issues: Issue[]): string {
  const broken = issues.length > 0;
  const lineStroke = broken ? "var(--issue)" : "var(--line)";
  const dash = broken ? ' stroke-dasharray="5,5"' : "";
  const svg = `<svg class="connector-line" width="24" height="56" viewBox="0 0 24 56" aria-hidden="true">
    <line x1="12" y1="0" x2="12" y2="44" stroke="${lineStroke}" stroke-width="2"${dash} />
    <polygon points="5,42 19,42 12,54" fill="${lineStroke}" />
  </svg>`;

  if (!broken) {
    return `<div class="connector">${svg}</div>`;
  }

  const notes = issues
    .map(
      (issue) =>
        `<div class="issue-note issue-${issue.type}">
          <span class="issue-label">⚠ ${ISSUE_LABEL[issue.type]}</span>
          <span class="issue-text">${escapeHtml(issue.description)}</span>
          <span class="issue-confidence">${escapeHtml(issue.confidence)}</span>
        </div>`
    )
    .join("");

  return `<div class="connector connector-broken">${svg}<div class="issue-notes">${notes}</div></div>`;
}

function renderStepCard(step: StepResult, index: number): string {
  const team = step.team.trim() || "(none)";
  const flagged = onIssues(step);
  const flaggedClass = flagged.length > 0 ? " step-card-flagged" : "";

  const flaggedHtml = flagged
    .map(
      (issue) =>
        `<div class="issue-note issue-${issue.type}">
          <span class="issue-label">⚠ ${ISSUE_LABEL[issue.type]}</span>
          <span class="issue-text">${escapeHtml(issue.description)}</span>
          <span class="issue-confidence">${escapeHtml(issue.confidence)}</span>
        </div>`
    )
    .join("");

  return `<div class="step-card${flaggedClass}">
    <div class="step-index">${index + 1}</div>
    <div class="step-body">
      <div class="step-name">${escapeHtml(step.step_name)}</div>
      <div class="step-meta">${escapeHtml(team)} &middot; ${escapeHtml(step.channel)}</div>
      ${flaggedHtml}
    </div>
  </div>`;
}

export function renderHtml(report: GapReport): string {
  const { summary, sequence } = report;

  const timeline = sequence
    .map((step, i) => {
      const connector = i > 0 ? renderConnector(beforeIssues(step)) : "";
      return connector + renderStepCard(step, i);
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Journey Gap Report</title>
<style>
  :root {
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #6b7280;
    --card-bg: #f8fafc;
    --card-border: #e2e8f0;
    --line: #cbd5e1;
    --issue: #dc2626;
    --issue-bg: #fef2f2;
    --issue-border: #fecaca;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115;
      --fg: #e5e7eb;
      --muted: #9ca3af;
      --card-bg: #1a1d24;
      --card-border: #2a2e37;
      --line: #3f4551;
      --issue: #f87171;
      --issue-bg: #2a1616;
      --issue-border: #5b2323;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 16px 64px;
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .page { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin-bottom: 4px; }
  .summary {
    color: var(--muted);
    font-size: 0.95rem;
    margin-bottom: 32px;
  }
  .timeline { display: flex; flex-direction: column; align-items: stretch; }
  .connector {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding-left: 22px;
  }
  .connector-line { flex-shrink: 0; }
  .issue-notes { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
  .step-card {
    display: flex;
    gap: 14px;
    padding: 16px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 10px;
  }
  .step-card-flagged { border-color: var(--issue-border); }
  .step-index {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--line);
    color: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .step-card-flagged .step-index { background: var(--issue); }
  .step-body { flex: 1; min-width: 0; }
  .step-name { font-weight: 600; font-size: 1.02rem; }
  .step-meta { color: var(--muted); font-size: 0.85rem; margin-top: 2px; }
  .issue-note {
    margin-top: 10px;
    padding: 8px 10px;
    background: var(--issue-bg);
    border: 1px solid var(--issue-border);
    border-radius: 8px;
    font-size: 0.85rem;
    line-height: 1.4;
  }
  .issue-label {
    display: block;
    font-weight: 700;
    color: var(--issue);
    margin-bottom: 2px;
  }
  .issue-text { display: block; }
  .issue-confidence { display: block; color: var(--muted); font-size: 0.78rem; margin-top: 2px; }
</style>
</head>
<body>
  <div class="page">
    <h1>Journey Gap Report</h1>
    <div class="summary">
      ${summary.steps} steps &middot; ${summary.gaps} gaps found &middot;
      ${summary.ownership_conflicts} ownership conflicts &middot;
      ${summary.channel_mismatches} channel mismatches
    </div>
    <div class="timeline">
      ${timeline}
    </div>
  </div>
</body>
</html>
`;
}
