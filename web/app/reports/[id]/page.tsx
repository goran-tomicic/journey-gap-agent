import Link from "next/link";
import { notFound } from "next/navigation";
import RevisionCompare from "../../../components/RevisionCompare";
import ReportTabs from "../../../components/ReportTabs";
import ReportView from "../../../components/ReportView";
import { getReport } from "../../../lib/reportStore.js";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = getReport(id);
  if (!stored) notFound();
  const original = stored.revisionOf ? getReport(stored.revisionOf) : null;

  return (
    <div className="page">
      <Link href="/" className="back-link">
        &larr; Back
      </Link>
      <div className="eyebrow" style={{ marginTop: 14 }}>
        Journey gap report
      </div>
      <h1>{stored.sourceName}</h1>
      <div className="subtitle">{new Date(stored.createdAt).toLocaleString()}</div>
      {original && <RevisionCompare original={original} revised={stored} />}
      <ReportTabs id={stored.id} active="report" hasNextSteps={!!stored.nextSteps} />
      <ReportView summary={stored.report.summary} sequence={stored.report.sequence} />
    </div>
  );
}
