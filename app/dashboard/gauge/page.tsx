import { supabaseAdmin } from "@/lib/supabase/admin";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Card, Empty, Mono, PageHeader, Table, num, whenShort } from "../_components/ui";

export const dynamic = "force-dynamic";

// Retail rotation gauge (CR-38): 0 = BTC only, 100 = alt euphoria. Context only — under 35 alt-long alerts carry a warning line.
type G = { day: string; score: number; zone: string; components: { name: string; value: number; weight: number }[]; created_at: string };

export default async function GaugePage() {
  const { data, error } = await load(async () => {
    const r = await supabaseAdmin().from("retail_gauge").select("day, score, zone, components, created_at").order("day", { ascending: false }).limit(90);
    return (r.data ?? []) as G[];
  });
  const rows = data ?? [];
  const g = rows[0];
  const zoneTone = (s: number) => (s < 35 ? "text-amber-300" : s < 65 ? "text-cyan-300" : "text-emerald-300");
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader title="Retail rotation gauge" sub="Is retail money in Bitcoin only, rotating, or chasing alts? Built on the read that alts need retail to come back. Context only: it never creates, blocks or grades a setup." />
      {g ? (
        <Card title={`Today · ${g.day}`} right={<Mono>updated {whenShort(g.created_at)}</Mono>}>
          <div className="flex flex-wrap items-end gap-4">
            <div className={`font-mono text-[44px] font-semibold tabular-nums ${zoneTone(Number(g.score))}`}>{num(g.score, 1)}</div>
            <div className="pb-2 text-[14px] text-white/70">{g.zone}<div className="text-[12px] text-white/40">under 35 = alt-long warning on alerts · 35–65 rotation starting · 65+ alt season</div></div>
          </div>
          <div className="mt-4">
            <Table head={["Input", "Score (0–100)", "Weight"]} align={["l", "r", "r"]}
              rows={(g.components ?? []).map((c) => [c.name, num(c.value, 1), String(c.weight)])} />
          </div>
        </Card>
      ) : (
        <Card><Empty>No reading yet. It updates every day at 6:05 AM Phoenix.</Empty></Card>
      )}
      {rows.length > 1 && (
        <Card title="History" right={<Mono>last {rows.length} days</Mono>}>
          <Table head={["Day", "Score", "Zone"]} align={["l", "r", "l"]} rows={rows.map((x) => [x.day, num(x.score, 1), x.zone])} />
        </Card>
      )}
    </div>
  );
}
