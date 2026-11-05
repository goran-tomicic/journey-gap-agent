import type { NextStepAction, ProposedChange } from "../../src/types.js";
import type { StoredReport } from "./reportStore.js";

/** localStorage key of the manual journey form's draft. */
export const DRAFT_KEY = "journey-gap-draft";

export interface BaseStep {
  name: string;
  team: string;
  channel: string;
  description: string;
}

/** The journey in the order the agent inferred, with descriptions recovered
 * from the stored input when it exists (older reports lose descriptions). */
export function baseSteps(stored: StoredReport): BaseStep[] {
  const described = new Map((stored.touchpoints ?? []).map((t) => [t.step_name, t.description ?? ""]));
  return stored.report.sequence.map((s) => ({
    name: s.step_name,
    team: s.team.trim() === "(none)" ? "" : s.team.trim(),
    channel: s.channel,
    description: described.get(s.step_name) ?? "",
  }));
}

export function describeChange(c: ProposedChange): string {
  if (c.type === "add_step") {
    return `Add “${c.new_step_name}” (${c.owning_team} · ${c.channel}) after “${c.after_step}”`;
  }
  if (c.type === "assign_owner") return `Make ${c.owning_team} the only owner of “${c.target_step}”`;
  return "";
}

/** Applies the chosen actions' changes to the base journey, in priority order. */
export function applyChanges(base: BaseStep[], actions: NextStepAction[]): BaseStep[] {
  const steps = base.map((s) => ({ ...s }));
  const insertedAfter = new Map<string, number>(); // anchor name -> steps already inserted after it
  for (const a of [...actions].sort((x, y) => x.priority - y.priority)) {
    const c = a.proposed_change;
    if (!c || c.type === "none") continue;
    if (c.type === "assign_owner") {
      const step = steps.find((s) => s.name === c.target_step);
      if (step) step.team = c.owning_team;
    } else if (!steps.some((s) => s.name === c.new_step_name)) {
      const anchor = steps.findIndex((s) => s.name === c.after_step);
      const offset = insertedAfter.get(c.after_step) ?? 0;
      const at = anchor === -1 ? steps.length : anchor + 1 + offset;
      steps.splice(at, 0, { name: c.new_step_name, team: c.owning_team, channel: c.channel, description: "" });
      insertedAfter.set(c.after_step, offset + 1);
    }
  }
  return steps;
}

/** The manual form's draft for a revised journey, opened at its steps stage. */
export function buildRevisionDraft(
  originalName: string,
  originalId: string,
  steps: BaseStep[],
  changeCount: number,
) {
  return {
    name: `${originalName} (revised)`,
    stage: 1,
    revisionOf: originalId,
    note: `Revised from “${originalName}” with ${changeCount} applied change${changeCount === 1 ? "" : "s"}. Review and edit, then analyze.`,
    steps: steps.map((s, i) => ({
      id: `rev${i}${Math.random().toString(36).slice(2, 6)}`,
      name: s.name,
      owners: s.team
        .split(/[/,&]/)
        .map((t) => t.trim())
        .filter(Boolean),
      channel: s.channel,
      description: s.description,
    })),
  };
}
