import Link from "next/link";
import { load } from "./_components/data";
import { DataNotice } from "./_components/Notice";
import { Badge, Card, Empty, PageHeader, Stamps, Updated, whenShort } from "./_components/ui";
import { clean, fmt, getToday, pct, usd, type Setup, type TodayCoin } from "@/lib/moonbag/site";
import { biasWord, type Bias, type Outlook } from "@/lib/moonbag/outlook";

export const dynamic = "force-dynamic";

/**
 * TODAY (CR-78, Stavros 2026-11-13). One screen, in the order he decides:
 * 1. Can I trade? (his prop plan)  2. The market in real numbers  3. His own view  4. A / A+ setups  5. Open trades.
 * The old home page lives at /dashboard/command (System → Archive).
 */
const BIAS_TONE: Record<Bias, string> = { bullish: "text-accent-green", bearish: "text-rose-300", neutral: "text-white/70" };
const tone = (v: number | null | undefined) => (v == null || v === 0 ? "text-white/60" : v > 0 ? "text-accent-green" : "text-rose-300");

function Cell({ k, v, t = "text-white" }: { k: string; v: string; t?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">{k}</div>
      <div className={`mt-0.5 font-mono text-[18px] tabular-nums ${t}`}>{v}</div>
    </div>
  );
}

function vs(price: number | null, level: unknown) {
  const l = Number(level);
  if (price == null || !Number.isFinite(l) || l <= 0) return null;
  return ((price - l) / l) * 100;
}

