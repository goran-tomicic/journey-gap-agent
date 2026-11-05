import Anthropic from "@anthropic-ai/sdk";
import type { GapReport, NextStepAction, NextSteps } from "../types.js";
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
5. In "top_pick_rationale" explain in one or two sentences why priority 1 is \
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
          },
          required: ["priority", "title", "what_to_do", "done_when", "suggested_owner", "resolves", "impact", "effort"],
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

/** Calls Claude to turn a finished gap report into prioritized next steps.
 * The model does the ranking; this only normalizes its output (clamps scores,
 * orders by priority, renumbers 1..N). A report with no issues skips the call. */
export async function generateNextSteps(report: GapReport, options: GenerateOptions): Promise<NextSteps> {
  const flagCount = report.sequence.reduce((n, s) => n + s.issues.length, 0);
  if (flagCount === 0) {
    return { top_pick_rationale: "No issues were flagged, so there is nothing to fix.", actions: [] };
  }

  const client = new Anthropic({ apiKey: options.apiKey });
  const message = await client.messages.create({
    model: options.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [NEXT_STEPS_TOOL],
    tool_choice: { type: "tool", name: "submit_next_steps" },
    messages: [{ role: "user", content: "Gap analysis result:\n\n" + formatReport(report) }],
  });

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Model did not call submit_next_steps");

  const raw = toolUse.input as NextSteps;
  const actions: NextStepAction[] = [...raw.actions]
    .sort((a, b) => a.priority - b.priority)
    .map((a, i) => ({
      ...a,
      priority: i + 1,
      resolves: a.resolves ?? [],
      impact: { ...a.impact, score: clamp(a.impact.score) },
      effort: { ...a.effort, score: clamp(a.effort.score) },
    }));
  return { top_pick_rationale: raw.top_pick_rationale, actions };
}
