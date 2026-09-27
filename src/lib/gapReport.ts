import { parse } from "csv-parse/sync";
import Anthropic from "@anthropic-ai/sdk";
import type { GapReport, Touchpoint } from "../types.js";

export const SYSTEM_PROMPT = `You are a journey-gap analysis agent. You are given a list \
of touchpoints/steps in a customer journey that spans multiple teams. Each \
touchpoint has a step name, an owning team, a channel, and an optional \
description. The list may not be in order.

Do the following:
1. Order the steps into the most logical sequence, inferring order where it \
isn't explicit.
2. Flag issues of three kinds:
   - gap: a step that logically should exist between two others but is \
missing (e.g. a signed contract followed directly by first login, with no \
handoff or welcome step). Attach this to the step that comes AFTER the gap, \
with position "before" (it describes the broken handoff leading into that step).
   - ownership_conflict: a step with no owning team, or a step claimed by \
more than one team. Attach this to the step itself, with position "on".
   - channel_mismatch: a handoff between two steps on different channels \
with no bridging step (e.g. an internal system handoff followed directly by \
an app login, with no email invite in between). Attach this to the step that \
comes AFTER the mismatch, with position "before".
3. For every flagged issue, write a one-line severity/confidence note in \
"confidence" explaining your reasoning (e.g. "High confidence — no bridging \
communication step exists between an internal-only action and a \
customer-facing one.").

Call the submit_gap_report tool exactly once with the result. "sequence" \
must list every input step exactly once, in the inferred order. Only flag \
real issues; do not manufacture problems that aren't there.`;

const ISSUE_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["gap", "ownership_conflict", "channel_mismatch"] },
    position: { type: "string", enum: ["before", "on"] },
    description: { type: "string" },
    confidence: { type: "string" },
  },
  required: ["type", "position", "description", "confidence"],
};

export const GAP_REPORT_TOOL: Anthropic.Tool = {
  name: "submit_gap_report",
  description: "Submit the completed journey gap report.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "object",
        properties: {
          steps: { type: "integer" },
          gaps: { type: "integer" },
          ownership_conflicts: { type: "integer" },
          channel_mismatches: { type: "integer" },
        },
        required: ["steps", "gaps", "ownership_conflicts", "channel_mismatches"],
      },
      sequence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            step_name: { type: "string" },
            team: { type: "string" },
            channel: { type: "string" },
            issues: { type: "array", items: ISSUE_SCHEMA },
          },
          required: ["step_name", "team", "channel", "issues"],
        },
      },
    },
    required: ["summary", "sequence"],
  },
};

export function parseTouchpointsCsv(csvText: string): Touchpoint[] {
  return parse(csvText, { columns: true, skip_empty_lines: true }) as Touchpoint[];
}

function formatTouchpoints(touchpoints: Touchpoint[]): string {
  return touchpoints
    .map((t, i) => {
      const owner = t.owning_team.trim() || "(none)";
      return `${i + 1}. step_name=${JSON.stringify(t.step_name)}, owning_team=${JSON.stringify(
        owner
      )}, channel=${JSON.stringify(t.channel)}, description=${JSON.stringify(
        t.description ?? ""
      )}`;
    })
    .join("\n");
}

export interface GenerateOptions {
  apiKey: string;
  model: string;
}

/** Calls Claude to sequence the journey and flag gaps. Throws if the model
 * doesn't call the tool. Logs (does not throw) if the returned step count
 * doesn't match the input, since that indicates a hallucinated/dropped step. */
export async function generateGapReport(
  touchpoints: Touchpoint[],
  options: GenerateOptions
): Promise<GapReport> {
  const client = new Anthropic({ apiKey: options.apiKey });

  const message = await client.messages.create({
    model: options.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [GAP_REPORT_TOOL],
    tool_choice: { type: "tool", name: "submit_gap_report" },
    messages: [
      {
        role: "user",
        content:
          "Here is the touchpoint list (unordered), one per line:\n\n" +
          formatTouchpoints(touchpoints),
      },
    ],
  });

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Model did not call submit_gap_report");
  }

  const gapReport = toolUse.input as GapReport;
  if (gapReport.sequence.length !== touchpoints.length) {
    console.error(
      `Warning: model returned ${gapReport.sequence.length} steps, input had ${touchpoints.length}.`
    );
  }
  return gapReport;
}
