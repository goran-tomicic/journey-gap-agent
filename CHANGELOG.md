# Changelog

Release notes are added here as each feature is built. One entry per feature branch, newest on top.

## feature/next-steps-actions
Next steps made easier to act on (phase 1 of the next-steps v2 spec).

- Each action gains a "done when" line (how to verify the fix), shown in
  the expanded card. Next steps saved before this keep working without it.
- "Copy as ticket" on each action and "Copy plan" for the whole list: plain
  Markdown (plan = a checklist per owning team), no network call.
- Three views of the actions: List (default), By team (the hand-off view,
  grouped under the suggested owner) and an impact/effort Matrix (numbered
  dots in a 5x5 grid, quick-win corner shaded, click a dot to open its card).
- Regenerate button (with confirmation) to re-run next steps on a saved
  report, e.g. to add "done when" to older ones.

## feature/journey-map
Journey map view replaces the Swimlanes view; health summary on both views.

- Map view (Timeline | Map toggle, replacing Swimlanes): team lanes with
  numbered step nodes, handoffs drawn as connectors that turn dashed and
  carry a badge where a step is missing (+) or the channel changes with no
  bridge (≠), a channel track underneath that changes colour at each
  channel change, and step names under the nodes. Shared ownership shows
  as a bar across the owning lanes with a highlighted ring.
- Click a step or a flagged handoff (or a flag row) to focus it: the map
  dims everything else and the flag panel shows only the flags for that
  spot. Without a selection the panel lists all flags, sorted by
  confidence, with filter chips per issue type. Confidence is a 5-segment
  meter parsed from the model's note.
- Health strip above both views: steps / flags / handoffs tiles (with
  high-confidence and unbridged counts), a one-segment-per-step minimap
  coloured by the worst flag at that step (click to jump), and per-type
  counts. Computed from the steps revealed so far, so it fills in live.
- One container width on every page (home, results, report, next steps)
  and a stable scrollbar gutter, so switching pages or views no longer
  shifts the layout sideways.
- Selecting a step or flag in the Map no longer filters the flag list;
  the matching flags are highlighted and the rest dimmed, with a fixed
  status line, so nothing jumps. The report tabs show (disabled) while an
  analysis is still running, so they don't pop in at the end.
- Style pass: shared corner-radius tokens for cards and controls, and the
  step form puts name and channel side by side.
- Smoother reveal while an analysis streams in: results view fades in,
  timeline cards, flag rows and next-step cards rise in, map nodes pop in,
  handoffs, channel segments and labels fade in (the channel bar grows
  smoothly as steps are added), and minimap segments grow in. All
  entrance motion is skipped for users who prefer reduced motion.
- When the map is wider than the page, selecting a step or flagged handoff
  (from the map, minimap or flag list) smoothly scrolls it into view.
- A saved "swimlane" view preference maps to Map.

## feature/next-steps
Prioritized next steps after an analysis (web app only).

- Starting an analysis (CSV or manual form) now switches the home page to
  a results view of its own: the input, toggle and history are hidden, the
  report streams in with the loading skeleton, and when it finishes the
  Report | Next steps tabs appear. "New analysis" returns to the input,
  which keeps its state.
- Dedicated page per report at `/reports/[id]/next-steps`, reached from a
  Report | Next steps tab bar on saved reports (a dot marks reports that
  already have them) and from a "Get next steps" link after a fresh
  analysis. A second Claude call turns the flags into a short action list;
  the model groups flags that share a root cause and does the ranking.
- Compact expandable cards ranked 1..N: title, owner, a short
  what-to-do, and impact / effort shown as 5-segment meters. The first
  card (marked "start here") opens by default with the rationale for why
  it comes first; the rest collapse. Expanding a card shows the impact and
  effort reasons and the flags it clears (step + issue type); "Expand all"
  toggles every card. Quick wins (low effort, solid impact) are marked.
- Impact meters are green and effort meters amber; titles slightly larger.
- Generated only on click (button on the page), then saved with the report (`nextSteps` in the
  stored JSON), so reopening a report shows it without re-running. History
  shows a "next steps" badge on reports that have them. Reports with no
  flags skip the model call.
- New `POST /api/next-steps` and `src/lib/nextSteps.ts`. Actions are kept
  short; drafting full replacement steps remains out of scope.
- Sample journey (`data/journey.csv`) rewritten with realistic step
  descriptions and a plausible rollout; same planted issues (shared
  ownership on the data import, an unowned adoption check-in, handoffs
  with no bridging step).

## feature/journey-form
Guided form to enter a journey in the browser, as an alternative to uploading a CSV.

- Home page toggle: Build manually / Upload CSV.
- Three-stage stepper: journey name, steps, review. Steps have a name,
  channel (with suggestions), optional description, and any number of
  owning teams (chip input; none = unowned, several = shared ownership,
  sent to the agent as "A / B" like the CSV convention). Steps can be
  edited, duplicated, deleted and reordered.
- The draft is saved in the browser and restored on return; "New" clears
  it and starts from scratch (with confirmation).
- Review stage can download the journey as a CSV, and runs the analysis
  with the same live Timeline / Swimlanes results.
- `POST /api/analyze` accepts a `touchpoints` JSON field (plus
  `journeyName`) and validates it server-side (non-empty, name + channel
  per step, max 50 steps).
- The streaming/paced-reveal logic moved out of `UploadForm` into a shared
  `useAnalysisRun` hook used by both forms.

## feature/swimlane-redesign
Swimlane view added as an alternative to the step-card timeline.

- Timeline / Swimlanes toggle on the live analysis view and on saved
  reports; the choice is remembered in the browser. Timeline stays the
  default and is unchanged.
- Swimlane view: one lane per owning team with numbered step dots in
  sequence order, a dashed circle where a step is missing, and a ring on
  steps with an ownership conflict (shown in both lanes when two teams
  claim it). Flags are listed below as tagged rows (missing step, two
  owners, no owner, no bridge) with location, one-line reason and
  confidence, followed by a step list. Styled to match the timeline view
  (same fonts, grey step circles, rounded cards, per-issue colors).
- Live analysis streams steps into the lanes with pulsing placeholders.

## feature/ui-polish
Visual redesign of the web app, based on a design preview reviewed and
approved before implementation.

- Typography: Space Grotesk (headings) + IBM Plex Sans (body) via
  `next/font/google`, replacing system-default fonts.
- Palette: neutral grey scale (background, borders, skeleton shimmer)
  instead of default white/gray, with distinct accent colors per issue type
  (amber = gap, rose = ownership conflict, violet = channel mismatch).
- Timeline redesign: gaps and channel mismatches now render as a visible
  break in the connecting line — a dashed colored segment leading to a
  callout card with the full reasoning — instead of a note stacked under
  the step above. Ownership conflicts show as a badge next to the step
  name, with the reasoning as a compact inline line, instead of a boxed
  note.
- Upload panel restyled as a dropzone with drag-and-drop support (in
  addition to the existing file picker), plus a live "Analyzing…" pulse
  indicator.
- History list and summary counts restyled as pill badges.
- Verified against the live API: full analysis run, report page rendering,
  history list, 404 and bad-input handling, and a clean production build.

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
- Found during manual testing: once the model starts emitting the tool call,
  it generates the whole thing in well under a second — nearly all real
  latency is "thinking" time before output starts, not something spread
  across the response. Raw network-level streaming was correct, but a
  per-step reveal at that speed was imperceptible. Fixed by decoupling
  "data has arrived" from "shown to the user": the UI now reveals completed
  steps at a fixed ~350ms cadence, continuing to drain the queue even after
  the network call has already finished, instead of dumping everything at
  once.
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
