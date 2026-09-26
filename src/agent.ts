#!/usr/bin/env node
// Journey-gap agent: reads a touchpoint list and flags gaps, ownership
// conflicts, and channel mismatches using Claude.

import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const SYSTEM_PROMPT = `You are a journey-gap analysis agent. You are given a list \
of touchpoints/steps in a customer journey that spans multiple teams. Each \
touchpoint has a step name, an owning team, a channel, and an optional \
description. The list may not be in order.

Do the following:
1. Order the steps into the most logical sequence, inferring order where it \
isn't explicit.
2. Flag issues of three kinds, inserted inline at the point they occur:
   - GAP: a step that logically should exist between two others but is \
missing (e.g. a signed contract followed directly by first login, with no \
handoff or welcome step).
   - OWNERSHIP CONFLICT: a step with no owning team, or a step claimed by \
more than one team.
   - CHANNEL MISMATCH: a handoff between two steps on different channels \
with no bridging step (e.g. an internal system handoff followed directly by \
an app login, with no email invite in between).
3. For every flagged issue, give a one-line severity/confidence note \
explaining your reasoning (e.g. "High confidence — no bridging communication \
step exists between an internal-only action and a customer-facing one.").

Output a single markdown document with this structure:

# Journey Gap Report

**Summary:** N steps, N gaps found, N ownership conflicts, N channel \
mismatches

1. **<Step Name>** — <Team> — <Channel>
   > ⚠ GAP / OWNERSHIP CONFLICT / CHANNEL MISMATCH: <description> \
(<severity/confidence note>)
2. **<Step Name>** — <Team> — <Channel>
...

Insert the ⚠ annotations directly after the step they follow (or in place of \
a missing step, numbered as a gap in the sequence). Do not invent detailed \
fixes or new steps beyond naming what's missing — just flag the gap. Only \
flag real issues; do not manufacture problems that aren't there.`;

interface Touchpoint {
  step_name: string;
  owning_team: string;
  channel: string;
  description?: string;
}

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

interface Args {
  input: string;
  output?: string;
  model: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    input: "data/journey.csv",
    model: process.env.CLAUDE_MODEL ?? "claude-sonnet-5",
  };
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
    }
  }
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
    messages: [
      {
        role: "user",
        content:
          "Here is the touchpoint list (unordered), one per line:\n\n" +
          formatTouchpoints(touchpoints),
      },
    ],
  });

  const report = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (args.output) {
    writeFileSync(args.output, report, "utf-8");
    console.log(`Report written to ${args.output}`);
  } else {
    console.log(report);
  }
}

run(parseArgs(process.argv.slice(2))).catch((err) => {
  console.error(err);
  process.exit(1);
});
