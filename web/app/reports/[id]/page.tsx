import Link from "next/link";
import { notFound } from "next/navigation";
import GapTimeline from "../../../components/GapTimeline";
import { getReport } from "../../../lib/reportStore.js";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = getReport(id);
  if (!stored) notFound();

  return (
    <div className="page">
      <p>
        <Link href="/">&larr; Back</Link>
      </p>
      <h1>Journey Gap Report</h1>
      <div className="subtitle">
        {stored.sourceName} &middot; {new Date(stored.createdAt).toLocaleString()}
      </div>
      <GapTimeline summary={stored.report.summary} sequence={stored.report.sequence} />
    </div>
  );
}
