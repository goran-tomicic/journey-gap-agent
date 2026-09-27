# Changelog

Release notes are added here as each feature is built. One entry per feature branch, newest on top.

## feature/streaming-progress
Live progress in the web app instead of a blank wait while the model runs.

- `streamGapReport` in `src/lib/gapReport.ts` uses Claude's streaming API and
  the SDK's built-in partial-JSON parser (it vendors one specifically for
  this) to expose the tool call's `sequence` array as it's generated, one
  completed step at a time.
- `/api/analyze` now streams newline-delimited progress events (`start`,
  `progress`, `done`, `error`) over a chunked response instead of returning
  once at the end.
- The homepage renders real skeleton cards immediately for the full step
  count, then swaps each one in as it arrives — genuinely reflects the
  model's progress, not a simulated delay.
- Fixed a real race found while testing: the SDK's last streaming event can
  fire just after the stream is awaited-complete, which was throwing
  "Controller is already closed" after the done event had already sent;
  added a closed-guard around the response stream.
- Verified against the live API in both dev and production builds (`next
  build` + `next start`): homepage, streaming analyze (sample + upload),
  report page, unknown-report 404, and bad-input handling all pass.

## feature/web-app
Browser frontend (Next.js) as an alternative to the CLI, backed by the same
analysis logic.

- Extracted the Claude call and CSV parsing out of `src/agent.ts` into
  `src/lib/gapReport.ts`, shared by both the CLI and the new web app.
- `web/` — Next.js app: upload a CSV or run the sample journey, view the
  result as the visual timeline (same design as the HTML report, as a React
  component), and browse a history of past runs.
- Reports persist as JSON files under `data/reports/` (gitignored, local
  only) via `web/lib/reportStore.ts`.
- Fixed two bugs found while testing: the analyze endpoint threw an
  unhandled 500 on a non-multipart request instead of returning 400, and the
  report page hadn't been updated for Next.js 15's async `params`.
- Verified end-to-end against the live API: sample-journey run, file-upload
  run, history list, bad-input handling, unknown-report 404, and a clean
  production build (`next build`).

## feature/html-report
Visual HTML report output alongside the existing markdown report.

- Reworked the Claude call to use tool-use (forced structured output) instead
  of asking the model to write raw JSON as text — the earlier approach
  occasionally produced malformed JSON (unescaped characters in generated
  text); tool-use makes the API responsible for valid encoding.
- `src/types.ts` / `src/render.ts` — shared report data model, plus separate
  markdown and HTML renderers built from the same structured data.
- HTML output renders the journey as a vertical timeline: step cards
  connected by arrows, dashed red connectors for gaps/channel mismatches,
  and warning badges on steps with ownership conflicts. Supports light/dark
  mode.
- Output format is inferred from the `--output` file extension, or set with
  `--format md|html`.
- Added a sanity check that warns if the model's returned step count doesn't
  match the input (guards against occasional hallucinated/duplicated steps).
- Verified against the live API across multiple runs for both formats.

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
