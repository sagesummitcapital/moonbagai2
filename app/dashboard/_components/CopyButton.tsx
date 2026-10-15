"use client";

import { useState } from "react";

/** One-tap copy of a fixed text block (trade inputs for BloFin / Grok). */
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked — the text is on screen */
        }
      }}
      className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[12px] text-white/80 hover:bg-white/[0.08] hover:text-white"
    >
      {done ? "Copied" : label}
    </button>
  );
}
