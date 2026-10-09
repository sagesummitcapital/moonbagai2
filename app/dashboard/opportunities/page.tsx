import { getActiveTheses, listAlerts, listHandoffs, moonbagDate } from "@/lib/moonbag/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Mono, Table, biasTone, list, num, statusTone, when } from "../_components/ui";

export const dynamic = "force-dynamic";

type Px = { asset: string; price: number; ts: string };
type Play = { signal_id: string; asset: string; direction: string; status: string; trigger_price: number | null; entry: number | null; stop: number | null; tp1: number | null; confidence_score: number | null; confidence_grade: number | null; created_at: string };

const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const gradeName = (g?: number | null) => (g == null ? "" : g >= 5 ? "A+" : g >= 4 ? "A" : g >= 3 ? "B" : "C");

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
  const setups = (data?.theses ?? [])
    .filter((t) => t.asset !== "MASTER" && t.asset !== "EQUITY")
    .map((t) => {
      const p = prices[t.asset]?.price ?? null;
      const dir = String(t.trade_plan?.direction ?? t.bias ?? "").toLowerCase();
      const inv = t.levels?.invalidation != null ? Number(t.levels.invalidation) : null;
      // A short is dead once price is above invalidation; a long once it is below.
      const broken = p != null && inv != null && ((dir === "short" && p > inv) || (dir === "long" && p < inv));
      const old = t.thesis_date < today;
      return { t, p, broken, old };
    })
    .sort((a, b) => Number(a.broken) - Number(b.broken) || Number(b.t.setup_score ?? -1) - Number(a.t.setup_score ?? -1));
  const liveAlerts = (data?.alerts ?? []).filter((a) => ["active", "triggered", "stale"].includes(a.status));
  const openHandoffs = (data?.handoffs ?? []).filter((h) => ["pending", "acknowledged"].includes(h.status));

  return (
    <div className="space-y-6">
      <DataNotice error={error} />
      <Card title="Live plays (TradingView range lines)" right={<Mono>refreshed every hour by the Desk Lead</Mono>}>
        <Table
          head={["Coin", "Play", "Trigger", "Stop", "TP1", "Score", "Price now", "Distance", "Set"]}
          rows={(data?.live ?? []).map((s) => {
            const p = prices[s.asset]?.price ?? null;
            const lvl = Number(s.trigger_price ?? s.entry);
            const dist = p != null && lvl ? ((lvl - p) / p) * 100 : null;
            return [
              <span key="a"><strong className="text-white">{s.asset}</strong><br /><Mono>{s.signal_id}</Mono></span>,
              <Badge key="d" tone={biasTone(s.direction)}>{s.direction}</Badge>,
              <span key="t" className="font-mono">{num(lvl, 0)}</span>,
              num(s.stop),
              num(s.tp1),
              <span key="s" className="font-mono">{num(s.confidence_score, 0)} <span className="text-accent-green">{gradeName(s.confidence_grade)}</span></span>,
              <span key="p" className="font-mono">{num(p)}<div className="text-[11px] text-white/40">{ago(prices[s.asset]?.ts)}</div></span>,
              <span key="x" className="font-mono text-white/70">{dist == null ? "—" : `${dist > 0 ? "+" : ""}${num(dist, 2)}%`}</span>,
              ago(s.created_at),
            ];
          })}
          empty="No live plays on the range lines right now."
        />
      </Card>

      <Card title="Daily theses" right={<Mono>written once a day · checked against live price</Mono>}>
        <Table
          head={["Asset", "Direction", "Setup score", "Entry", "Stop", "Targets", "Invalidation", "Price now", "Status"]}
          rows={setups.map(({ t, p, broken, old }) => [
            <span key="a" className={broken ? "opacity-50" : ""}><strong className="text-white">{t.asset}</strong><br /><Mono>{t.thesis_id}</Mono><div className="text-[11px] text-white/40">written {ago(t.created_at)}</div></span>,
            <Badge key="d" tone={biasTone(t.trade_plan?.direction ?? t.bias)}>{t.trade_plan?.direction ?? t.bias}</Badge>,
            <span key="s" className="font-mono">{num(t.setup_score, 1)} <span className="text-accent-green">{t.setup_grade}</span></span>,
            list(t.trade_plan?.entry_zone),
            num(t.trade_plan?.stop),
            [t.trade_plan?.tp1, t.trade_plan?.tp2, t.trade_plan?.tp3].filter((x) => x != null).map((x) => num(x)).join(" · ") || "—",
            num(t.levels?.invalidation),
            <span key="p" className="font-mono">{num(p)}</span>,
            broken ? (
              <span key="st"><Badge tone="red">BROKEN</Badge><div className="mt-1 text-[11.5px] text-white/45">price is past invalidation — ignore this plan</div></span>
            ) : (
              <span key="st"><Badge tone={statusTone(t.decision)}>{t.decision.replace("_", " ").toUpperCase()}</Badge>{old && <div className="mt-1 text-[11.5px] text-amber-200/70">from {t.thesis_date}</div>}</span>
            ),
          ])}
          empty="No active theses. NO TRADE is a valid outcome."
        />
      </Card>

      <Card title="Grok handoffs (Robinhood)">
        <Table
          head={["Handoff", "Symbol", "Direction", "Entry condition", "Invalidation", "Score", "Status"]}
          rows={openHandoffs.map((h) => [
            <Mono key="i">{h.handoff_id}</Mono>, h.symbol,
            <Badge key="d" tone={biasTone(h.direction)}>{h.direction}</Badge>,
            h.entry_condition ?? "—", h.invalidation ?? "—", num(h.setup_score, 1),
            <Badge key="s" tone={statusTone(h.status)}>{h.status}</Badge>,
          ])}
          empty="No open handoffs for Grok."
        />
      </Card>

      <Card title="TradingView alerts">
        <Table
          head={["Alert", "Asset", "Condition", "Trigger", "Action", "Status", "Updated"]}
          rows={liveAlerts.map((a) => [
            <span key="i"><Mono>{a.alert_id}</Mono><br /><Mono>{a.thesis_id}</Mono></span>,
            a.tv_symbol ?? a.asset, a.condition, num(a.trigger_price), a.action,
            <span key="s"><Badge tone={statusTone(a.status)}>{a.status}</Badge>{a.status_reason && <div className="mt-1 text-[12px] text-white/45">{a.status_reason}</div>}</span>,
            when(a.updated_at),
          ])}
          empty="No live alerts recorded."
        />
      </Card>
    </div>
  );
}
