import type { IssueType, NextStepAction, NextSteps } from "../../src/types.js";

const ISSUE_LABEL: Record<IssueType, string> = {
  gap: "missing step",
  ownership_conflict: "ownership",
  channel_mismatch: "channel mismatch",
};

function clears(a: NextStepAction): string {
  return a.resolves.map((r) => `${ISSUE_LABEL[r.type]} at step ${r.step}`).join("; ");
}

/** One action as a Markdown ticket, ready to paste into any tracker. */
export function actionToTicket(a: NextStepAction, journeyName?: string): string {
  const lines = [`## ${a.title}`, ""];
  if (a.resolves.length) lines.push(`**Why:** clears ${clears(a)}.`);
  lines.push(`**What to do:** ${a.what_to_do}`);
  lines.push(`**Owner:** ${a.suggested_owner}`);
  if (a.done_when) lines.push(`**Done when:** ${a.done_when}`);
  lines.push(`**Impact:** ${a.impact.score}/5 — ${a.impact.reason}`);
  lines.push(`**Effort:** ${a.effort.score}/5 — ${a.effort.reason}`);
  if (journeyName) lines.push("", `_From the journey analysis of ${journeyName}._`);
  return lines.join("\n");
}

/** Actions grouped by suggested owner; teams ordered by their best-ranked action. */
export function groupByOwner(actions: NextStepAction[]): { team: string; actions: NextStepAction[] }[] {
  const groups = new Map<string, { team: string; actions: NextStepAction[] }>();
  for (const a of [...actions].sort((x, y) => x.priority - y.priority)) {
    const team = a.suggested_owner.trim() || "Unassigned";
    const key = team.toLowerCase();
    const group = groups.get(key) ?? { team, actions: [] };
    group.actions.push(a);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The whole plan as Markdown: a checklist per owning team, ranked within each. */
export function planToMarkdown(data: NextSteps, journeyName?: string): string {
  const lines = [`# Next steps${journeyName ? ` — ${journeyName}` : ""}`, ""];
  if (data.top_pick_rationale && data.actions.length) lines.push(`Start with #1. ${data.top_pick_rationale}`, "");
  for (const g of groupByOwner(data.actions)) {
    lines.push(`## ${g.team}`, "");
    for (const a of g.actions) {
      lines.push(`- [ ] **${a.priority}. ${a.title}** — ${a.what_to_do}`);
      if (a.done_when) lines.push(`  - Done when: ${a.done_when}`);
      lines.push(`  - Impact ${a.impact.score}/5, effort ${a.effort.score}/5`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
