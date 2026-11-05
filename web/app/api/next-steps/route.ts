import { NextRequest, NextResponse } from "next/server";
import { generateNextSteps } from "../../../../src/lib/nextSteps.js";
import { getReport, saveNextSteps } from "../../../lib/reportStore.js";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server (check web/.env.local)." },
      { status: 500 },
    );
  }

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const stored = typeof id === "string" ? getReport(id) : null;
  if (!stored) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  // Already generated for this report: return the saved result instead of re-running.
  if (stored.nextSteps) return NextResponse.json({ nextSteps: stored.nextSteps });

  try {
    const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";
    const nextSteps = await generateNextSteps(stored.report, { apiKey, model });
    saveNextSteps(stored.id, nextSteps);
    return NextResponse.json({ nextSteps });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not generate next steps. See server logs." }, { status: 500 });
  }
}
