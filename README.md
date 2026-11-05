# journey-gap-agent

Reads a cross-team journey (a list of touchpoints) and flags gaps, ownership
conflicts, and channel mismatches, with reasoning shown for each flag.

## Setup
1. `cp .env.example .env` and fill in your Anthropic API key
2. `npm install`

## Usage
```
npm start -- --input data/journey.csv --output report.md
npm start -- --input data/journey.csv --output report.html
```
Output format is inferred from the `--output` extension (`.md` or `.html`),
or set explicitly with `--format md|html`. Omit `--output` to print the
markdown report to stdout instead. `--model` overrides the Claude model
(defaults to `CLAUDE_MODEL` from `.env`, then `claude-sonnet-5`).

The HTML report renders the journey as a visual timeline: step cards
connected by arrows, with broken/dashed red connectors for gaps and channel
mismatches, and warning badges on steps with ownership conflicts.

## Input format
A CSV with one row per touchpoint/step:

| column | meaning |
|---|---|
| `step_name` | name of the step |
| `owning_team` | team responsible; blank if unowned, or two teams (e.g. `"Onboarding / Support"`) if contested |
| `channel` | how the step happens (Call, Email, App, Internal Tool, etc.) |
| `description` | optional, short free-text description |

The rows don't need to be in order — the agent infers sequence.

## How it works
The CSV is passed to Claude in a single call with a system prompt describing
the three issue types to look for. Claude does the sequencing and gap
inference itself — there's no rules engine or hardcoded checks; the
reasoning is the point of the demo.

It flags three kinds of issues, each with a one-line severity/confidence
note:
- **Gaps** — a step that should logically exist between two others but is
  missing (e.g. a signed contract followed directly by first login, with no
  handoff step).
- **Ownership conflicts** — a step with no owning team, or claimed by more
  than one.
- **Channel mismatches** — a handoff between two channels with no bridging
  step (e.g. an internal system action followed directly by a customer-facing
  app login, with nothing notifying the customer in between).

## Output format
A markdown report: a summary line (step/gap/conflict/mismatch counts)
followed by the ordered journey, with `⚠` annotations inserted inline at the
point each issue occurs.

## Demo data
`data/journey.csv` is a synthetic 10-step B2B onboarding journey with a
planted gap, a channel mismatch, and two ownership issues, so there's
something concrete for the agent to catch.

## Web app
A Next.js app under `web/` runs the same agent from the browser.

```
cd web
cp .env.example .env.local   # fill in your Anthropic API key
npm install
npm run dev
```
Then open http://localhost:3000. Reports persist as JSON files under
`data/reports/` at the repo root (not committed). The web app reuses the
same analysis logic as the CLI, from `src/lib/gapReport.ts`.

**Input.** Build a journey step by step in a three-stage form (name, steps,
review; steps can have several owning teams; the draft is kept in the
browser), or upload a CSV, or run the sample journey.

**Results.** Analysis streams in live, with a loading skeleton and animated
reveal. Two views, switchable: a step-card **Timeline**, and a **Map** with
team lanes, a channel track, broken handoffs marked where a step is missing
or the channel changes with no bridge, and click-to-focus flag details. Both
sit under a health strip (steps, flags, handoffs, a one-segment-per-step
minimap). Saved reports are listed in History and open on their own page.

**Next steps.** A report's Next steps tab turns the flags into a ranked
action list: impact and effort scores with reasons, a "done when" check, a
"Do this first" rationale, and a List / By team / Impact-effort matrix
view. Actions can be copied as tickets or as a whole plan. Where an action is
a concrete step or owner change, it can be applied to build a revised
journey, re-analyzed, and compared side by side with the original.

## Tests
```
npm test
```
Unit tests cover the pure helpers (flag and handoff stats, ticket and plan
text, applying changes to a journey, validating model output). They do not
call the API.
