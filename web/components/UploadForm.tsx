"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(useSample: boolean) {
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!useSample && !file) {
      setError("Choose a CSV file, or use the sample journey.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      if (useSample) {
        form.set("useSample", "true");
      } else if (file) {
        form.set("file", file);
      }

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Analysis failed.");
      }
      router.push(`/reports/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <h2>Run analysis</h2>
      <div className="form-row">
        <input ref={fileInputRef} type="file" accept=".csv" disabled={loading} />
        <button className="primary" disabled={loading} onClick={() => submit(false)}>
          {loading ? "Analyzing…" : "Analyze CSV"}
        </button>
        <button disabled={loading} onClick={() => submit(true)}>
          Use sample journey
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
