// Small, server-safe UI primitives for the Moonbag dashboard.
import type { ReactNode } from "react";

export function Card({ title, right, children, className = "" }: {
  title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 ${className}`}>
      {(title || right) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/55">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-[12px] uppercase tracking-[0.14em] text-white/45">{label}</div>
      <div className="mt-1 font-mono text-[28px] font-semibold leading-none text-white">{value}</div>
      {sub && <div className="mt-1.5 text-[12.5px] text-white/50">{sub}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  green: "border-accent-green/30 bg-accent-green/10 text-accent-green",
  red: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  cyan: "border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan",
  gray: "border-white/15 bg-white/[0.05] text-white/70",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES | string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] ${TONES[tone] ?? TONES.gray}`}>
      {children}
    </span>
  );
}

export function biasTone(bias?: string | null) {
  if (bias === "bullish" || bias === "long") return "green";
  if (bias === "bearish" || bias === "short") return "red";
  if (bias === "mixed") return "amber";
  return "gray";
}

export function statusTone(s?: string | null) {
  if (!s) return "gray";
  if (["active", "open", "pending", "trade"].includes(s)) return "green";
  if (["triggered", "acknowledged", "watch"].includes(s)) return "cyan";
  if (["stale", "no_trade"].includes(s)) return "amber";
  if (["rejected", "invalidated"].includes(s)) return "red";
  return "gray";
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-[14px] text-white/45">{children}</div>;
}

export function Table({ head, rows, empty = "Nothing here yet." }: {
  head: ReactNode[]; rows: ReactNode[][]; empty?: ReactNode;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-white/[0.08] text-[11.5px] uppercase tracking-[0.12em] text-white/40">
            {head.map((h, i) => <th key={i} className="py-2 pr-4 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-white/[0.04] align-top text-white/80">
              {r.map((c, j) => <td key={j} className="py-2.5 pr-4">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12.5px] text-white/60">{children}</span>;
}

export const num = (v: unknown, d = 2) =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: d });

export const money = (v: unknown) =>
  v === null || v === undefined || Number.isNaN(Number(v))
    ? "—"
    : `${Number(v) < 0 ? "-" : ""}$${Math.abs(Number(v)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

export const list = (v: unknown) =>
  Array.isArray(v) && v.length ? v.map((x) => (typeof x === "number" ? num(x) : String(x))).join(", ") : "—";
