"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import GapTimeline from "./GapTimeline";
import MapView from "./MapView";

type Mode = "timeline" | "map";
const STORAGE_KEY = "journey-gap-view-mode";

/** Switches between the step-card timeline and the journey map. */
export default function ReportView(props: ComponentProps<typeof GapTimeline>) {
  const [mode, setMode] = useState<Mode>("timeline");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "timeline" || saved === "map") setMode(saved);
    else if (saved === "swimlane") setMode("map"); // value stored by the old swimlane view
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
        <button aria-pressed={mode === "map"} onClick={() => choose("map")}>
          Map
        </button>
      </div>
      {mode === "timeline" ? <GapTimeline {...props} /> : <MapView {...props} />}
    </>
  );
}
