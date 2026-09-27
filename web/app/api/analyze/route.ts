import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { generateGapReport, parseTouchpointsCsv } from "../../../../src/lib/gapReport.js";
import { saveReport } from "../../../lib/reportStore.js";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server (check web/.env.local)." },
      { status: 500 }
    );
  }

  let csvText: string;
  let sourceName: string;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  const file = form.get("file");
  const useSample = form.get("useSample") === "true";

  if (useSample) {
    const samplePath = path.join(process.cwd(), "..", "data", "journey.csv");
    csvText = readFileSync(samplePath, "utf-8");
    sourceName = "data/journey.csv (sample)";
  } else if (file instanceof File) {
    csvText = await file.text();
    sourceName = file.name;
  } else {
    return NextResponse.json({ error: "No file uploaded and sample not requested." }, { status: 400 });
  }

  let touchpoints;
  try {
    touchpoints = parseTouchpointsCsv(csvText);
  } catch {
    return NextResponse.json({ error: "Could not parse the CSV file." }, { status: 400 });
  }

  if (touchpoints.length === 0) {
    return NextResponse.json({ error: "CSV has no rows." }, { status: 400 });
  }

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";
  try {
    const gapReport = await generateGapReport(touchpoints, { apiKey, model });
    const stored = saveReport(sourceName, gapReport);
    return NextResponse.json({ id: stored.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Analysis failed. See server logs." }, { status: 502 });
  }
}
