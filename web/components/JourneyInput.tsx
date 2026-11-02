"use client";

import { useState } from "react";
import JourneyForm from "./JourneyForm";
import UploadForm from "./UploadForm";

/** Home-page input: build a journey step by step, or upload a CSV. */
export default function JourneyInput() {
  const [mode, setMode] = useState<"form" | "csv">("form");

  return (
    <>
      <div className="view-toggle" role="group" aria-label="Input method">
        <button aria-pressed={mode === "form"} onClick={() => setMode("form")}>
          Build manually
        </button>
        <button aria-pressed={mode === "csv"} onClick={() => setMode("csv")}>
          Upload CSV
        </button>
      </div>
      {mode === "form" ? <JourneyForm /> : <UploadForm />}
    </>
  );
}
