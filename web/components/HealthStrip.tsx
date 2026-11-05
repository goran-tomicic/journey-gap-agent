import type { StepResult } from "../../src/types.js";
import { buildFlags, journeyStats, stepKind } from "../lib/journey";
import type { FlagKind } from "../lib/journey";

const KIND_LABEL: Record<FlagKind, string> = { gap: "missing", conflict: "ownership", mismatch: "no bridge" };

/** Stat tiles plus a one-segment-per-step minimap of the journey. Computed
 * from the steps revealed so far, so it fills in live while streaming. */
export default function HealthStrip({
  sequence,
  pending = 0,
  onSelectStep,
}: {
  sequence: StepResult[];
  pending?: number;
  onSelectStep?: (index: number) => void;
}) {
  const flags = buildFlags(sequence);
  const stats = journeyStats(sequence, flags);

  return (
    <div className="health">
      <div className="health-tiles">
        <div className="health-tile">
          <div className="health-num">{stats.steps + pending}</div>
          <div className="health-label">steps</div>
        </div>
        <div className="health-tile">
          <div className="health-num">{stats.flags}</div>
          <div className="health-label">flags{stats.highConfidence > 0 && ` · ${stats.highConfidence} high confidence`}</div>
        </div>
        <div className="health-tile">
          <div className="health-num">{stats.handoffs}</div>
          <div className="health-label">handoffs{stats.handoffs > 0 && ` · ${stats.unbridged} unbridged`}</div>
        </div>
      </div>

      <div className="minimap" role="list" aria-label="Journey at a glance">
        {sequence.map((s, i) => {
          const kind = stepKind(i, flags);
          return (
            <button
              key={i}
              role="listitem"
              className={`minimap-seg${kind ? ` minimap-${kind}` : ""}`}
              title={`${i + 1}. ${s.step_name}${kind ? ` — ${KIND_LABEL[kind]}` : ""}`}
              onClick={() => onSelectStep?.(i)}
            />
          );
        })}
        {Array.from({ length: pending }).map((_, i) => (
          <span key={`p${i}`} className="minimap-seg minimap-pending" />
        ))}
      </div>

      <div className="health-legend">
        <span className="legend-item">
          <span className="legend-dot minimap-gap" /> {stats.byKind.gap} missing
        </span>
        <span className="legend-item">
          <span className="legend-dot minimap-conflict" /> {stats.byKind.conflict} ownership
        </span>
        <span className="legend-item">
          <span className="legend-dot minimap-mismatch" /> {stats.byKind.mismatch} no bridge
        </span>
      </div>
    </div>
  );
}
