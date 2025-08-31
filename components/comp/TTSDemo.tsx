// components/comp/TTSDemo.tsx
"use client";

import { useState } from "react";

export default function TTSDemo() {
  const [loading, setLoading] = useState(false);

  const speak = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/elevenlabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "The first move is what sets everything in motion.",
        }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.startsWith("audio/")) {
        // Show the JSON/text error returned by the route
        throw new Error(await res.text());
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      console.error(e);
      alert(`TTS error:\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={speak} disabled={loading}>
      {loading ? "Generating…" : "Speak"}
    </button>
  );
}
