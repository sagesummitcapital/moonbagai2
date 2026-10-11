import { getActiveTheses, listAlerts, listHandoffs, moonbagDate } from "@/lib/moonbag/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { load } from "../_components/data";
import { LiveMetric, LivePrice } from "../_components/LivePrice";
import { NON_TRADABLE, best, cryptoSetFrom, kindFor, loadLive, storedOf } from "../_components/live";
import { DataNotice } from "../_components/Notice";
import { Meter } from "../_components/charts";
import { Badge, Card, Id, Mono, PageHeader, Stat, StatGrid, Table, Updated, biasGlyph, biasTone, gradeName, gradeTone, list, num, statusTone, when } from "../_components/ui";

export const dynamic = "force-dynamic";

type Px = { asset: string; price: number; ts: string };
type Play = { signal_id: string; asset: string; direction: string; status: string; trigger_price: number | null; entry: number | null; stop: number | null; tp1: number | null; confidence_score: number | null; confidence_grade: number | null; created_at: string };

const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default async function OpportunitiesPage() {
  const { data, error } = await load(async () => {
    const db = supabaseAdmin();
    const [theses, handoffs, alerts, px, plays] = await Promise.all([
      getActiveTheses(),
      listHandoffs(),
      listAlerts(),
      // Latest price per coin, written by the Desk Lead every hour.
      db.from("lev_hourly").select("asset, price, ts").order("ts", { ascending: false }).limit(40),
      // The live plays sitting on the TradingView range lines.
      db.from("lev_signals").select("signal_id, asset, direction, status, trigger_price, entry, stop, tp1, confidence_score, confidence_grade, created_at")
        .eq("status", "watching").gte("created_at", new Date(Date.now() - 36 * 3600_000).toISOString()).order("created_at", { ascending: false }),
    ]);
    const prices: Record<string, Px> = {};
    for (const r of (px.data ?? []) as Px[]) if (!prices[r.asset]) prices[r.asset] = { ...r, price: Number(r.price) };
    // One play per coin + level (newest wins).
    const seen = new Set<string>();
    const live = ((plays.data ?? []) as Play[]).filter((p) => {
      const k = `${p.asset}-${p.direction}-${Number(p.trigger_price ?? p.entry)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { theses, handoffs, alerts, prices, live };
  });
  const prices = data?.prices ?? {};
  const today = moonbagDate();
  // Live prices for every coin with a play and every thesis asset; the desk's hourly price is the stored fallback.
  const cryptoSet = cryptoSetFrom(Object.keys(prices));
  const live = await loadLive([...(data?.live ?? []).map((s) => s.asset), ...(data?.theses ?? []).map((t) => t.asset).filter((a) => !NON_TRADABLE.has(a))], cryptoSet);
  const storedFor = (asset: string) => (prices[asset] ? storedOf(prices[asset].price, prices[asset].ts) : undefined);
  const deskAt = Object.values(prices).map((x) => x.ts).sort().reverse()[0] ?? null;
  const setups = (data?.theses ?? [])
    .filter((t) => t.asset !== "MASTER" && t.asset !== "EQUITY")
    .map((t) => {
      const { price: p, isLive } = best(live[t.asset], prices[t.asset]?.price ?? null);
      const dir = String(t.trade_plan?.direction ?? t.bias ?? "").toLowerCase();
      const inv = t.levels?.invalidation != null ? Number(t.levels.invalidation) : null;
      // A short is dead once price is above invalidation; a long once it is below.
      const broken = p != null && inv != null && ((dir === "short" && p > inv) || (dir === "long" && p < inv));
      const old = t.thesis_date < today;
      return { t, p, isLive, broken, old };
    })
    .sort((a, b) => Number(a.broken) - Number(b.broken) || Number(b.t.setup_score ?? -1) - Number(a.t.setup_score ?? -1));
  const liveAlerts = (data?.alerts ?? []).filter((a) => ["active", "triggered", "stale"].includes(a.status));
  const openHandoffs = (data?.handoffs ?? []).filter((h) => ["pending", "acknowledged"].includes(h.status));

  const livePlays = data?.live ?? [];
  const tradeable = setups.filter((x) => !x.broken && x.t.decision === "trade").length;
  const maxDist = Math.max(1, ...livePlays.map((s) => { const p = best(live[s.asset], prices[s.asset]?.price ?? null).price; const lvl = Number(s.trigger_price ?? s.entry); return p != null && lvl ? Math.abs(((lvl - p) / p) * 100) : 0; }));

  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader
        title="Opportunities"
        sub="What is sitting on a level right now: the plays on the TradingView range lines, today's theses checked against live price, and what has been handed to Grok."
        right={<Updated label="desk hourly map" at={deskAt} cadenceH={2} verb="checked" />}
      />

      <StatGrid cols={4}>
        <Card><Stat label="Live plays" value={livePlays.length} size="md" tone={livePlays.length ? "cyan" : undefined} sub="on the range lines, last 36h" /></Card>
        <Card><Stat label="Theses in play" value={setups.filter((x) => !x.broken).length} size="md" sub={`${setups.filter((x) => x.broken).length} broken · ${tradeable} marked TRADE`} /></Card>
        <Card><Stat label="Open handoffs" value={openHandoffs.length} size="md" tone={openHandoffs.length ? "green" : undefined} sub="pending or acknowledged by Grok" /></Card>
        <Card><Stat label="Live alerts" value={liveAlerts.length} size="md" sub="active, triggered or stale" /></Card>
      </StatGrid>

      <Card title="Live plays (TradingView range lines)" right={<Mono>plays set hourly by the Desk Lead · price and distance live</Mono>}>
        <Table
          head={["Coin", "Play", "Trigger", "Stop", "TP1", "Score", "Price now", "Distance to trigger", "Set"]}
          align={["l", "l", "r", "r", "r", "l", "r", "l", "l"]}
          minWidth={1000}
          rows={livePlays.map((s) => {
            const p = best(live[s.asset], prices[s.asset]?.price ?? null).price;
            const lvl = Number(s.trigger_price ?? s.entry);
            const dist = p != null && lvl ? ((lvl - p) / p) * 100 : null;
            return [
              <span key="a"><strong className="text-white">{s.asset}</strong><br /><Id>{s.signal_id}</Id></span>,
              <Badge key="d" tone={biasTone(s.direction)}>{biasGlyph(s.direction)} {s.direction}</Badge>,
              <strong key="t" className="text-white">{num(lvl, 0)}</strong>,
              <span key="st" className="text-rose-300/80">{num(s.stop)}</span>,
              <span key="tp" className="text-accent-green/80">{num(s.tp1)}</span>,
              <Badge key="s" tone={gradeTone(s.confidence_grade)}>{num(s.confidence_score, 0)} · {gradeName(s.confidence_grade) || "—"}</Badge>,
              <span key="p"><LivePrice symbol={s.asset} kind={kindFor(s.asset, cryptoSet)} initial={live[s.asset]} stored={storedFor(s.asset)} size="sm" />{prices[s.asset] && <div className="text-[11px] text-white/35">desk check {num(prices[s.asset].price)} · {ago(prices[s.asset].ts)}</div>}</span>,
              <span key="x" className="block min-w-[150px]">
                <LiveMetric symbol={s.asset} kind={kindFor(s.asset, cryptoSet)} initial={live[s.asset]} stored={storedFor(s.asset)} metric="distPct" level={lvl} className={dist != null && Math.abs(dist) < 1 ? "rounded bg-amber-300/10 px-1" : ""} />
                {dist != null && <Meter className="mt-1" value={maxDist - Math.abs(dist)} max={maxDist} tone={Math.abs(dist) < 1 ? "amber" : "gray"} height={4} />}
              </span>,
              <span key="ago" className="whitespace-nowrap text-white/60">{ago(s.created_at)}</span>,
            ];
          })}
          empty="No live plays on the range lines right now."
        />
        {livePlays.length > 0 && <p className="mt-2 text-[12px] text-white/40">Distance bar: fuller = price is closer to the trigger (amber within 1%) — the bar is set at page load, the figure keeps polling.</p>}
      </Card>

      <Card title="Daily theses" right={<Mono>written once a day · checked against live price</Mono>}>
        <Table
          head={["Asset", "Direction", "Setup score", "Entry", "Stop", "Targets", "Invalidation", "Price now", "Status"]}
          align={["l", "l", "l", "r", "r", "r", "r", "r", "l"]}
          minWidth={1020}
          rows={setups.map(({ t, p, isLive, broken, old }) => [
            <span key="a" className={broken ? "opacity-50" : ""}><strong className="text-white">{t.asset}</strong><br /><Id>{t.thesis_id}</Id><div className="text-[11.5px] text-white/40">written {ago(t.created_at)}</div></span>,
            <Badge key="d" tone={biasTone(t.trade_plan?.direction ?? t.bias)}>{biasGlyph(t.trade_plan?.direction ?? t.bias)} {t.trade_plan?.direction ?? t.bias}</Badge>,
            <span key="s" className="whitespace-nowrap font-mono tabular-nums">{num(t.setup_score, 1)} {t.setup_grade && <Badge tone={t.setup_grade === "A+" || t.setup_grade === "A" ? "green" : t.setup_grade === "B" ? "cyan" : "gray"}>{t.setup_grade}</Badge>}</span>,
            list(t.trade_plan?.entry_zone),
            <span key="stp" className="text-rose-300/80">{num(t.trade_plan?.stop)}</span>,
            <span key="tp" className="text-accent-green/80">{[t.trade_plan?.tp1, t.trade_plan?.tp2, t.trade_plan?.tp3].filter((x) => x != null).map((x) => num(x)).join(" · ") || "—"}</span>,
            num(t.levels?.invalidation),
            NON_TRADABLE.has(t.asset) ? <span key="p" className="text-white/40">—</span> : <LivePrice key="p" symbol={t.asset} kind={kindFor(t.asset, cryptoSet)} initial={live[t.asset]} stored={storedFor(t.asset)} size="sm" />,
            broken ? (
              <span key="st"><Badge tone="red">BROKEN</Badge><div className="mt-1 max-w-[180px] text-[11.5px] leading-snug text-white/45">{isLive ? "live" : "stored"} price is past invalidation — ignore this plan</div></span>
            ) : (
              <span key="st"><Badge tone={statusTone(t.decision)}>{t.decision.replace("_", " ").toUpperCase()}</Badge>{old && <div className="mt-1 text-[11.5px] text-amber-200/70">from {t.thesis_date}</div>}</span>
            ),
          ])}
          empty="No active theses. NO TRADE is a valid outcome."
        />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Grok handoffs (Robinhood)">
          <Table
            head={["Handoff", "Symbol", "Direction", "Entry condition", "Invalidation", "Score", "Status"]}
            align={["l", "l", "l", "l", "l", "r", "l"]}
            rows={openHandoffs.map((h) => [
              <Id key="i">{h.handoff_id}</Id>, <strong key="s" className="text-white">{h.symbol}</strong>,
              <Badge key="d" tone={biasTone(h.direction)}>{biasGlyph(h.direction)} {h.direction}</Badge>,
              <span key="e" className="text-white/70">{h.entry_condition ?? "—"}</span>, <span key="v" className="text-white/70">{h.invalidation ?? "—"}</span>, num(h.setup_score, 1),
              <Badge key="st" tone={statusTone(h.status)} dot>{h.status}</Badge>,
            ])}
            empty="No open handoffs for Grok."
          />
        </Card>

        <Card title="TradingView alerts" right={<Badge tone="gray">{liveAlerts.length}</Badge>}>
          <Table
            head={["Alert", "Asset", "Condition", "Trigger", "Action", "Status", "Updated"]}
            align={["l", "l", "l", "r", "l", "l", "l"]}
            dense
            maxHeight={520}
            rows={liveAlerts.map((a) => [
              <span key="i"><Id>{a.alert_id}</Id><br /><Id>{a.thesis_id}</Id></span>,
              <strong key="as" className="text-white">{a.tv_symbol ?? a.asset}</strong>, <span key="c" className="whitespace-nowrap">{a.condition === "cross_up" ? "↑ " : a.condition === "cross_down" ? "↓ " : ""}{a.condition}</span>, num(a.trigger_price), <Badge key="ac" tone={a.action === "ENTER" ? "green" : a.action === "EXIT" ? "amber" : "gray"}>{a.action}</Badge>,
              <span key="s"><Badge tone={statusTone(a.status)} dot>{a.status}</Badge>{a.status_reason && <div className="mt-1 max-w-[220px] text-[12px] leading-snug text-white/45">{a.status_reason}</div>}</span>,
              <span key="u" className="whitespace-nowrap text-white/60">{when(a.updated_at)}</span>,
            ])}
            empty="No live alerts recorded."
          />
        </Card>
      </div>
    </div>
  );
}
