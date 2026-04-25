"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";

type Category = "All" | "Crypto" | "Stocks" | "Gold" | "ETF";

type Asset = {
  ticker: string;
  name: string;
  cat: Exclude<Category, "All">;
  score: number;
  change: number;
  setup: "A+" | "A" | "B+" | "B";
  rr: string;
  dir: "LONG" | "SHORT";
  status: "ready" | "watch" | "triggered" | "invalid";
  updated: string;
};

const ASSETS: Asset[] = [
  { ticker: "BTC", name: "Bitcoin", cat: "Crypto", score: 8.7, change: 2.4, setup: "A+", rr: "3.2R", dir: "LONG", status: "ready", updated: "12s" },
  { ticker: "ETH", name: "Ethereum", cat: "Crypto", score: 7.4, change: 1.8, setup: "A", rr: "2.6R", dir: "LONG", status: "ready", updated: "28s" },
  { ticker: "SOL", name: "Solana", cat: "Crypto", score: 8.1, change: 4.2, setup: "A+", rr: "3.0R", dir: "LONG", status: "triggered", updated: "6s" },
  { ticker: "NVDA", name: "NVIDIA", cat: "Stocks", score: 7.9, change: 1.1, setup: "A", rr: "2.4R", dir: "LONG", status: "watch", updated: "42s" },
  { ticker: "AAPL", name: "Apple", cat: "Stocks", score: 6.3, change: -0.6, setup: "B+", rr: "1.8R", dir: "SHORT", status: "watch", updated: "1m" },
  { ticker: "TSLA", name: "Tesla", cat: "Stocks", score: 7.1, change: 2.3, setup: "A", rr: "2.2R", dir: "LONG", status: "ready", updated: "35s" },
  { ticker: "GLD", name: "Gold ETF", cat: "Gold", score: 8.2, change: 0.9, setup: "A", rr: "2.9R", dir: "LONG", status: "triggered", updated: "18s" },
  { ticker: "XAUUSD", name: "Spot Gold", cat: "Gold", score: 7.6, change: 0.7, setup: "A", rr: "2.5R", dir: "LONG", status: "ready", updated: "22s" },
  { ticker: "SPY", name: "S&P 500 ETF", cat: "ETF", score: 6.8, change: 0.3, setup: "B+", rr: "1.9R", dir: "LONG", status: "watch", updated: "51s" },
  { ticker: "QQQ", name: "Nasdaq-100 ETF", cat: "ETF", score: 7.2, change: 0.6, setup: "A", rr: "2.1R", dir: "LONG", status: "ready", updated: "44s" },
];

const CATS: Category[] = ["All", "Crypto", "Stocks", "Gold", "ETF"];

function statusStyles(s: Asset["status"]) {
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
  return "text-white/80";
}

export function LiveRatings() {
  const [cat, setCat] = useState<Category>("All");
  const [data, setData] = useState(ASSETS);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) =>
        prev.map((a) => {
          const delta = (Math.random() - 0.5) * 0.05;
          const newScore = Math.max(5.9, Math.min(9.2, a.score + delta));
          return { ...a, score: Number(newScore.toFixed(1)) };
        })
      );
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const filtered = cat === "All" ? data : data.filter((a) => a.cat === cat);

  return (
    <section id="ratings" className="relative py-28 md:py-36">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 text-[11px] font-mono font-medium uppercase tracking-[0.22em] text-accent-green/80">
            Live ratings
          </div>
          <h2 className="text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-white md:text-[52px]">
            An <span className="text-gradient">always-on</span> opportunity
            board
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] text-white/55 md:text-[17px]">
            Moonbag is built to answer a simple question at all times: what is
            worth paying attention to right now?
          </p>
        </motion.div>

        {/* Category tabs */}
        <div className="mt-12 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1 backdrop-blur-md">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`relative rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
                  cat === c
                    ? "text-black"
                    : "text-white/60 hover:text-white/90"
                }`}
              >
                {cat === c && (
                  <motion.div
                    layoutId="cat-pill"
                    transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                    className="absolute inset-0 rounded-full bg-accent-gradient shadow-glow"
                  />
                )}
                <span className="relative z-10">{c}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Board */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="relative mt-10 overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.025] to-transparent backdrop-blur-md"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
                Live scan
              </span>
              <span className="hidden text-[11px] font-mono text-white/35 sm:inline">
                · {filtered.length} assets
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-white/40">
              <Clock className="h-3 w-3" />
              <span className="font-mono">updated continuously</span>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.7fr_0.65fr_0.8fr_0.6fr] items-center gap-3 border-b border-white/[0.05] px-5 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-white/38">
              <div>Asset</div>
              <div>Market</div>
              <div>Score</div>
              <div>24h</div>
              <div>Setup</div>
              <div>R/R</div>
              <div>Status</div>
              <div className="text-right">Updated</div>
            </div>

            <div className="divide-y divide-white/[0.04]">
              <AnimatePresence initial={false}>
                {filtered.map((a, i) => (
                  <motion.div
                    layout
                    key={a.ticker}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    className="group grid grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_0.7fr_0.65fr_0.8fr_0.6fr] items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-white/85">
                        {a.ticker.slice(0, 3)}
                      </div>
                      <div>
                        <div className="text-[13.5px] font-semibold tracking-tight text-white">
                          {a.ticker}
                        </div>
                        <div className="text-[11px] text-white/40">
                          {a.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-[12.5px] text-white/60">{a.cat}</div>
                    <div className={`num-tick text-[14px] font-semibold ${scoreColor(a.score)}`}>
                      {a.score.toFixed(1)}
                    </div>
                    <div
                      className={`num-tick flex items-center gap-1 text-[12.5px] font-medium ${
                        a.change >= 0 ? "text-accent-green" : "text-red-400"
                      }`}
                    >
                      {a.change >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {a.change >= 0 ? "+" : ""}
                      {a.change.toFixed(1)}%
                    </div>
                    <div>
                      <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[11px] font-mono font-semibold text-white/80">
                        {a.setup}
                      </span>
                    </div>
                    <div className="num-tick text-[12.5px] text-white/75">
                      {a.rr}
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider ${statusStyles(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <div className="text-right text-[11px] font-mono text-white/35">
                      {a.updated}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="divide-y divide-white/[0.04] md:hidden">
            {filtered.map((a) => (
              <div key={a.ticker} className="px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-[11px] font-semibold text-white/85">
                      {a.ticker.slice(0, 3)}
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold tracking-tight text-white">
                        {a.ticker}
                      </div>
                      <div className="text-[11px] text-white/40">
                        {a.cat} · {a.name}
                      </div>
                    </div>
                  </div>
                  <div className={`num-tick text-[17px] font-bold ${scoreColor(a.score)}`}>
                    {a.score.toFixed(1)}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <div
                    className={`font-medium ${
                      a.change >= 0 ? "text-accent-green" : "text-red-400"
                    }`}
                  >
                    {a.change >= 0 ? "+" : ""}
                    {a.change.toFixed(1)}% · {a.rr}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${statusStyles(a.status)}`}
                  >
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
