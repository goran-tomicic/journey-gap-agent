import Anthropic from "@anthropic-ai/sdk";
import type { GapReport, NextStepAction, NextSteps, ProposedChange } from "../types.js";
import type { GenerateOptions } from "./gapReport.js";

const SYSTEM_PROMPT = `You are a journey-improvement advisor. You are given the \
result of a journey gap analysis: an ordered list of steps across teams, each \
with the issues flagged on it (missing steps, ownership conflicts, channel \
mismatches), plus a confidence note per issue.

Turn the flags into a short, prioritized list of concrete next steps:
1. Group flags that share a root cause into one action (e.g. an unowned \
handoff that also explains a missing step). Every flag should be covered by an \
action unless it is clearly too minor to act on.
2. For each action give a title, a one-or-two sentence "what_to_do", a \
one-sentence "done_when" that says how someone would verify the fix is in \
place (observable and specific, e.g. "Every signed order form triggers a \
kickoff-scheduling email within one business day"), a suggested owning team (use teams that appear in the journey where possible), \
and the flags it resolves (1-based step number as shown, plus issue type).
3. Score impact (how much journey risk or customer friction it removes, \
including how many flags it clears and whether it unblocks downstream steps) \
and effort (how much work to do it), each 1-5 with a one-line reason.
4. Rank the actions by value: highest impact for the effort first. Use \
"priority" 1..N with no ties. Prefer fixes that clear the most or the most \
severe flags; low-confidence flags should rank lower. Keep ranking consistent \
with your scores: an action must not rank below another that has lower impact \
and higher-or-equal effort. Score honestly and use the full 1-5 range.
5. For each action, also give "proposed_change" ONLY when the fix is a \
concrete step or owner change; otherwise use {"type":"none"}:
   - add_step: a new step that fills a missing step or bridges a channel \
change. Give "new_step_name" (short), "owning_team", "channel", and \
"after_step": the EXACT name of an existing step (copied verbatim from the \
list) that the new step should come directly after.
   - assign_owner: give "target_step" (the EXACT existing step name) and \
"owning_team" (a single team).
   Keep proposed steps minimal and reuse teams and channels already in the \
journey where possible.
6. In "top_pick_rationale" explain in one or two sentences why priority 1 is \
the most valuable thing to do first, compared with the alternatives.

Keep it short and specific. Do not design full replacement steps or write \
long plans. Call the submit_next_steps tool exactly once.`;

const NEXT_STEPS_TOOL: Anthropic.Tool = {
  name: "submit_next_steps",
  description: "Submit the prioritized next steps for the journey.",
  input_schema: {
    type: "object",
    properties: {
      top_pick_rationale: { type: "string" },
      actions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            priority: { type: "integer" },
            title: { type: "string" },
            what_to_do: { type: "string" },
            done_when: { type: "string" },
            suggested_owner: { type: "string" },
            resolves: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  step: { type: "integer" },
                  type: { type: "string", enum: ["gap", "ownership_conflict", "channel_mismatch"] },
                },
                required: ["step", "type"],
              },
            },
            impact: {
              type: "object",
              properties: { score: { type: "integer" }, reason: { type: "string" } },
              required: ["score", "reason"],
            },
            effort: {
              type: "object",
              properties: { score: { type: "integer" }, reason: { type: "string" } },
              required: ["score", "reason"],
            },
            proposed_change: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["add_step", "assign_owner", "none"] },
                new_step_name: { type: "string" },
                owning_team: { type: "string" },
                channel: { type: "string" },
                after_step: { type: "string" },
                target_step: { type: "string" },
              },
              required: ["type"],
            },
          },
          required: ["priority", "title", "what_to_do", "done_when", "suggested_owner", "resolves", "impact", "effort", "proposed_change"],
        },
      },
    },
    required: ["top_pick_rationale", "actions"],
  },
};

function formatReport(report: GapReport): string {
  return report.sequence
    .map((s, i) => {
      const head = `${i + 1}. ${s.step_name} — team: ${s.team.trim() || "(none)"}, channel: ${s.channel}`;
      const issues = s.issues.map((x) => `   - ${x.type} (${x.position}): ${x.description} [${x.confidence}]`);
      return [head, ...issues].join("\n");
    })
    .join("\n");
}

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n) || 1)));

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Models occasionally return a nested field as a JSON string instead of a
 * list. Accept either; anything else (or an unparseable string) is unusable. */
export function extractActions(input: unknown): NextStepAction[] | null {
  let actions = (input as { actions?: unknown } | null)?.actions;
  if (typeof actions === "string") {
    try {
      actions = JSON.parse(actions);
    } catch {
      return null;
    }
  }
  return Array.isArray(actions) && actions.length > 0 ? (actions as NextStepAction[]) : null;
}

/** Keeps a proposed change only if it is well-formed and refers to steps that
 * really exist (matched case-insensitively, then normalized to the exact
 * name). Anything else becomes undefined, so a bad proposal is never offered. */
export function validateChange(raw: unknown, stepNames: string[]): ProposedChange | undefined {
  const c = (raw ?? {}) as Record<string, unknown>;
  const exact = (name: unknown) => stepNames.find((n) => n.toLowerCase() === text(name).toLowerCase());
  if (c.type === "add_step") {
    const after = exact(c.after_step);
    const [name, team, channel] = [text(c.new_step_name), text(c.owning_team), text(c.channel)];
    if (after && name && team && channel) {
      return { type: "add_step", new_step_name: name, owning_team: team, channel, after_step: after };
    }
  } else if (c.type === "assign_owner") {
    const target = exact(c.target_step);
    const team = text(c.owning_team);
    if (target && team) return { type: "assign_owner", target_step: target, owning_team: team };
  }
  return undefined;
}

/** Calls Claude to turn a finished gap report into prioritized next steps.
 * The model does the ranking; this only normalizes its output (clamps scores,
 * orders by priority, renumbers 1..N, drops proposed changes that don't match
 * real steps). A malformed response is retried once. A report with no issues
 * skips the call. */
export async function generateNextSteps(report: GapReport, options: GenerateOptions): Promise<NextSteps> {
  const flagCount = report.sequence.reduce((n, s) => n + s.issues.length, 0);
  if (flagCount === 0) {
    return { top_pick_rationale: "No issues were flagged, so there is nothing to fix.", actions: [] };
  }

  const client = new Anthropic({ apiKey: options.apiKey });
  const stepNames = report.sequence.map((s) => s.step_name);

  let raw: { top_pick_rationale?: string } | undefined;
  let found: NextStepAction[] | null = null;
  for (let attempt = 0; attempt < 2 && !found; attempt++) {
    const message = await client.messages.create({
      model: options.model,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      tools: [NEXT_STEPS_TOOL],
      tool_choice: { type: "tool", name: "submit_next_steps" },
      messages: [{ role: "user", content: "Gap analysis result:\n\n" + formatReport(report) }],
    });
    const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) continue;
    raw = toolUse.input as { top_pick_rationale?: string };
    found = extractActions(raw);
  }
  if (!found) throw new Error("Model did not return usable next steps");

  const actions: NextStepAction[] = [...found]
    .sort((a, b) => a.priority - b.priority)
    .map((a, i) => {
      const proposed = validateChange(a.proposed_change, stepNames);
      return {
        ...a,
        priority: i + 1,
        resolves: a.resolves ?? [],
        impact: { ...a.impact, score: clamp(a.impact.score) },
        effort: { ...a.effort, score: clamp(a.effort.score) },
        proposed_change: proposed ?? { type: "none" },
      };
    });
  return { top_pick_rationale: text(raw?.top_pick_rationale), actions };
}
