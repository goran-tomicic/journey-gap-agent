import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractActions, validateChange } from "../src/lib/nextSteps.js";
import { buildFlags, confidenceScore, journeyStats, owners, splitConfidence } from "../web/lib/journey.js";
import { actionToTicket, groupByOwner, planToMarkdown } from "../web/lib/nextStepsText.js";
import { applyChanges, baseSteps, buildRevisionDraft } from "../web/lib/revise.js";
import type { GapReport, NextStepAction, NextSteps, StepResult } from "../src/types.js";
import type { StoredReport } from "../web/lib/reportStore.js";

const step = (step_name: string, team: string, channel: string, issues: StepResult["issues"] = []): StepResult => ({
  step_name,
  team,
  channel,
  issues,
});

const SEQUENCE: StepResult[] = [
  step("Signed", "Sales", "Email"),
  step("Kickoff", "Onboarding", "Call", [
    { type: "gap", position: "before", description: "No scheduling step", confidence: "High confidence — nothing books it" },
    { type: "channel_mismatch", position: "before", description: "Email to call", confidence: "Low-medium confidence — maybe" },
  ]),
  step("Import", "Onboarding / Support", "Internal Tool", [
    { type: "ownership_conflict", position: "on", description: "Two owners", confidence: "High confidence — both claim it" },
  ]),
  step("Check-in", "(none)", "Call", [
    { type: "ownership_conflict", position: "on", description: "Nobody owns it", confidence: "Medium — unowned" },
  ]),
];

const action = (over: Partial<NextStepAction> = {}): NextStepAction => ({
  priority: 1,
  title: "Fix it",
  what_to_do: "Do the thing",
  suggested_owner: "Sales",
  resolves: [{ step: 2, type: "gap" }],
  impact: { score: 4, reason: "big" },
  effort: { score: 2, reason: "small" },
  ...over,
});

describe("journey helpers", () => {
  it("splits owners and treats (none) as unowned", () => {
    assert.deepEqual(owners(SEQUENCE[2]), ["Onboarding", "Support"]);
    assert.deepEqual(owners(SEQUENCE[3]), []);
  });

  it("parses confidence text into a level and a 1-5 score", () => {
    assert.deepEqual(splitConfidence("High confidence — nothing books it"), { level: "high", reason: "nothing books it" });
    assert.equal(splitConfidence("Low-medium confidence — maybe").level, "low-medium");
    assert.deepEqual(["high", "medium-high", "medium", "low-medium", "low", "??"].map(confidenceScore), [5, 4, 3, 2, 1, 3]);
  });

  it("builds flags with the right kind, tag and location", () => {
    const flags = buildFlags(SEQUENCE);
    assert.equal(flags.length, 4);
    const gap = flags.find((f) => f.kind === "gap")!;
    assert.deepEqual([gap.tag, gap.whereText, gap.location], ["missing step", "between 1 and 2", { kind: "edge", index: 1 }]);
    assert.deepEqual(flags.filter((f) => f.kind === "conflict").map((f) => f.tag), ["two owners", "no owner"]);
  });

  it("counts handoffs (team changes) and which are unbridged", () => {
    const stats = journeyStats(SEQUENCE, buildFlags(SEQUENCE));
    assert.equal(stats.flags, 4);
    assert.equal(stats.handoffs, 3);
    assert.equal(stats.unbridged, 1);
    assert.equal(stats.highConfidence, 2);
  });
});

