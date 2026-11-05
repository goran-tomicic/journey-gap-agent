import Link from "next/link";
import type { StoredReport } from "../lib/reportStore.js";
import { buildFlags, journeyStats } from "../lib/journey";
import type { Flag } from "../lib/journey";

function summarize(r: StoredReport) {
  const flags = buildFlags(r.report.sequence);
  return { flags, stats: journeyStats(r.report.sequence, flags) };
}

function Delta({ label, before, after }: { label: string; before: number; after: number }) {
  const tone = after < before ? "better" : after > before ? "worse" : "same";
  return (
    <div className="cmp-stat">
      <div className="cmp-stat-num">
        {before} <span className="cmp-arrow">→</span> <span className={`cmp-${tone}`}>{after}</span>
      </div>
      <div className="cmp-stat-label">{label}</div>
    </div>
  );
}

function FlagList({ title, flags, stepCount }: { title: string; flags: Flag[]; stepCount: number }) {
  return (
    <div className="cmp-col">
      <div className="cmp-col-title">
        {title} <span>{stepCount} steps · {flags.length} flags</span>
      </div>
      {flags.length === 0 ? (
        <p className="cmp-empty">No flags.</p>
      ) : (
        <ul>
          {flags.map((f, i) => (
            <li key={i} className={`cmp-flag cmp-flag-${f.kind}`}>
              <span className="cmp-flag-tag">{f.tag}</span> <span className="cmp-flag-where">{f.whereText}</span>
              <div className="cmp-flag-text">{f.issue.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Original and revised analysis side by side. Flags are listed, not matched:
 * the model's wording and step numbering differ between runs. */
export default function RevisionCompare({ original, revised }: { original: StoredReport; revised: StoredReport }) {
  const a = summarize(original);
  const b = summarize(revised);
  const verdict =
    b.stats.flags < a.stats.flags
      ? `${a.stats.flags - b.stats.flags} fewer flag${a.stats.flags - b.stats.flags === 1 ? "" : "s"} than the original.`
      : b.stats.flags > a.stats.flags
        ? `${b.stats.flags - a.stats.flags} more flag${b.stats.flags - a.stats.flags === 1 ? "" : "s"} than the original.`
        : "The same number of flags as the original; check whether they are the same ones.";

  return (
    <section className="cmp">
      <div className="cmp-head">
        <h2>Compared with the original</h2>
        <Link href={`/reports/${original.id}`}>Open original report</Link>
      </div>
      <p className="cmp-verdict">{verdict}</p>
      <div className="cmp-stats">
        <Delta label="steps" before={a.stats.steps} after={b.stats.steps} />
        <Delta label="flags" before={a.stats.flags} after={b.stats.flags} />
        <Delta label="missing steps" before={a.stats.byKind.gap} after={b.stats.byKind.gap} />
        <Delta label="ownership issues" before={a.stats.byKind.conflict} after={b.stats.byKind.conflict} />
        <Delta label="unbridged handoffs" before={a.stats.unbridged} after={b.stats.unbridged} />
      </div>
      <div className="cmp-cols">
        <FlagList title="Original" flags={a.flags} stepCount={a.stats.steps} />
        <FlagList title="Revised" flags={b.flags} stepCount={b.stats.steps} />
      </div>
      <p className="cmp-note">
        Flags are listed side by side rather than matched one-to-one: the model may word or number the same issue
        differently between runs.
      </p>
    </section>
  );
}
