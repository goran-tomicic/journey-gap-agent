import type { Issue, IssueType, StepResult } from "../../src/types.js";

/** Teams that own a step; "(none)" / empty means unowned. Two teams ("A / B")
 * means shared ownership. */
export function owners(step: StepResult): string[] {
  return step.team
    .split(/[/,&]/)
    .map((t) => t.trim())
    .filter((t) => t && t !== "(none)");
}

export function splitConfidence(text: string): { level: string; reason: string } {
  const [head, ...rest] = text.split(/\s[—-]\s|[—]/);
  const level = (head?.trim() ?? "").replace(/\s+confidence$/i, "");
  if (level && level.length <= 20) return { level: level.toLowerCase(), reason: rest.join(" — ").trim() };
  return { level: "", reason: text };
}

/** 1 (low) to 5 (high) from the model's free-text confidence level. */
export function confidenceScore(level: string): number {
  const l = level.toLowerCase();
  const high = l.includes("high");
  const low = l.includes("low");
  const med = l.includes("medium");
  if (high && med) return 4;
  if (low && med) return 2;
  if (high) return 5;
  if (low) return 1;
  if (med) return 3;
  return 3;
}

export type FlagKind = "gap" | "conflict" | "mismatch";

/** Where a flag sits on the journey: on a step, or on the handoff leading
 * into a step (`index` is that step's 0-based position either way). */
export interface FlagLocation {
  kind: "step" | "edge";
  index: number;
}

export interface Flag {
  kind: FlagKind;
  tag: string;
  location: FlagLocation;
  whereText: string;
  issue: Issue;
  level: string;
  reason: string;
  score: number;
}

const KIND: Record<IssueType, FlagKind> = {
  gap: "gap",
  ownership_conflict: "conflict",
  channel_mismatch: "mismatch",
};

export function buildFlags(sequence: StepResult[]): Flag[] {
  const flags: Flag[] = [];
  sequence.forEach((step, i) => {
    step.issues.forEach((issue) => {
      const kind = KIND[issue.type];
      const { level, reason } = splitConfidence(issue.confidence);
      let tag: string;
      let location: FlagLocation;
      let whereText: string;
      if (kind === "conflict") {
        tag = owners(step).length === 0 ? "no owner" : "two owners";
        location = { kind: "step", index: i };
        whereText = `step ${i + 1}`;
      } else {
        tag = kind === "gap" ? "missing step" : "no bridge";
        location = { kind: "edge", index: i };
        whereText = kind === "gap" ? `between ${i} and ${i + 1}` : `${i} to ${i + 1}`;
      }
      flags.push({ kind, tag, location, whereText, issue, level, reason, score: confidenceScore(level) });
    });
  });
  return flags;
}

export function sameLocation(a: FlagLocation | null, b: FlagLocation | null): boolean {
  return !!a && !!b && a.kind === b.kind && a.index === b.index;
}

export interface JourneyStats {
  steps: number;
  flags: number;
  highConfidence: number;
  byKind: Record<FlagKind, number>;
  handoffs: number;
  unbridged: number;
}

/** A handoff is a transition where the owning team changes; it is unbridged
 * when a gap or channel mismatch is flagged on it. */
export function journeyStats(sequence: StepResult[], flags: Flag[]): JourneyStats {
  const byKind: Record<FlagKind, number> = { gap: 0, conflict: 0, mismatch: 0 };
  flags.forEach((f) => byKind[f.kind]++);
  let handoffs = 0;
  let unbridged = 0;
  for (let i = 1; i < sequence.length; i++) {
    const a = owners(sequence[i - 1]).join("|");
    const b = owners(sequence[i]).join("|");
    if (a === b) continue;
    handoffs++;
    if (flags.some((f) => f.location.kind === "edge" && f.location.index === i)) unbridged++;
  }
  return {
    steps: sequence.length,
    flags: flags.length,
    highConfidence: flags.filter((f) => f.score >= 4).length,
    byKind,
    handoffs,
    unbridged,
  };
}

/** The most severe flag kind touching a step (its own flags plus the handoff
 * leading into it), or null when it is clean. */
export function stepKind(index: number, flags: Flag[]): FlagKind | null {
  const mine = flags.filter((f) => f.location.index === index).map((f) => f.kind);
  for (const k of ["gap", "conflict", "mismatch"] as FlagKind[]) if (mine.includes(k)) return k;
  return null;
}
