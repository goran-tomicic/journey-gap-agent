# Changelog

Release notes are added here as each feature is built. One entry per feature branch, newest on top.

## feature/core-gap-agent
Core CLI agent (Node/TypeScript): reads a touchpoint CSV, sends it to Claude
to sequence the journey and flag gaps, ownership conflicts, and channel
mismatches, and writes a markdown gap report with a severity/confidence note
per flag.

- Synthetic 10-step B2B onboarding journey (`data/journey.csv`) with a
  planted gap (no handoff after contract signing), a channel mismatch
  (internal provisioning straight into app login with no bridging step),
  and two ownership issues (a step with two owning teams, a step with none).
- `src/agent.ts` — CLI entry point (`--input`, `--output`, `--model`), run
  via `npm start`.
- Verified end-to-end against the live API: correctly caught all planted
  issues with reasoning for each.
