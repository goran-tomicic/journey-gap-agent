# Spec: Next steps v2 — from advice to a plan you can act on

Status: Phases 1, 2 and 3 are built and merged. Unit tests cover the pure
helpers (`npm test`); the live apply-and-compare flow was checked by hand
against the API.

## Problem
Next steps (v1) ranks short actions with impact/effort scores. It stops at
advice: actions can't be handed to their owners as-is, and nothing shows
whether acting on them fixed the journey.

## Goals
1. Each action is specific enough to hand to its owner as-is.
2. Applying actions to the journey and re-analyzing shows what changed.

## Non-goals
- Per-action status tracking (to do / doing / done). Single-user local app;
  not worth the data model and regeneration rules it brings.
- Integrations with ticketing, CRM or support tools (copy/export only).
- Accounts, assignment, notifications, comments.
- Automatic flag-by-flag matching between analysis runs (see Phase 3).
- Long-form step redesigns. Proposed changes stay minimal.

Note: the original spec lists "auto-generating fixes or suggested new steps in
detail" as out of scope. Phase 3 relaxes that to **minimal** proposed steps
(name, team, channel, position). Approve this explicitly before building it.

## Phase 1 — Ticket-ready actions and extra views (small, no scope change)

### Acceptance criteria and ticket text
- Each action gains `done_when`: one sentence saying how to verify the fix
  (e.g. "Every signed order form triggers a kickoff-scheduling email within
  one business day").
- "Copy as ticket" on each action: Markdown with title, why (flags cleared,
  with step references), what to do, owner, done-when, impact/effort.
- "Copy plan": all actions, ranked, grouped by owner.
- Acceptance: copied text pastes cleanly into any Markdown-capable tool; no
  network call involved. Next steps saved before this change (no `done_when`)
  still render; the field is omitted from their ticket text.

### Views over the actions
- **By team:** actions grouped under their suggested owner, with a count per
  team. This is the hand-off view.
- **Impact/effort matrix:** a 5×5 grid, each action a numbered dot in its
  cell, quick-win corner labelled; click a dot to jump to its card.
- Toggle: List | By team | Matrix. List stays the default.

## Phase 2 — Spike: are proposed changes usable? (throwaway, ~1 hour)
Before building Phase 3, test whether the model can return changes the code
can apply reliably.
- Add `proposed_change` to the next-steps tool schema (below) on a scratch
  branch; run it against the sample journey and two other journeys.
- Pass criteria: for at least 80% of actions that fix a gap or an owner,
  `proposed_change` is well-formed, references step names that exist in the
  journey, and is a sensible change on inspection.
- If it fails, redesign Phase 3 (e.g. present the change as text for the user
  to enter manually, instead of applying it automatically) before building.

### Spike result (run once, 3 journeys x 2 runs)
- Of 16 actions that fix a gap or an ownership issue, 14 (88%) had a
  well-formed `proposed_change` whose step names matched real steps exactly.
  The other 2 chose `none` deliberately (one "no action needed", one that
  arguably should have been `assign_owner`). Passes the 80% bar.
- Every `after_step` / `target_step` the model produced named a real step.
- Use distinct field names per change type (`new_step_name`, `target_step`,
  `owning_team`, `after_step`). A first run reused one field for two meanings
  and the model mixed them up.
- **2 of 6 runs returned `actions` as a string that did not parse as JSON**
  (zero usable actions). The schema was larger than v1's. Phase 3 needs a
  tolerant parse plus one automatic retry, and the existing next-steps code
  should get the same treatment.
- Sample size is small; treat as a go signal, not a guarantee.

## Phase 3 — Apply and re-analyze (large; needs the scope decision)
- Each action may carry a `proposed_change`:
  - `add_step`: { name, owning_team, channel, after_step } — fills a gap or
    adds a bridge between channels. `after_step` must exactly match an
    existing step name; changes that don't match are not offered.
  - `assign_owner`: { step, owning_team } — fixes an unowned or shared step.
  - `none`: advisory only.
- "Apply" adds the change to a **revised journey draft**, shown in the existing
  editable journey form. Several changes can be applied together. The user
  can edit before running; there is no direct apply-and-run.
- "Analyze revised journey" runs the normal analysis and saves a new report
  with `revisionOf` pointing at the original.
- **Before/after view** on the new report: the original and the revised
  report's counts side by side (steps, flags by kind, handoffs unbridged) and
  both flag lists next to each other. No automatic matching; the user reads
  what changed. Add matching later only if this proves too crude.
- If an applied change leaves the flags unchanged, the view says so plainly.
- Acceptance: applying an `add_step` for a gap and re-analyzing produces a
  revision whose before/after view shows both reports; the revision's
  journey contains the added step in the chosen position.

## Data model changes
`src/types.ts`
```ts
interface NextStepAction {
  // existing: priority, title, what_to_do, suggested_owner, resolves, impact, effort
  done_when: string;               // Phase 1
  proposed_change?: ProposedChange; // Phase 3, optional
}
type ProposedChange =
  | { type: "add_step"; name: string; owning_team: string; channel: string; after_step: string }
  | { type: "assign_owner"; step: string; owning_team: string }
  | { type: "none" };
```
`StoredReport` (web/lib/reportStore.ts), Phase 3:
- `touchpoints?: Touchpoint[]` — the original input, stored from now on so a
  revision starts from real data. Older reports reconstruct touchpoints from
  the report sequence (step name, team, channel; descriptions are lost).
- `revisionOf?: string` — id of the report this one revises.

All new fields are optional; v1 reports and next steps keep rendering.

## API
- `POST /api/next-steps` — same contract; schema and prompt gain `done_when`
  (Phase 1) and `proposed_change` (Phase 3).
- `POST /api/analyze` — Phase 3: accepts optional `revisionOf`, validated to
  exist, saved on the new report.

## Prompt changes
Next-steps tool schema adds `done_when` (required). In Phase 3 it also adds
`proposed_change`, only when the fix is a concrete step or owner change; the
model is told to keep proposed steps minimal and to reuse teams, channels and
step names already in the journey.

## UI summary
- Action card (expanded): done-when line, Copy as ticket; in Phase 3 a proposed
  change summary with Apply / Applied.
- Page header: Copy plan, view toggle (List | By team | Matrix); in Phase 3
  "Analyze revised journey (N changes)" when any change is applied.
- A revision's report page: before/after panel above the usual report, with a
  link to the original.

## Risks
- **Proposed changes can be wrong or invented.** Mitigation: Phase 2 spike;
  shown as a proposal; always editable in the draft before running; minimal
  fields only; unmatched step names are never offered; tolerant parse and one
  retry for malformed model output (seen in the spike).
- **Re-analysis variance.** The model may flag different things on a changed
  journey even where nothing relevant changed. The side-by-side view makes
  this visible instead of hiding it behind automatic matching.
- **Regenerating next steps** replaces actions and any applied changes in the
  draft. Acceptable without statuses; the draft is rebuilt from the new set.

## Test plan
- Unit: ticket and plan Markdown output (including actions without
  `done_when`); by-team grouping; matrix cell placement for scores 1–5;
  validation that `after_step` / `step` exist in the journey.
- API: `revisionOf` pointing at a missing report; next-steps output with a
  malformed `proposed_change` is dropped, not saved.
- Live: run the sample journey, generate next steps, apply an `add_step` and an
  `assign_owner` change, analyze the revision, check the before/after view.

## Open questions
1. Is the minimal-proposed-steps relaxation acceptable (see Non-goals)?
   Required before Phase 3; Phases 1 and 2 don't depend on it.
