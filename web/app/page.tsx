import Link from "next/link";
import UploadForm from "../components/UploadForm";
import { listReports } from "../lib/reportStore.js";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const reports = listReports();

  return (
    <div className="page">
      <h1>Journey Gap Agent</h1>
      <div className="subtitle">
        Upload a cross-team touchpoint CSV and flag gaps, ownership conflicts, and channel
        mismatches.
      </div>

      <UploadForm />

      <div className="panel">
        <h2>History</h2>
        {reports.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No reports yet.</p>
        ) : (
          <ul className="history-list">
            {reports.map((r) => (
              <li key={r.id} className="history-item">
                <Link href={`/reports/${r.id}`}>{r.sourceName}</Link>
                <span className="meta">
                  {new Date(r.createdAt).toLocaleString()} &middot; {r.report.summary.steps} steps,{" "}
                  {r.report.summary.gaps + r.report.summary.ownership_conflicts + r.report.summary.channel_mismatches}{" "}
                  issues
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
