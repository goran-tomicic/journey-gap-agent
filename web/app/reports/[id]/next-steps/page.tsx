import Link from "next/link";
import { notFound } from "next/navigation";
import NextSteps from "../../../../components/NextSteps";
import ReportTabs from "../../../../components/ReportTabs";
import { getReport } from "../../../../lib/reportStore.js";

export const dynamic = "force-dynamic";

export default async function NextStepsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = getReport(id);
  if (!stored) notFound();

  return (
    <div className="page">
      <Link href="/" className="back-link">
        &larr; Back
      </Link>
      <div className="eyebrow" style={{ marginTop: 14 }}>
        Next steps
      </div>
      <h1>{stored.sourceName}</h1>
      <div className="subtitle">{new Date(stored.createdAt).toLocaleString()}</div>
      <ReportTabs id={stored.id} active="next-steps" hasNextSteps={!!stored.nextSteps} />
      <NextSteps reportId={stored.id} initial={stored.nextSteps} journeyName={stored.sourceName} />
    </div>
  );
}
