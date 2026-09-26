#!/usr/bin/env node
// Journey-gap agent: reads a touchpoint list and flags gaps, ownership
// conflicts, and channel mismatches using Claude.

import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";
import { renderHtml, renderMarkdown } from "./render.js";
import type { GapReport, Touchpoint } from "./types.js";

const SYSTEM_PROMPT = `You are a journey-gap analysis agent. You are given a list \
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

const GAP_REPORT_TOOL: Anthropic.Tool = {
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

function loadTouchpoints(path: string): Touchpoint[] {
  const raw = readFileSync(path, "utf-8");
  return parse(raw, { columns: true, skip_empty_lines: true }) as Touchpoint[];
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

type Format = "md" | "html";

interface Args {
  input: string;
  output?: string;
  model: string;
  format: Format;
}

function inferFormat(output: string | undefined): Format {
  if (output?.endsWith(".html")) return "html";
  return "md";
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    input: "data/journey.csv",
    model: process.env.CLAUDE_MODEL ?? "claude-sonnet-5",
    format: "md",
  };
  let formatOverride: Format | undefined;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--input" && value) {
      args.input = value;
      i++;
    } else if (flag === "--output" && value) {
      args.output = value;
      i++;
    } else if (flag === "--model" && value) {
      args.model = value;
      i++;
    } else if (flag === "--format" && (value === "md" || value === "html")) {
      formatOverride = value;
      i++;
    }
  }
  args.format = formatOverride ?? inferFormat(args.output);
  return args;
}

async function run(args: Args): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set (check your .env file).");
    process.exit(1);
  }

  const touchpoints = loadTouchpoints(args.input);
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: args.model,
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
  const output = args.format === "html" ? renderHtml(gapReport) : renderMarkdown(gapReport);

  if (args.output) {
    writeFileSync(args.output, output, "utf-8");
    console.log(`Report written to ${args.output}`);
  } else {
    console.log(output);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  run(args).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

main();
