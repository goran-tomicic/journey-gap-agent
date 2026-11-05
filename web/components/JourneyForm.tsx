"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisRun } from "./useAnalysisRun";

interface StepDraft {
  id: string;
  name: string;
  owners: string[];
  channel: string;
  description: string;
}

interface Draft {
  name: string;
  steps: StepDraft[];
  stage: number;
}

const STORAGE_KEY = "journey-gap-draft";
const EMPTY_DRAFT: Draft = { name: "", steps: [], stage: 0 };
const STAGES = ["Journey", "Steps", "Review"];
const CHANNEL_SUGGESTIONS = ["Call", "Email", "App", "Internal Tool", "Chat", "Meeting", "Portal", "In person"];

const newId = () => Math.random().toString(36).slice(2, 10);
const emptyStep = (): StepDraft => ({ id: newId(), name: "", owners: [], channel: "", description: "" });
const ownersLabel = (s: StepDraft) => (s.owners.length ? s.owners.join(" / ") : "(no owner)");

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(steps: StepDraft[]): string {
  const rows = steps.map((s) =>
    [s.name, s.owners.join(" / "), s.channel, s.description].map(csvCell).join(","),
  );
  return ["step_name,owning_team,channel,description", ...rows].join("\n") + "\n";
}

function OwnerInput({
  owners,
  onChange,
  suggestions,
}: {
  owners: string[];
  onChange: (owners: string[]) => void;
  suggestions: string[];
}) {
  const [text, setText] = useState("");

  function commit() {
    const value = text.trim();
    if (value && !owners.some((o) => o.toLowerCase() === value.toLowerCase())) onChange([...owners, value]);
    setText("");
  }

  return (
    <div className="chips">
      {owners.map((o) => (
        <span className="chip" key={o}>
          {o}
          <button type="button" aria-label={`Remove ${o}`} onClick={() => onChange(owners.filter((x) => x !== o))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        list="owner-suggestions"
        placeholder={owners.length ? "Add another team…" : "Team (leave empty if unowned)"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !text && owners.length) {
            onChange(owners.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
      <datalist id="owner-suggestions">
        {suggestions.filter((t) => !owners.includes(t)).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

export default function JourneyForm({ run }: { run: AnalysisRun }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<StepDraft>(emptyStep);
  const [stepError, setStepError] = useState<string>();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) });
    } catch {
      // ignore a corrupt draft
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft, loaded]);

  const teams = [...new Set(draft.steps.flatMap((s) => s.owners))];
  const channels = [...new Set([...draft.steps.map((s) => s.channel), ...CHANNEL_SUGGESTIONS])].filter(Boolean);
  const isEditingExisting = draft.steps.some((s) => s.id === editing.id);
  const hasContent = draft.name.trim() !== "" || draft.steps.length > 0;

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function startNew() {
    if (hasContent && !window.confirm("Discard this journey and start from scratch?")) return;
    setDraft(EMPTY_DRAFT);
    setEditing(emptyStep());
    setStepError(undefined);
  }

  function goTo(stage: number) {
    if (stage >= 1 && !draft.name.trim()) return;
    if (stage >= 2 && draft.steps.length === 0) return;
    update({ stage });
  }

  function saveStep() {
    if (!editing.name.trim() || !editing.channel.trim()) {
      setStepError("A step needs a name and a channel.");
      return;
    }
    setStepError(undefined);
    const clean = { ...editing, name: editing.name.trim(), channel: editing.channel.trim() };
    setDraft((d) => ({
      ...d,
      steps: d.steps.some((s) => s.id === clean.id)
        ? d.steps.map((s) => (s.id === clean.id ? clean : s))
        : [...d.steps, clean],
    }));
    setEditing(emptyStep());
  }

  function move(i: number, delta: number) {
    setDraft((d) => {
      const steps = [...d.steps];
      const j = i + delta;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });
  }

  function removeStep(id: string) {
    setDraft((d) => ({ ...d, steps: d.steps.filter((s) => s.id !== id) }));
    if (editing.id === id) setEditing(emptyStep());
  }

  function duplicateStep(s: StepDraft) {
    setDraft((d) => {
      const i = d.steps.findIndex((x) => x.id === s.id);
      const copy = { ...s, id: newId(), name: `${s.name} (copy)` };
      return { ...d, steps: [...d.steps.slice(0, i + 1), copy, ...d.steps.slice(i + 1)] };
    });
  }

  function analyze() {
    const form = new FormData();
    form.set("journeyName", draft.name.trim());
    form.set(
      "touchpoints",
      JSON.stringify(
        draft.steps.map((s) => ({
          step_name: s.name,
          owning_team: s.owners.join(" / "),
          channel: s.channel,
          description: s.description,
        })),
      ),
    );
    void run.start(form, draft.name.trim());
  }

  function downloadCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(draft.steps)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name.trim().replace(/[^\w-]+/g, "_") || "journey"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) return <div className="panel" />;

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2>Describe your journey</h2>
        <button type="button" onClick={startNew} disabled={!hasContent}>
          New
        </button>
      </div>

      <ol className="stepper">
        {STAGES.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              className={`stepper-item${draft.stage === i ? " stepper-current" : ""}`}
              onClick={() => goTo(i)}
            >
              <span className="stepper-num">{i + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {draft.stage === 0 && (
        <>
          <div className="field">
            <label htmlFor="journey-name">Journey name</label>
            <input
              id="journey-name"
              ref={nameRef}
              value={draft.name}
              placeholder="e.g. B2B onboarding"
              maxLength={120}
              onChange={(e) => update({ name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && goTo(1)}
            />
            <div className="field-hint">Used as the report title. The agent works out the step order itself.</div>
          </div>
          <div className="form-row">
            <button type="button" className="primary" disabled={!draft.name.trim()} onClick={() => goTo(1)}>
              Next: add steps
            </button>
          </div>
        </>
      )}

      {draft.stage === 1 && (
        <>
          {draft.steps.length > 0 && (
            <ol className="step-rows">
              {draft.steps.map((s, i) => (
                <li key={s.id} className={s.id === editing.id ? "step-row-active" : undefined}>
                  <span className="step-row-num">{i + 1}</span>
                  <div className="step-row-body">
                    <div className="step-row-name">{s.name}</div>
                    <div className="step-row-meta">
                      {ownersLabel(s)} · {s.channel}
                    </div>
                  </div>
                  <div className="step-row-actions">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === draft.steps.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => setEditing(s)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => duplicateStep(s)}>
                      Duplicate
                    </button>
                    <button type="button" onClick={() => removeStep(s.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="step-editor">
            <h3>{isEditingExisting ? "Edit step" : `Step ${draft.steps.length + 1}`}</h3>
            <div className="field">
              <label htmlFor="step-name">Step name</label>
              <input
                id="step-name"
                value={editing.name}
                placeholder="e.g. Kickoff call held"
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Owning team(s)</label>
              <OwnerInput
                owners={editing.owners}
                suggestions={teams}
                onChange={(owners) => setEditing({ ...editing, owners })}
              />
              <div className="field-hint">Press Enter to add a team. Add two if ownership is shared; none if nobody owns it.</div>
            </div>
            <div className="field">
              <label htmlFor="step-channel">Channel</label>
              <input
                id="step-channel"
                value={editing.channel}
                list="channel-suggestions"
                placeholder="e.g. Email"
                onChange={(e) => setEditing({ ...editing, channel: e.target.value })}
              />
              <datalist id="channel-suggestions">
                {channels.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="step-desc">Description (optional)</label>
              <textarea
                id="step-desc"
                rows={2}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            {stepError && <div className="error">{stepError}</div>}
            <div className="form-row" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="primary" onClick={saveStep}>
                {isEditingExisting ? "Save step" : "Add step"}
              </button>
              {isEditingExisting && (
                <button type="button" onClick={() => setEditing(emptyStep())}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="form-row" style={{ justifyContent: "space-between" }}>
            <button type="button" onClick={() => goTo(0)}>
              Back
            </button>
            <button type="button" className="primary" disabled={draft.steps.length === 0} onClick={() => goTo(2)}>
              Next: review
            </button>
          </div>
        </>
      )}

      {draft.stage === 2 && (
        <>
          <div className="review-title">{draft.name}</div>
          <ol className="step-rows">
            {draft.steps.map((s, i) => (
              <li key={s.id}>
                <span className="step-row-num">{i + 1}</span>
                <div className="step-row-body">
                  <div className="step-row-name">{s.name}</div>
                  <div className="step-row-meta">
                    {ownersLabel(s)} · {s.channel}
                  </div>
                  {s.description && <div className="step-row-meta">{s.description}</div>}
                </div>
              </li>
            ))}
          </ol>
          {run.phase === "error" && <div className="error">{run.error}</div>}
          {(
            <div className="form-row" style={{ justifyContent: "space-between" }}>
              <button type="button" onClick={() => goTo(1)}>
                Back to steps
              </button>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={downloadCsv}>
                  Download CSV
                </button>
                <button type="button" className="primary" onClick={analyze}>
                  Analyze journey
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
