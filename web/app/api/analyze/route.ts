import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { parseTouchpointsCsv, streamGapReport } from "../../../../src/lib/gapReport.js";
import { saveReport } from "../../../lib/reportStore.js";
import type { GapReport, StepResult, Touchpoint } from "../../../../src/types.js";

type ProgressEvent =
  | { type: "start"; total: number }
  | { type: "progress"; sequence: StepResult[]; summary?: Partial<GapReport["summary"]> }
  | { type: "done"; id: string; report: GapReport }
  | { type: "error"; error: string };

const MAX_STEPS = 50;

/** Validates the manual-entry payload from the journey form. */
function validateTouchpoints(json: string): Touchpoint[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Invalid journey data.");
  }
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("Add at least one step.");
  if (raw.length > MAX_STEPS) throw new Error(`A journey can have at most ${MAX_STEPS} steps.`);
  return raw.map((r, i) => {
    const row = (r ?? {}) as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 500) : "");
    const step_name = text(row.step_name);
    const channel = text(row.channel);
    if (!step_name || !channel) throw new Error(`Step ${i + 1} needs a name and a channel.`);
    const description = text(row.description);
    return { step_name, owning_team: text(row.owning_team), channel, ...(description && { description }) };
  });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The SDK's streaming event emitter can deliver its last "inputJson"
      // event just after finalMessage() resolves, i.e. after we've already
      // sent "done" and closed. Guard against enqueueing post-close.
      let closed = false;
      function send(event: ProgressEvent) {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      function close() {
        closed = true;
        controller.close();
      }

      if (!apiKey) {
        send({ type: "error", error: "ANTHROPIC_API_KEY is not set on the server (check web/.env.local)." });
        close();
        return;
      }

      let csvText: string | undefined;
      let manual: Touchpoint[] | undefined;
      let sourceName: string;
      try {
        let form: FormData;
        try {
          form = await req.formData();
        } catch {
          throw new Error("Expected multipart form data.");
        }
        const file = form.get("file");
        const useSample = form.get("useSample") === "true";
        const manualJson = form.get("touchpoints");

        if (typeof manualJson === "string") {
          manual = validateTouchpoints(manualJson);
          const name = form.get("journeyName");
          sourceName = (typeof name === "string" && name.trim().slice(0, 120)) || "Manual entry";
        } else if (useSample) {
          csvText = readFileSync(path.join(process.cwd(), "..", "data", "journey.csv"), "utf-8");
          sourceName = "data/journey.csv (sample)";
        } else if (file instanceof File) {
          csvText = await file.text();
          sourceName = file.name;
        } else {
          throw new Error("No file uploaded and sample not requested.");
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Invalid request." });
        close();
        return;
      }

      let touchpoints: Touchpoint[];
      if (manual) {
        touchpoints = manual;
      } else {
        try {
          touchpoints = parseTouchpointsCsv(csvText ?? "");
        } catch {
          send({ type: "error", error: "Could not parse the CSV file." });
          close();
          return;
        }
        if (touchpoints.length === 0) {
          send({ type: "error", error: "CSV has no rows." });
          close();
          return;
        }
      }

      send({ type: "start", total: touchpoints.length });

      const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";
      try {
        const gapReport = await streamGapReport(touchpoints, { apiKey, model }, (sequence, summary) => {
          send({ type: "progress", sequence, summary });
        });
        const stored = saveReport(sourceName, gapReport);
        send({ type: "done", id: stored.id, report: gapReport });
      } catch (err) {
        console.error(err);
        send({ type: "error", error: "Analysis failed. See server logs." });
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
