"use client";

import { useState } from "react";
import type { GapReport, StepResult } from "../../src/types.js";
import { buildFlags, owners, sameLocation } from "../lib/journey";
import type { Flag, FlagKind, FlagLocation } from "../lib/journey";
import HealthStrip from "./HealthStrip";
import ScoreMeter from "./ScoreMeter";

const COL_W = 108;
const LABEL_W = 120;
const LANE_H = 60;
const TOP = 16;
const NODE_R = 15;
const TRACK_H = 22;
const CHANNEL_COLORS = ["#4f46e5", "#0f766e", "#c2410c", "#be185d", "#0369a1", "#4d7c0f"];

const KIND_VAR: Record<FlagKind, string> = {
  gap: "var(--gap)",
  conflict: "var(--conflict)",
  mismatch: "var(--mismatch)",
};

function wrapLabel(text: string, max = 14): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim();
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const out = lines.slice(0, 2);
  if (lines.length > 2) out[1] = out[1].slice(0, max - 1) + "…";
  return out.map((l) => (l.length > max ? l.slice(0, max - 1) + "…" : l));
}

interface MapViewProps {
  summary?: Partial<GapReport["summary"]>;
  sequence: StepResult[];
  /** Total steps expected; the remainder render as placeholders while streaming. */
  totalSteps?: number;
  resolvedStyle?: boolean;
}

