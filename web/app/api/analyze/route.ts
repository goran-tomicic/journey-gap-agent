import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { parseTouchpointsCsv, streamGapReport } from "../../../../src/lib/gapReport.js";
import { saveReport } from "../../../lib/reportStore.js";
import type { GapReport, StepResult } from "../../../../src/types.js";

type ProgressEvent =
  | { type: "start"; total: number }
  | { type: "progress"; sequence: StepResult[]; summary?: Partial<GapReport["summary"]> }
  | { type: "done"; id: string; report: GapReport }
  | { type: "error"; error: string };

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

      let csvText: string;
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

        if (useSample) {
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

      let touchpoints;
      try {
        touchpoints = parseTouchpointsCsv(csvText);
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
