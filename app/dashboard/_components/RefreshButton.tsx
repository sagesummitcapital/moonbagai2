"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshLive } from "../actions";

/** Pull live prices and the latest data now (Stavros, 2026-10-15: "give me a button to refresh data/pull live prices"). */
export default function RefreshButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const r = await refreshLive();
          router.refresh();
          window.dispatchEvent(new Event("moonbag:refresh"));
          const t = new Date(r.at).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" });
          setMsg(r.ok ? `updated ${t}` : "couldn't refresh");
        } catch {
          setMsg("couldn't refresh");
        } finally {
          setPending(false);
          setTimeout(() => setMsg(null), 4000);
        }
      }}
      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-accent-green/35 bg-accent-green/[0.08] px-3 py-1 text-[12.5px] font-medium text-white hover:bg-accent-green/[0.16] disabled:opacity-60"
      aria-label="Refresh live prices and data"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={pending ? "animate-spin" : ""} aria-hidden>
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pending ? "Refreshing…" : msg ?? "Refresh"}
    </button>
  );
}
