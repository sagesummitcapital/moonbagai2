"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Zap, TrendingUp, TrendingDown } from "lucide-react";

type Status = "ready" | "watch" | "triggered" | "invalid";

type Row = {
  asset: string;
  market: "Crypto" | "Stocks" | "Gold" | "ETF" | "FX";
  dir: "LONG" | "SHORT";
  score: number;
  trend: number;
  risk: number;
  setup: "A+" | "A" | "B+" | "B";
  status: Status;
};

const baseRows: Row[] = [
  { asset: "BTC", market: "Crypto", dir: "LONG", score: 8.7, trend: 9.1, risk: 2.1, setup: "A+", status: "ready" },
  { asset: "NVDA", market: "Stocks", dir: "LONG", score: 7.9, trend: 8.4, risk: 3.0, setup: "A", status: "watch" },
  { asset: "GLD", market: "Gold", dir: "LONG", score: 8.2, trend: 7.8, risk: 2.3, setup: "A", status: "triggered" },
  { asset: "ETH", market: "Crypto", dir: "LONG", score: 7.4, trend: 7.2, risk: 2.8, setup: "A", status: "ready" },
  { asset: "AAPL", market: "Stocks", dir: "SHORT", score: 6.3, trend: 5.1, risk: 3.8, setup: "B+", status: "watch" },
  { asset: "XAUUSD", market: "Gold", dir: "LONG", score: 7.6, trend: 8.0, risk: 2.5, setup: "A", status: "ready" },
  { asset: "SPY", market: "ETF", dir: "LONG", score: 6.8, trend: 6.9, risk: 2.9, setup: "B+", status: "watch" },
];

function statusStyles(s: Status) {
  switch (s) {
    case "ready":
      return "text-accent-green bg-accent-green/10 border-accent-green/30";
    case "triggered":
      return "text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30";
    case "watch":
      return "text-amber-300 bg-amber-300/10 border-amber-300/25";
    case "invalid":
      return "text-red-400 bg-red-400/10 border-red-400/25";
  }
}

function scoreColor(score: number) {
  if (score >= 8) return "text-accent-green";
  if (score >= 7) return "text-accent-cyan";
  if (score >= 6) return "text-white/85";
  return "text-white/55";
}

// Slight, subtle live jitter on scores so the board feels "alive"
function useLiveRows() {
  const [rows, setRows] = useState(baseRows);
  useEffect(() => {
    const id = setInterval(() => {
      setRows((prev) =>
        prev.map((r) => {
          const delta = (Math.random() - 0.5) * 0.06;
          const next = Math.max(5.8, Math.min(9.4, r.score + delta));
          return { ...r, score: Number(next.toFixed(1)) };
        })
      );
    }, 2400);
    return () => clearInterval(id);
  }, []);
  return rows;
}

