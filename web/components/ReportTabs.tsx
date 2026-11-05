import Link from "next/link";

/** Report | Next steps tab bar shared by the two report pages. */
export default function ReportTabs({ id, active, hasNextSteps }: { id: string; active: "report" | "next-steps"; hasNextSteps: boolean }) {
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
