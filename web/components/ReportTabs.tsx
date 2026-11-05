import Link from "next/link";

/** Report | Next steps tab bar shared by the two report pages. */
export default function ReportTabs({ id, active, hasNextSteps }: { id?: string; active: "report" | "next-steps"; hasNextSteps: boolean }) {
  // No id yet (analysis still running): same bar, not clickable, so nothing shifts when it arrives.
  if (!id) {
    return (
      <nav className="tabs" aria-label="Report sections">
        <span className="tab tab-active tab-disabled">Report</span>
        <span className="tab tab-disabled">Next steps</span>
      </nav>
    );
  }
  return (
    <nav className="tabs" aria-label="Report sections">
      <Link href={`/reports/${id}`} className={`tab${active === "report" ? " tab-active" : ""}`}>
        Report
      </Link>
      <Link href={`/reports/${id}/next-steps`} className={`tab${active === "next-steps" ? " tab-active" : ""}`}>
        Next steps{hasNextSteps && <span className="tab-dot" aria-label="generated" />}
      </Link>
    </nav>
  );
}