export function OpportunityBoard() {
  const rows = useLiveRows();

  return (
    <div className="relative">
      {/* Ambient glow behind the board */}
      <div className="pointer-events-none absolute -inset-10 -z-10 bg-accent-radial opacity-60 blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-white/[0.01] shadow-[0_40px_120px_-20px_rgba(62,243,162,0.18)] backdrop-blur-md"
      >
        {/* Subtle scan line overlay */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 h-16 animate-scan-line bg-gradient-to-b from-transparent via-accent-green/[0.04] to-transparent" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green shadow-[0_0_8px_rgba(62,243,162,0.8)]" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
                Live
              </span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-white/85">
              <Activity className="h-3.5 w-3.5 text-accent-green" />
              Opportunity Board
            </div>
          </div>
          <div className="hidden items-center gap-3 text-[11px] text-white/45 sm:flex">
            <span className="font-mono">7 assets</span>
            <span>·</span>
            <span className="shimmer font-medium">scanning</span>
          </div>
        </div>

        {/* Table head */}
        <div className="grid grid-cols-[1.2fr_0.9fr_0.55fr_0.75fr_0.65fr_0.65fr_0.65fr_0.85fr] items-center gap-3 border-b border-white/[0.05] px-5 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/38">
          <div>Asset</div>
          <div>Market</div>
          <div>Dir</div>
          <div>Score</div>
          <div>Trend</div>
          <div>Risk</div>
          <div>Setup</div>
          <div className="text-right">Status</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {rows.map((r, i) => (
            <motion.div
              key={r.asset}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className="group grid cursor-default grid-cols-[1.2fr_0.9fr_0.55fr_0.75fr_0.65fr_0.65fr_0.65fr_0.85fr] items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-white/85">
                  {r.asset.slice(0, 2)}
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold tracking-tight text-white">
                    {r.asset}
                  </div>
                </div>
              </div>
              <div className="text-[12.5px] text-white/60">{r.market}</div>
              <div className="flex items-center gap-1">
                {r.dir === "LONG" ? (
                  <TrendingUp className="h-3.5 w-3.5 text-accent-green" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                )}
                <span
                  className={`text-[11px] font-semibold ${
                    r.dir === "LONG" ? "text-accent-green" : "text-red-400"
                  }`}
                >
                  {r.dir}
                </span>
              </div>
              <div
                className={`num-tick text-[14px] font-semibold ${scoreColor(r.score)}`}
              >
                {r.score.toFixed(1)}
                <span className="text-[10px] font-normal text-white/35">
                  /10
                </span>
              </div>
              <div className="num-tick text-[12.5px] text-white/75">
                {r.trend.toFixed(1)}
              </div>
              <div className="num-tick text-[12.5px] text-white/55">
                {r.risk.toFixed(1)}
              </div>
              <div>
                <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[11px] font-mono font-semibold text-white/80">
                  {r.setup}
                </span>
              </div>
              <div className="flex justify-end">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ${statusStyles(r.status)}`}
                >
                  {r.status === "triggered" && (
                    <Zap className="h-2.5 w-2.5" />
                  )}
                  {r.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer: execution strip */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.01] px-5 py-3">
          <div className="flex items-center gap-4 text-[11px] text-white/45">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent-green" />
              <span>Live scan</span>
            </div>
            <span className="hidden font-mono sm:inline">last tick 2s</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/55">
            <span className="hidden sm:inline">Top ranked:</span>
            <span className="font-mono font-semibold text-accent-green">
              BTC · 8.7
            </span>
          </div>
        </div>
      </motion.div>

      {/* Floating mini cards */}
      <motion.div
        initial={{ opacity: 0, y: 20, x: -20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="absolute -left-6 top-24 hidden w-44 animate-float rounded-xl border border-white/[0.08] bg-ink-100/90 p-3 shadow-glow-soft backdrop-blur-xl lg:block"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            Confidence
          </span>
          <span className="text-[11px] font-mono font-bold text-accent-green">
            87%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "87%" }}
            transition={{ duration: 1.4, delay: 1.0, ease: [0.2, 0.8, 0.2, 1] }}
            className="h-full rounded-full bg-accent-gradient"
          />
        </div>
        <div className="mt-2 text-[11px] text-white/65">BTC / USDT · LONG</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20, x: 20 }}
        animate={{ opacity: 1, y: 0, x: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        className="absolute -right-4 bottom-20 hidden w-52 rounded-xl border border-white/[0.08] bg-ink-100/90 p-3.5 shadow-glow-soft backdrop-blur-xl lg:block"
        style={{ animation: "float 7s ease-in-out infinite 0.8s" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            Trade Plan
          </span>
          <span className="rounded-sm border border-accent-green/30 bg-accent-green/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-accent-green">
            READY
          </span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <Row label="Entry" value="64,250" />
          <Row label="Stop" value="63,200" accent="text-red-400/90" />
          <Row label="TP1" value="65,300" accent="text-accent-green" />
          <Row label="TP2" value="66,500" accent="text-accent-green" />
          <Row label="TP3" value="68,100" accent="text-accent-green" />
        </div>
      </motion.div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/45">{label}</span>
      <span className={`font-semibold ${accent ?? "text-white/85"}`}>
        {value}
      </span>
    </div>
  );
}
