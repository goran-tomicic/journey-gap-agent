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

export interface ScoredReason {
  /** 1 (lowest) to 5 (highest). */
  score: number;
  reason: string;
}

/** A concrete, minimal edit to the journey that would fix an action's flags. */
export type ProposedChange =
  | { type: "add_step"; new_step_name: string; owning_team: string; channel: string; after_step: string }
  | { type: "assign_owner"; target_step: string; owning_team: string }
  | { type: "none" };

export interface NextStepAction {
  /** 1 = do this first. */
  priority: number;
  title: string;
  what_to_do: string;
  suggested_owner: string;
  /** Flags this action clears; `step` is the 1-based position in the report's sequence. */
  resolves: { step: number; type: IssueType }[];
  impact: ScoredReason;
  effort: ScoredReason;
  /** One sentence saying how to verify the fix. Absent on next steps saved before it existed. */
  done_when?: string;
  /** Absent on older next steps; step names match the report's steps exactly. */
  proposed_change?: ProposedChange;
}

export interface NextSteps {
  /** Why the priority-1 action beats the others. */
  top_pick_rationale: string;
  actions: NextStepAction[];
}
