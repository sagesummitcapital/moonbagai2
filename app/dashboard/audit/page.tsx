import { supabaseAdmin } from "@/lib/supabase/admin";
import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Card, Empty, Fold, Mono, PageHeader, whenShort } from "../_components/ui";

const Report = ({ text }: { text: string }) => (
  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-white/80">{text}</pre>
);

export const dynamic = "force-dynamic";

// Monthly desk audit (CR-34) + discipline metrics (CR-39). Runs itself on the first Saturday of each month. Read-only.
type Audit = { month: string; created_at: string; text: string };

export default async function AuditPage() {
  const { data, error } = await load(async () => {
    const r = await supabaseAdmin().from("desk_audits").select("month, created_at, text").order("month", { ascending: false }).limit(12);
    return (r.data ?? []) as Audit[];
  });
  const [latest, ...older] = data ?? [];
  const label = (m: string) => new Date(`${m}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="space-y-5">
      <DataNotice error={error} />
      <PageHeader title="Monthly audit" sub="Did each trade follow the rules? Stops, size, open risk, red-folder half risk, the plan stop, exits logged, plus the four discipline numbers. Recommendations only — rule changes still need your OK." />
      {latest ? (
        <Card title={label(latest.month)} right={<Mono>built {whenShort(latest.created_at)}</Mono>}>
          <Report text={latest.text} />
        </Card>
      ) : (
        <Card><Empty>No audit yet. The first one runs on the first Saturday of the month.</Empty></Card>
      )}
      {older.map((a) => (
        <Fold key={a.month} title={label(a.month)} right={<Mono>built {whenShort(a.created_at)}</Mono>}>
          <Report text={a.text} />
        </Fold>
      ))}
    </div>
  );
}
