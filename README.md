# journey-gap-agent

Reads a cross-team journey (a list of touchpoints) and flags gaps, ownership
conflicts, and channel mismatches, with reasoning shown for each flag.

## Setup
1. `cp .env.example .env` and fill in your Anthropic API key
2. `npm install`

## Usage
```
npm start -- --input data/journey.csv --output report.md
```
Omit `--output` to print the report to stdout instead. `--model` overrides
the Claude model (defaults to `CLAUDE_MODEL` from `.env`, then
`claude-sonnet-5`).

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