function ViewLine({ o, label }: { o: Outlook; label: string }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-[13px] ${o.stale ? "border-white/10" : "border-amber-300/25 bg-amber-300/[0.04]"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-white">{label}</span>
        <span className={`text-[11px] ${o.stale ? "text-rose-300" : "text-white/40"}`}>{o.stale ? `${o.age_days} days old — give Grok a fresh view` : `given ${whenShort(o.given_at)}`}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <span><span className="text-white/40">Higher TF </span><span className={`font-semibold ${o.htf_bias ? BIAS_TONE[o.htf_bias] : "text-white/40"}`}>{biasWord(o.htf_bias)}</span></span>
        <span><span className="text-white/40">Lower TF </span><span className={`font-semibold ${o.ltf_bias ? BIAS_TONE[o.ltf_bias] : "text-white/40"}`}>{biasWord(o.ltf_bias)}</span></span>
        {o.flip != null && <span><span className="text-white/40">Flip </span><span className="font-mono text-white/90">{fmt(Number(o.flip))}</span></span>}
        {o.invalidation != null && <span><span className="text-white/40">Wrong if </span><span className="font-mono text-white/90">{fmt(Number(o.invalidation))}</span></span>}
      </div>
      {(o.htf_note || o.ltf_note || o.macro_note) && <p className="mt-1 text-[12.5px] leading-snug text-white/65">{[o.htf_note, o.ltf_note, o.macro_note].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

function SetupRow({ s }: { s: Setup }) {
  const long = s.direction === "long";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <Badge tone={s.grade === "A+" ? "green" : "cyan"}>{s.grade}</Badge>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-white">
          {s.symbol} <span className={long ? "text-accent-green" : "text-rose-300"}>{long ? "long" : "short"}</span>
          {s.origin === "paper" && <span className="ml-2 text-[11px] font-normal text-white/35">paper-tracked</span>}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[12px] tabular-nums text-white/70">
          <span>entry {fmt(s.limit_price)}</span>
          <span>stop {fmt(s.stop)}</span>
          <span>target {fmt(s.tp1)}</span>
        </div>
      </div>
      <div className="text-right font-mono text-[13px] tabular-nums text-white/85">{s.plan_r != null ? `${Number(s.plan_r).toFixed(1)}R` : "—"}</div>
    </div>
  );
}

function CoinRow({ c }: { c: TodayCoin }) {
  const wo = vs(c.price, c.levels?.wo), mo = vs(c.price, c.levels?.mo);
  const dn = c.below?.[0], up = c.above?.[0];
  const v = c.my_view;
  return (
    <tr className="border-t border-white/[0.05]">
      <td className="py-2 pr-3">
        <span className="text-[14px] font-semibold text-white">{c.asset}</span>
        {c.status !== "WAIT" && <span className="ml-2 align-middle"><Badge tone={c.status === "A+ SETUP" ? "green" : c.status === "TRIGGERED" ? "cyan" : "amber"}>{c.status}</Badge></span>}
      </td>
      <td className="py-2 pr-3 text-right font-mono tabular-nums text-white">{fmt(c.price)}</td>
      <td className={`py-2 pr-3 text-right font-mono tabular-nums ${tone(c.chg_24h)}`}>{pct(c.chg_24h)}</td>
      <td className={`py-2 pr-3 text-right font-mono tabular-nums ${tone(c.chg_7d)}`}>{pct(c.chg_7d)}</td>
      <td className={`py-2 pr-3 text-right font-mono tabular-nums ${c.rsi_4h != null && c.rsi_4h <= 30 ? "text-accent-green" : c.rsi_4h != null && c.rsi_4h >= 70 ? "text-rose-300" : "text-white/75"}`}>{c.rsi_4h ?? "—"}</td>
      <td className={`py-2 pr-3 text-right font-mono tabular-nums ${tone(wo)}`} title={`Weekly open ${fmt(Number(c.levels?.wo))}`}>{pct(wo)}</td>
      <td className={`py-2 pr-3 text-right font-mono tabular-nums ${tone(mo)}`} title={`Monthly open ${fmt(Number(c.levels?.mo))}`}>{pct(mo)}</td>
      <td className="py-2 pr-3 text-right font-mono text-[12px] tabular-nums text-white/70">{dn ? <>{fmt(Number(dn.px))} <span className="text-white/35">{clean(dn.label)}</span></> : "—"}</td>
      <td className="py-2 pr-3 text-right font-mono text-[12px] tabular-nums text-white/70">{up ? <>{fmt(Number(up.px))} <span className="text-white/35">{clean(up.label)}</span></> : "—"}</td>
      <td className="py-2 text-right text-[12px]">
        {v ? <span className={v.stale ? "opacity-50" : ""}><span className={`font-semibold ${v.htf_bias ? BIAS_TONE[v.htf_bias] : "text-white/40"}`}>{biasWord(v.htf_bias)}</span><span className="text-white/30"> / </span><span className={v.ltf_bias ? BIAS_TONE[v.ltf_bias] : "text-white/40"}>{biasWord(v.ltf_bias)}</span></span> : <span className="text-white/25">no view</span>}
      </td>
    </tr>
  );
}

export default async function TodayPage() {
  const { data, error } = await load(getToday);
  const p = data?.plan ?? null;
  const coins = data?.coins ?? [];
  const setups = data?.setups ?? [];
  const open = data?.open_trades ?? [];
  const btcFeed = data?.feed?.BTC ?? null;
  const feedAgeMin = btcFeed ? Math.round((Date.now() - new Date(btcFeed).getTime()) / 60000) : null;
  const feedStale = feedAgeMin != null && feedAgeMin > 45;
  const views = coins.filter((c) => c.my_view).map((c) => c.my_view!) as Outlook[];
  const macroKey = data?.macro?.key ?? null;
  const planOpen = p?.status === "OPEN";

  return (
    <div className="space-y-6">
      <PageHeader title="Today" sub="Can you trade, what the market is doing in real numbers, your own view, and the setups worth your attention. You place every order." />
      <Stamps>
        <Updated at={btcFeed} label="prices" verb="as of" cadenceH={0.5} />
        <Updated at={data?.macro?.created_at} label="macro read" cadenceH={26} />
      </Stamps>
      <DataNotice error={error} />
      {feedStale && (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] px-4 py-3 text-[13px] text-rose-100">
          Prices on this page are {feedAgeMin} minutes old. Check your chart before acting on any number here.
        </div>
      )}

      {/* 1 — Can I trade? */}
      {p && (
        <section className={`rounded-2xl border p-4 md:p-5 ${planOpen ? "border-accent-green/25 bg-accent-green/[0.04]" : "border-rose-400/30 bg-rose-400/[0.05]"}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/50">Can I trade? · prop account</h2>
            <div className={`text-[16px] font-semibold ${planOpen ? "text-accent-green" : "text-rose-300"}`}>
              {planOpen ? `Yes — risk up to ${usd(p.allowed_risk)} on the next trade` : p.status === "STALE" ? "Not yet — balance is out of date" : "No — done for now"}
            </div>
          </div>
          {!planOpen && (
            <ul className="mt-2 space-y-0.5 text-[13px] text-rose-100/85">
              {p.locks.map((l, i) => <li key={i}>• {l.startsWith("STALE") ? "Send Grok a fresh Breakout balance and equity screenshot before the next trade." : clean(l)}</li>)}
            </ul>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Cell k="Trades left" v={`${p.trades_left} of ${p.rules.max_trades}`} />
            <Cell k="Losses left" v={`${p.losses_left} of ${p.rules.max_losses}`} t={p.losses_left === 0 ? "text-rose-300" : "text-white"} />
            <Cell k="Today" v={`${p.pnl_today >= 0 ? "+" : "−"}$${Math.abs(Math.round(p.pnl_today))}`} t={tone(p.pnl_today)} />
            <Cell k="To day stop" v={usd(p.room_to_day_stop)} t={p.room_to_day_stop <= 0 ? "text-rose-300" : "text-white"} />
            <Cell k="To target" v={p.to_target != null ? usd(p.to_target) : "—"} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/45">
            <span>Take profit at 2R · alert at +1R · 2 trades a day · 2 losses = done · no entries 6 PM–5 AM.</span>
            <Link href="/dashboard/prop" className="text-white/70 hover:text-white">Prop account →</Link>
          </div>
          {data?.top_mistake && (
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-[12.5px] text-amber-100/90">
              <span className="font-semibold">Before you click:</span> your most expensive habit this week is “{clean(data.top_mistake.label)}” ({data.top_mistake.last_7d}× in 7 days). {clean(data.top_mistake.rule)}
            </div>
          )}
        </section>
      )}

      {/* 2 — The market in numbers */}
      <Card
        title="Market"
        right={macroKey ? <span className="font-mono text-[11.5px] text-white/55">{["US10Y", "DXY", "VIX", "GOLD", "OIL"].filter((k) => macroKey[k]).map((k) => `${k} ${macroKey[k]}`).join(" · ")}{macroKey.as_of ? ` (${macroKey.as_of})` : ""}</span> : undefined}
        sub={data?.macro?.regime ? `Macro read: ${clean(data.macro.regime)}. ${clean(data.macro.changes_mind) ? `What changes it: ${clean(data.macro.changes_mind)}` : ""}` : undefined}
      >
        {coins.length === 0 ? <Empty>No market data yet.</Empty> : (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="text-right text-[11px] uppercase tracking-[0.1em] text-white/40">
                  <th className="pb-2 pr-3 text-left font-medium">Coin</th>
                  <th className="pb-2 pr-3 font-medium">Price</th>
                  <th className="pb-2 pr-3 font-medium">24h</th>
                  <th className="pb-2 pr-3 font-medium">7d</th>
                  <th className="pb-2 pr-3 font-medium">4h RSI</th>
                  <th className="pb-2 pr-3 font-medium">vs week open</th>
                  <th className="pb-2 pr-3 font-medium">vs month open</th>
                  <th className="pb-2 pr-3 font-medium">Next level down</th>
                  <th className="pb-2 pr-3 font-medium">Next level up</th>
                  <th className="pb-2 font-medium">Your view</th>
                </tr>
              </thead>
              <tbody>{coins.map((c) => <CoinRow key={c.asset} c={c} />)}</tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-white/40">
          <span>RSI under 30 = stretched down, over 70 = stretched up. “Your view” is higher / lower timeframe.</span>
          <Link href="/dashboard/levels" className="text-white/70 hover:text-white">All levels →</Link>
        </div>
      </Card>

      {/* 3 — His view */}
      <Card title="Your view" sub="What you told Grok. A new view replaces the old one everywhere on the site.">
        {!data?.my_market && views.length === 0 ? (
          <Empty>No view on file yet. Tell Grok your read (higher and lower timeframe, your levels, where you are wrong) and it shows here, on Levels, and on your TradingView lines.</Empty>
        ) : (
          <div className="space-y-2">
            {data?.my_market && <ViewLine o={data.my_market} label="Market" />}
            {views.map((o) => <ViewLine key={o.scope} o={o} label={o.scope} />)}
          </div>
        )}
      </Card>

      {/* 4 — Setups */}
      <Card title="A and A+ setups" right={<Link href="/dashboard/setups" className="text-white/70 hover:text-white">All setups and strategies →</Link>}>
        {setups.length === 0 ? <Empty>No A or A+ setup right now. No trade is the default.</Empty> : <div className="space-y-2">{setups.slice(0, 5).map((s) => <SetupRow key={s.limit_id} s={s} />)}</div>}
      </Card>

      {/* 5 — Open trades */}
      {open.length > 0 && (
        <Card title="Open trades">
          <div className="space-y-2">
            {open.map((t) => (
              <div key={t.trade_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[13px]">
                <span className="font-semibold text-white">{t.symbol} <span className={t.direction === "long" ? "text-accent-green" : "text-rose-300"}>{t.direction}</span> <span className="font-normal text-white/35">{t.venue === "breakout" ? "prop" : t.venue}</span></span>
                <span className="font-mono tabular-nums text-white/75">entry {fmt(Number(t.entry))} · stop {fmt(t.stop == null ? null : Number(t.stop))}{t.risk_dollars != null ? ` · risk ${usd(Number(t.risk_dollars))}` : ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
