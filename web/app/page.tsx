import Link from "next/link";
import UploadForm from "../components/UploadForm";
import { listReports } from "../lib/reportStore.js";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const reports = listReports();

  return (
    <div className="page">
      <div className="eyebrow">Journey analysis</div>
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
            {reports.map((r) => {
              const issueCount =
                r.report.summary.gaps + r.report.summary.ownership_conflicts + r.report.summary.channel_mismatches;
              return (
                <li key={r.id}>
                  <Link href={`/reports/${r.id}`} className="history-item">
                    <div>
                      <div className="history-name">{r.sourceName}</div>
                      <div className="history-meta">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="history-badges">
                      <span className="pill">{r.report.summary.steps} steps</span>
                      <span className="pill pill-gap">{issueCount} issues</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
