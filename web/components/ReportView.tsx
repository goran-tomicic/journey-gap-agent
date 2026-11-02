"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import GapTimeline from "./GapTimeline";
import SwimlaneView from "./SwimlaneView";

type Mode = "timeline" | "swimlane";
const STORAGE_KEY = "journey-gap-view-mode";

/** Switches between the step-card timeline and the swimlane view. */
export default function ReportView(props: ComponentProps<typeof GapTimeline>) {
  const [mode, setMode] = useState<Mode>("timeline");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "timeline" || saved === "swimlane") setMode(saved);
  }, []);

  function choose(next: Mode) {
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <>
      <div className="view-toggle" role="group" aria-label="View mode">
        <button aria-pressed={mode === "timeline"} onClick={() => choose("timeline")}>
          Timeline
        </button>
        <button aria-pressed={mode === "swimlane"} onClick={() => choose("swimlane")}>
          Swimlanes
        </button>
      </div>
      {mode === "timeline" ? <GapTimeline {...props} /> : <SwimlaneView {...props} />}
    </>
  );
}
