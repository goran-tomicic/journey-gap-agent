#!/usr/bin/env node
// Journey-gap agent CLI: reads a touchpoint list and flags gaps, ownership
// conflicts, and channel mismatches using Claude.

import { readFileSync, writeFileSync } from "node:fs";
import "dotenv/config";
import { generateGapReport, parseTouchpointsCsv } from "./lib/gapReport.js";
import { renderHtml, renderMarkdown } from "./render.js";

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

  const touchpoints = parseTouchpointsCsv(readFileSync(args.input, "utf-8"));
  const gapReport = await generateGapReport(touchpoints, { apiKey, model: args.model });
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