export default function MapView({ sequence, totalSteps }: MapViewProps) {
  const [selected, setSelected] = useState<FlagLocation | null>(null);
  const [hidden, setHidden] = useState<Set<FlagKind>>(new Set());

  const pending = Math.max(0, (totalSteps ?? sequence.length) - sequence.length);
  const n = sequence.length + pending;
  const flags = buildFlags(sequence);

  // Lanes: one per team, in order of first appearance; unowned steps get their own.
  const laneNames: string[] = [];
  const stepLanes = sequence.map((s) => {
    const o = owners(s);
    const lanes = o.length ? o : ["Unowned"];
    lanes.forEach((l) => !laneNames.includes(l) && laneNames.push(l));
    return lanes.map((l) => laneNames.indexOf(l));
  });
  const laneCount = Math.max(1, laneNames.length);

  const channelOrder: string[] = [];
  sequence.forEach((s) => !channelOrder.includes(s.channel) && channelOrder.push(s.channel));
  const channelColor = (c: string) => CHANNEL_COLORS[channelOrder.indexOf(c) % CHANNEL_COLORS.length];

  const cx = (i: number) => LABEL_W + COL_W * i + COL_W / 2;
  const cy = (lane: number) => TOP + lane * LANE_H + LANE_H / 2;
  const trackY = TOP + laneCount * LANE_H + 14;
  const labelY = trackY + TRACK_H + 20;
  const width = LABEL_W + COL_W * n + 8;
  const height = labelY + 40;

  const flagsAt = (loc: FlagLocation) => flags.filter((f) => sameLocation(f.location, loc));
  const dim = (loc: FlagLocation) => (selected && !sameLocation(selected, loc) ? 0.45 : 1);

  function toggle(loc: FlagLocation) {
    setSelected((cur) => (sameLocation(cur, loc) ? null : loc));
  }

  // Merge consecutive steps on the same channel into one track segment.
  const segments: { channel: string; from: number; to: number }[] = [];
  sequence.forEach((s, i) => {
    const last = segments[segments.length - 1];
    if (last && last.channel === s.channel) last.to = i;
    else segments.push({ channel: s.channel, from: i, to: i });
  });

  const visibleFlags = flags
    .filter((f) => !hidden.has(f.kind))
    .filter((f) => !selected || sameLocation(f.location, selected))
    .sort((a, b) => b.score - a.score || a.location.index - b.location.index);

  const counts: Record<FlagKind, number> = { gap: 0, conflict: 0, mismatch: 0 };
  flags.forEach((f) => counts[f.kind]++);

  const selectedTitle = selected
    ? selected.kind === "step"
      ? `Step ${selected.index + 1} · ${sequence[selected.index]?.step_name}`
      : `Handoff ${selected.index} → ${selected.index + 1} · ${sequence[selected.index - 1]?.step_name} → ${sequence[selected.index]?.step_name}`
    : null;

  return (
    <div className="map-view">
      <HealthStrip sequence={sequence} pending={pending} onSelectStep={(i) => toggle({ kind: "step", index: i })} />

      <div className="map-card">
        <div className="map-scroll">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Journey map by team and channel" style={{ minWidth: width }}>
            {/* lane bands + labels */}
            {Array.from({ length: laneCount }).map((_, l) => (
              <g key={l}>
                {l % 2 === 0 && <rect x={0} y={TOP + l * LANE_H} width={width} height={LANE_H} className="map-band" />}
                <text x={12} y={cy(l) + 4} className="map-lane-label">
                  {(laneNames[l] ?? "…").length > 16 ? (laneNames[l] ?? "…").slice(0, 15) + "…" : laneNames[l] ?? "…"}
                </text>
              </g>
            ))}

            {/* handoffs */}
            {sequence.map((_, i) => {
              if (i === 0) return null;
              const loc: FlagLocation = { kind: "edge", index: i };
              const here = flagsAt(loc);
              const x1 = cx(i - 1);
              const x2 = cx(i);
              const y1 = cy(stepLanes[i - 1][0]);
              const y2 = cy(stepLanes[i][0]);
              const xm = (x1 + x2) / 2;
              const d = y1 === y2 ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${x2} ${y2}`;
              const broken = here.length > 0;
              const hasGap = here.some((f) => f.kind === "gap");
              const color = broken ? (hasGap ? KIND_VAR.gap : KIND_VAR.mismatch) : undefined;
              const isSel = sameLocation(selected, loc);
              return (
                <g key={i} opacity={dim(loc)}>
                  <path
                    d={d}
                    className={broken ? "map-edge map-edge-broken" : "map-edge"}
                    style={color ? { stroke: color } : undefined}
                    strokeWidth={isSel ? 3.5 : 2}
                  />
                  {broken && (
                    <g
                      className="map-hit"
                      role="button"
                      tabIndex={0}
                      aria-label={`Handoff ${i} to ${i + 1}: ${here.map((f) => f.tag).join(", ")}`}
                      onClick={() => toggle(loc)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(loc))}
                    >
                      <path d={d} stroke="transparent" strokeWidth={18} fill="none" />
                      {here.map((f, k) => {
                        const bx = xm + (k - (here.length - 1) / 2) * 24;
                        const by = (y1 + y2) / 2;
                        return (
                          <g key={k}>
                            <circle cx={bx} cy={by} r={10} fill={KIND_VAR[f.kind]} stroke="var(--surface)" strokeWidth={2} />
                            <text x={bx} y={by + 4} textAnchor="middle" className="map-badge">
                              {f.kind === "gap" ? "+" : "≠"}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}
                </g>
              );
            })}

            {/* steps */}
            {sequence.map((s, i) => {
              const loc: FlagLocation = { kind: "step", index: i };
              const lanes = stepLanes[i];
              const conflict = flagsAt(loc).some((f) => f.kind === "conflict");
              const isSel = sameLocation(selected, loc);
              const top = cy(Math.min(...lanes));
              const bottom = cy(Math.max(...lanes));
              return (
                <g
                  key={i}
                  className="map-hit"
                  opacity={dim(loc)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Step ${i + 1}: ${s.step_name}`}
                  onClick={() => toggle(loc)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(loc))}
                >
                  {lanes.length > 1 && (
                    <rect x={cx(i) - 3} y={top} width={6} height={bottom - top} rx={3} fill={KIND_VAR.conflict} opacity={0.5} />
                  )}
                  {lanes.map((l) => (
                    <g key={l}>
                      {isSel && <circle cx={cx(i)} cy={cy(l)} r={NODE_R + 5} className="map-sel" />}
                      <circle
                        cx={cx(i)}
                        cy={cy(l)}
                        r={NODE_R}
                        className="map-node"
                        style={conflict ? { stroke: KIND_VAR.conflict, strokeWidth: 2.5 } : undefined}
                      />
                      <text x={cx(i)} y={cy(l) + 4.5} textAnchor="middle" className="map-node-num">
                        {i + 1}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}

            {/* streaming placeholders */}
            {Array.from({ length: pending }).map((_, k) => (
              <circle key={`p${k}`} cx={cx(sequence.length + k)} cy={cy(0)} r={NODE_R} className="map-pending" />
            ))}

            {/* channel track */}
            <text x={12} y={trackY + 15} className="map-lane-label">
              Channel
            </text>
            {segments.map((seg, k) => {
              const x = cx(seg.from) - COL_W / 2 + 3;
              const w = (seg.to - seg.from + 1) * COL_W - 6;
              const max = Math.floor((w - 12) / 6.4);
              const label = seg.channel.length > max ? seg.channel.slice(0, Math.max(1, max - 1)) + "…" : seg.channel;
              return (
                <g key={k}>
                  <rect x={x} y={trackY} width={w} height={TRACK_H} rx={7} fill={channelColor(seg.channel)} />
                  <text x={x + 9} y={trackY + 15} className="map-channel-label">
                    {label}
                  </text>
                </g>
              );
            })}
            {flags
              .filter((f) => f.kind === "mismatch")
              .map((f, k) => {
                const x = (cx(f.location.index - 1) + cx(f.location.index)) / 2;
                return <path key={k} d={`M ${x - 6} ${trackY - 9} L ${x + 6} ${trackY - 9} L ${x} ${trackY - 1} Z`} fill={KIND_VAR.mismatch} />;
              })}

            {/* step names */}
            {sequence.map((s, i) => (
              <text key={i} x={cx(i)} y={labelY} textAnchor="middle" className="map-step-label" opacity={dim({ kind: "step", index: i })}>
                {wrapLabel(s.step_name).map((line, k) => (
                  <tspan key={k} x={cx(i)} dy={k === 0 ? 0 : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
            ))}
          </svg>
        </div>

        <div className="map-legend">
          <span className="legend-item">
            <span className="legend-line" /> clean handoff
          </span>
          <span className="legend-item">
            <span className="legend-line legend-line-broken" /> broken handoff
          </span>
          <span className="legend-item">
            <span className="legend-badge" style={{ background: KIND_VAR.gap }}>+</span> missing step
          </span>
          <span className="legend-item">
            <span className="legend-badge" style={{ background: KIND_VAR.mismatch }}>≠</span> channel change, no bridge
          </span>
          <span className="legend-item">
            <span className="legend-ring" /> ownership issue
          </span>
        </div>
      </div>

      <div className="flag-panel">
        <div className="flag-panel-head">
          {selectedTitle ? (
            <>
              <div className="flag-selected">{selectedTitle}</div>
              <button className="flag-clear" onClick={() => setSelected(null)}>
                Show all
              </button>
            </>
          ) : (
            <div className="flag-filters" role="group" aria-label="Filter flags">
              {(["gap", "conflict", "mismatch"] as FlagKind[]).map((k) => (
                <button
                  key={k}
                  className="flag-filter"
                  aria-pressed={!hidden.has(k)}
                  onClick={() =>
                    setHidden((h) => {
                      const next = new Set(h);
                      if (!next.delete(k)) next.add(k);
                      return next;
                    })
                  }
                >
                  <span className="legend-dot" style={{ background: KIND_VAR[k] }} />
                  {k === "gap" ? "missing step" : k === "conflict" ? "ownership" : "no bridge"} · {counts[k]}
                </button>
              ))}
            </div>
          )}
        </div>

        {visibleFlags.length === 0 ? (
          <p className="flag-empty">{flags.length === 0 && pending === 0 ? "No flags — this journey looks clean." : "Nothing to show here."}</p>
        ) : (
          <ul className="flag-rows">
            {visibleFlags.map((f, i) => (
              <FlagRow key={i} flag={f} active={sameLocation(selected, f.location)} onClick={() => toggle(f.location)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FlagRow({ flag, active, onClick }: { flag: Flag; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button className={`flag-row flag-row-${flag.kind}${active ? " flag-row-active" : ""}`} onClick={onClick}>
        <div className="flag-row-head">
          <span className="flag-row-tag">{flag.tag}</span>
          <span className="flag-row-where">{flag.whereText}</span>
          <span className="flag-row-conf">
            <ScoreMeter label={flag.level ? `confidence: ${flag.level}` : "confidence"} value={flag.score} />
          </span>
        </div>
        <p className="flag-row-text">{flag.issue.description}</p>
        {flag.reason && <p className="flag-row-reason">{flag.reason}</p>}
      </button>
    </li>
  );
}