describe("ticket and plan text", () => {
  it("includes done_when only when present", () => {
    assert.match(actionToTicket(action({ done_when: "Email sent" }), "J"), /\*\*Done when:\*\* Email sent/);
    assert.doesNotMatch(actionToTicket(action(), "J"), /Done when/);
  });

  it("groups by owner case-insensitively, ordered by best-ranked action", () => {
    const groups = groupByOwner([
      action({ priority: 3, suggested_owner: "sales" }),
      action({ priority: 1, suggested_owner: "Product" }),
      action({ priority: 2, suggested_owner: "Sales" }),
    ]);
    assert.deepEqual(groups.map((g) => [g.team, g.actions.map((a) => a.priority)]), [
      ["Product", [1]],
      ["Sales", [2, 3]],
    ]);
  });

  it("renders the plan as a checklist per team", () => {
    const data: NextSteps = { top_pick_rationale: "Because.", actions: [action({ done_when: "Done" })] };
    const md = planToMarkdown(data, "J");
    assert.match(md, /^# Next steps — J/);
    assert.match(md, /## Sales\n\n- \[ \] \*\*1\. Fix it\*\*/);
    assert.match(md, /Done when: Done/);
  });
});

describe("revising a journey", () => {
  const report: GapReport = { summary: { steps: 4, gaps: 1, ownership_conflicts: 2, channel_mismatches: 1 }, sequence: SEQUENCE };
  const stored = {
    id: "r1",
    createdAt: "",
    sourceName: "J",
    report,
    touchpoints: [{ step_name: "Kickoff", owning_team: "Onboarding", channel: "Call", description: "Intro call" }],
  } as StoredReport;

  it("recovers descriptions and maps unowned to an empty team", () => {
    const base = baseSteps(stored);
    assert.equal(base[1].description, "Intro call");
    assert.equal(base[3].team, "");
    assert.equal(base[2].team, "Onboarding / Support");
  });

  it("inserts added steps after their anchor, in priority order", () => {
    const add = (priority: number, name: string) =>
      action({ priority, proposed_change: { type: "add_step", new_step_name: name, owning_team: "Sales", channel: "Email", after_step: "Signed" } });
    const out = applyChanges(baseSteps(stored), [add(2, "B"), add(1, "A")]);
    assert.deepEqual(out.map((s) => s.name), ["Signed", "A", "B", "Kickoff", "Import", "Check-in"]);
  });

  it("assigns a single owner and ignores none and duplicate step names", () => {
    const out = applyChanges(baseSteps(stored), [
      action({ priority: 1, proposed_change: { type: "assign_owner", target_step: "Import", owning_team: "Support" } }),
      action({ priority: 2, proposed_change: { type: "none" } }),
      action({ priority: 3, proposed_change: { type: "add_step", new_step_name: "Kickoff", owning_team: "X", channel: "Y", after_step: "Signed" } }),
    ]);
    assert.equal(out.find((s) => s.name === "Import")!.team, "Support");
    assert.equal(out.length, 4);
  });

  it("builds a draft with split owners at the steps stage", () => {
    const draft = buildRevisionDraft("J", "r1", baseSteps(stored), 2);
    assert.equal(draft.name, "J (revised)");
    assert.equal(draft.stage, 1);
    assert.equal(draft.revisionOf, "r1");
    assert.deepEqual(draft.steps[2].owners, ["Onboarding", "Support"]);
    assert.deepEqual(draft.steps[3].owners, []);
  });
});

describe("model output handling", () => {
  it("accepts actions as a list or a JSON string, rejects the rest", () => {
    assert.equal(extractActions({ actions: [action()] })?.length, 1);
    assert.equal(extractActions({ actions: JSON.stringify([action()]) })?.length, 1);
    assert.equal(extractActions({ actions: "not json" }), null);
    assert.equal(extractActions({ actions: [] }), null);
    assert.equal(extractActions(null), null);
  });

  const names = ["Signed", "Kickoff"];
  it("keeps valid changes and normalizes step names", () => {
    assert.deepEqual(
      validateChange({ type: "add_step", new_step_name: "Invite", owning_team: "Sales", channel: "Email", after_step: "signed" }, names),
      { type: "add_step", new_step_name: "Invite", owning_team: "Sales", channel: "Email", after_step: "Signed" },
    );
    assert.deepEqual(validateChange({ type: "assign_owner", target_step: "KICKOFF", owning_team: "Product" }, names), {
      type: "assign_owner",
      target_step: "Kickoff",
      owning_team: "Product",
    });
  });

  it("drops changes that are malformed or name unknown steps", () => {
    assert.equal(validateChange({ type: "add_step", new_step_name: "X", owning_team: "S", channel: "E", after_step: "Nope" }, names), undefined);
    assert.equal(validateChange({ type: "add_step", new_step_name: "", owning_team: "S", channel: "E", after_step: "Signed" }, names), undefined);
    assert.equal(validateChange({ type: "assign_owner", target_step: "Kickoff" }, names), undefined);
    assert.equal(validateChange({ type: "none" }, names), undefined);
    assert.equal(validateChange(undefined, names), undefined);
  });
});
