export interface Touchpoint {
  step_name: string;
  owning_team: string;
  channel: string;
  description?: string;
}

export type IssueType = "gap" | "ownership_conflict" | "channel_mismatch";

export interface Issue {
  type: IssueType;
  /** "before" = occurs in the handoff leading into this step; "on" = attached to this step itself. */
  position: "before" | "on";
  description: string;
  confidence: string;
}

export interface StepResult {
  step_name: string;
  team: string;
  channel: string;
  issues: Issue[];
}

export interface GapReport {
  summary: {
    steps: number;
    gaps: number;
    ownership_conflicts: number;
    channel_mismatches: number;
  };
  sequence: StepResult[];
}
