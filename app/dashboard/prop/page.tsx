import { load } from "../_components/data";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, Fold, KV, LongText, Mono, Note, PageHeader, RMult, Section, Stat, StatGrid, Table, Tile, Unit, Updated, biasGlyph, biasTone, money, whenShort, type Tone } from "../_components/ui";
import { getPlanState, type PlanState } from "@/lib/moonbag/propPlan";
import { getPropData, getPropCaps, capsLine, lossesToLimit, edgeLines, GROK_PROP_PLAYBOOK, type PropCaps, type DeskEdge, type PropStatus, type PropTrade, type PropDay } from "@/lib/moonbag/prop";

export const dynamic = "force-dynamic";

/**
 * Prop firm desk (CR-56, Stavros 2026-11-04). Separate book from BloFin. Evaluation → Funded.
 * Hard = the firm's rules (breach ends the account). Soft = his 0.5–1% sizing guidance (never flagged as a break).
 */
const n = (v: unknown) => Number(v ?? 0);
const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;

function Meter({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bg = { green: "bg-accent-green", red: "bg-rose-400", amber: "bg-amber-300", cyan: "bg-accent-cyan", gray: "bg-white/40" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${w}%` }} />
    </div>
  );
}

const roomTone = (room: number, limit: number): Tone => (room <= 0 ? "red" : room / limit <= 0.34 ? "red" : room / limit <= 0.6 ? "amber" : "green");

const STEPS = [
  { key: "evaluation", label: "Evaluation", sub: "Hit +12% without breaking a rule" },
  { key: "passed", label: "Passed", sub: "Firm review, funded account issued" },
  { key: "funded", label: "Funded", sub: "Same rules, 80% of profit paid out" },
];

function Stepper({ stage }: { stage: string }) {
  const failed = stage === "breached" || stage === "closed";
  const at = STEPS.findIndex((s) => s.key === stage);
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {STEPS.map((s, i) => {
        const done = !failed && i < at;
        const cur = !failed && i === at;
        return (
          <li key={s.key} className={`rounded-xl border p-3 ${cur ? "border-accent-cyan/50 bg-accent-cyan/[0.06]" : done ? "border-accent-green/40 bg-accent-green/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}>
            <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${cur ? "bg-accent-cyan text-black" : done ? "bg-accent-green text-black" : "bg-white/10 text-white/60"}`}>{done ? "✓" : i + 1}</span>
              {s.label}
            </div>
            <div className="mt-1 text-[12px] leading-snug text-white/50">{s.sub}</div>
          </li>
        );
      })}
    </ol>
  );
}

/** Today's plan (CR-73): one glance — can he trade, how much, and what is left before the day stop. */
function PlanCard({ p }: { p: PlanState }) {
  const open = p.status === "OPEN";
  const cell = (k: string, v: string, tone = "text-white") => (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-white/40">{k}</div>
      <div className={`mt-0.5 font-mono text-[18px] tabular-nums ${tone}`}>{v}</div>
    </div>
  );
  const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
  return (
    <div className={`rounded-2xl border p-4 ${open ? "border-accent-green/25 bg-accent-green/[0.04]" : "border-rose-400/30 bg-rose-400/[0.05]"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/45">Today&apos;s plan</div>
        <div className={`text-[15px] font-semibold ${open ? "text-accent-green" : "text-rose-300"}`}>
          {open ? `OPEN — next trade risks up to ${usd(p.allowed_risk)}` : "LOCKED — no new trades"}
        </div>
      </div>
      {!open && <p className="mt-1 text-[13px] text-rose-100/85">{p.locks.join(" · ")}</p>}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cell("Trades left", `${p.trades_left} of ${p.rules.max_trades}`)}
        {cell("Losses left", `${p.losses_left} of ${p.rules.max_losses}`, p.losses_left === 0 ? "text-rose-300" : "text-white")}
        {cell("To day stop", usd(p.room_to_day_stop), p.room_to_day_stop <= 0 ? "text-rose-300" : "text-white")}
        {cell("To floor", usd(p.room_to_floor), p.room_to_floor < 200 ? "text-amber-200" : "text-white")}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-white/40">
        Your rules (11/12): risk up to $100, smaller as room shrinks and never bigger after a loss · 2 trades a day · 2 losses = done · day stop −${p.rules.day_stop} ·
        no entries 6 PM–5 AM · 30 min after a loss · BTC/ETH/SOL same side = one position. Room counts open trades at their stops ({usd(p.open_risk)} now). Resets 5:30 PM Phoenix.
      </p>
    </div>
  );
}

function AccountView({ a, trades, days, edge, caps, plan }: { a: PropStatus; trades: PropTrade[]; days: PropDay[]; edge: DeskEdge; caps: PropCaps | null; plan?: PlanState | null }) {
  const gain = n(a.balance) - n(a.starting_balance);
  const targetGain = n(a.target_balance) - n(a.starting_balance);
  const ddLimit = n(a.starting_balance) - n(a.dd_floor);
  const dailyTone = roomTone(n(a.room_today), n(a.daily_limit_usd));
  const ddTone = roomTone(n(a.room_to_floor), ddLimit);
  const resetPhx = new Date(a.day_resets_at).toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit", weekday: "short" });
  const mine = trades.filter((t) => t.account_id === a.account_id);
  const flagged = mine.filter((t) => (t.firm_flags?.length ?? 0) > 0);
  const myDays = days.filter((d) => d.account_id === a.account_id);
  const risk1 = n(a.risk_high_usd);
  const risk05 = n(a.risk_low_usd);
  const winsToPass = (r: number) => (r > 0 ? Math.ceil(n(a.to_target) / r) : null);
  const breached = a.stage === "breached";

  return (
    <div className="space-y-5">
      <PageHeader
        title={a.firm}
        kicker={a.program}
        sub={`${a.wallet_name ?? a.account_id} · separate book from BloFin. Firm rules below are hard: one breach ends the account.`}
        right={<Badge tone={breached ? "red" : a.stage === "funded" ? "green" : "cyan"} dot>{a.stage}</Badge>}
      />
      {plan && <PlanCard p={plan} />}
      <Stepper stage={a.stage} />

      {breached && <Note>This account breached a firm rule. Log what happened in the journal before buying another evaluation.</Note>}

      <StatGrid cols={4}>
        <Tile>
          <Stat label="Balance" value={money(a.balance)} sub={<>equity {money(a.equity)} · start {money(a.starting_balance)}<br /><Updated label="snapshot" at={a.last_snapshot_at} cadenceH={24} verb="taken" /></>} tone={gain >= 0 ? "green" : "red"} size="md" />
        </Tile>
        <Tile tone="accent">
          <Stat
            label="Profit target"
            value={<>{money(a.to_target)}<Unit>to go</Unit></>}
            size="md"
            meter={<Meter value={Math.max(0, gain)} max={targetGain} tone="green" />}
            sub={<>{pct(n(a.target_progress_pct), 0)} of +{money(targetGain)} · pass at {money(a.target_balance)}</>}
          />
        </Tile>
        <Tile tone={dailyTone === "green" ? undefined : "warn"}>
          <Stat
            label="Daily loss room"
            value={<>{money(a.room_today)}<Unit>of {money(a.daily_limit_usd)}</Unit></>}
            tone={dailyTone}
            size="md"
            meter={<Meter value={n(a.room_today)} max={n(a.daily_limit_usd)} tone={dailyTone} />}
            sub={<>floor {money(a.daily_floor)} today · checked on equity · resets {resetPhx} Phoenix</>}
          />
        </Tile>
        <Tile tone={ddTone === "green" ? undefined : "warn"}>
          <Stat
            label="Max drawdown room"
            value={<>{money(a.room_to_floor)}<Unit>of {money(ddLimit)}</Unit></>}
            tone={ddTone}
            size="md"
            meter={<Meter value={n(a.room_to_floor)} max={ddLimit} tone={ddTone} />}
            sub={<>static floor {money(a.dd_floor)} · never moves</>}
          />
        </Tile>
      </StatGrid>

      <Card title="Trades" right={<Mono>{a.trades} total · {a.open_trades} open{a.total_r != null ? ` · ${n(a.total_r) > 0 ? "+" : ""}${n(a.total_r).toFixed(2)}R · win ${pct(n(a.win_pct), 0)}` : ""}</Mono>}
        sub={flagged.length ? `${flagged.length} trade(s) with firm flags` : "Tell Grok each fill (with a screenshot) and he logs it here."}>
        <Table
          head={["Opened", "Symbol", "Side", "Lev", "Risk", "Risk %", "R", "Status", "Firm flags", "Note"]}
          align={["l", "l", "l", "r", "r", "r", "r", "l", "l", "l"]}
          empty="No prop trades yet. Tell Grok each fill and he logs it here."
          rows={mine.map((t) => [
            whenShort(t.opened_at),
            <strong key="s" className="text-white">{t.symbol}</strong>,
            <Badge key="d" tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>,
            t.leverage != null ? `${n(t.leverage)}x` : "—",
            t.risk_dollars != null ? money(t.risk_dollars) : "—",
            t.risk_pct_of_start != null ? pct(n(t.risk_pct_of_start), 2) : "—",
            <RMult key="r" v={t.r_multiple} />,
            t.status,
            t.firm_flags?.length ? <Badge tone="red">{t.firm_flags.join(", ")}</Badge> : <span className="text-white/35">clean</span>,
            t.guidance_note ? <span className="text-white/50">{t.guidance_note}</span> : "",
          ])}
        />
      </Card>

      <Card title="Daily log" sub="The firm's trading days (they reset at 5:30 PM Phoenix). Daily limit is 3% of the balance that day started with.">
        <Table
          head={["Firm day", "Trades", "P&L", "P&L %", "Limit"]}
          align={["l", "r", "r", "r", "r"]}
          empty="No trading days yet."
          rows={myDays.map((d) => [
            d.day_utc,
            d.trades,
            <span key="p" className={n(d.day_pnl) >= 0 ? "text-accent-green" : "text-rose-300"}>{money(d.day_pnl)}</span>,
            d.day_pct != null ? pct(n(d.day_pct), 2) : "—",
            money(d.daily_limit_usd),
          ])}
        />
      </Card>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Fold title="Firm rules" sub="Hard limits. Breaking any one fails the account.">
          <KV rows={[
            ["Profit target", `+${pct((targetGain / n(a.starting_balance)) * 100, 0)} → ${money(a.target_balance)}`],
            ["Max daily loss", `${money(a.daily_limit_usd)} (3% of the balance at reset, on equity)`],
            ["Daily reset", "00:30 UTC · 5:30 PM Phoenix"],
            ["Max drawdown", `5% static → floor ${money(a.dd_floor)}`],
            ["Max leverage", caps ? (capsLine(caps) ?? `${n(a.max_leverage)}x`).replace("Max leverage per coin (firm): ", "") : `${n(a.max_leverage)}x`],
            ["Fees", "0.04%/order + swap ~0.033%/day, count toward limits"],
            ["Phases", "1 (one-step)"],
            ["Time limit / min days", "None / none"],
            ["Profit split", `${n(a.profit_split_pct)}% to you`],
            ["Evaluation fee", a.fee_paid != null ? money(a.fee_paid) : "—"],
          ]} />
          <Section title="Prohibited by the firm" className="mt-4">
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-snug text-white/70">
              <li>Executing someone else&apos;s trade idea — callers, signal groups, social posts.</li>
              <li>Hedging across accounts: a prop trade opposite or correlated against another account, BloFin included.</li>
              <li>More than one account per household, device or IP.</li>
              <li>Changing trading style after passing.</li>
            </ul>
          </Section>
          <p className="mt-3 text-[12px] text-white/40">From Grok&apos;s review of Breakout&apos;s help center (11/4). Check the firm&apos;s current rules if anything looks off.</p>
        </Fold>

        <Fold title="Your sizing" sub="Guidance only — your call each trade (0.5% to 1%). Never flagged as a rule break.">
          <KV rows={[
            ["0.5% risk", money(risk05)],
            ["1% risk", money(risk1)],
            ["Losses at 1% before daily limit", String(lossesToLimit(n(a.room_today), risk1) ?? "—")],
            ["Losses at 1% before static floor", String(lossesToLimit(n(a.room_to_floor), risk1) ?? "—")],
            ["Losses at 0.5% before static floor", String(lossesToLimit(n(a.room_to_floor), risk05) ?? "—")],
            ["2R wins at 1% to pass", String(winsToPass(risk1 * 2) ?? "—")],
            ["2R wins at 0.5% to pass", String(winsToPass(risk05 * 2) ?? "—")],
          ]} />
          <Section title="Prop trader habits" className="mt-4">
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-snug text-white/70">
              <li>The static floor is the account. Protect the {money(ddLimit)} cushion first; the target comes from not breaching.</li>
              <li>Size for the daily limit, not the target. No time limit means no reason to press.</li>
              <li>Stop for the day once a third of the daily room is left — the desk pings Grok at that point.</li>
              <li>Every trade has a stop at entry. Leverage stays under the coin&apos;s firm cap (BTC {n(a.max_leverage)}x, most alts far lower).</li>
              <li>Your own reads only, and never the other side of an open BloFin trade.</li>
              <li>Snapshot the balance from the firm dashboard after each session so the numbers here match theirs.</li>
            </ul>
          </Section>
        </Fold>
      </div>

      <Card title="What your BloFin data says" sub="Same trader, same setups — your live record applied to this account. Facts, not new rules.">
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-snug text-white/75">
          {edgeLines(a, edge).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </Card>

      {a.stage === "funded" || a.stage === "passed" ? (
        <Card title="Payout estimate" sub={`${n(a.profit_split_pct)}% of profit above the starting balance.`}>
          <KV rows={[
            ["Profit now", money(Math.max(0, gain))],
            [`Your ${n(a.profit_split_pct)}%`, money((Math.max(0, gain) * n(a.profit_split_pct)) / 100)],
          ]} />
        </Card>
      ) : null}

      {a.notes && <Fold title="Account notes"><LongText text={a.notes} /></Fold>}
    </div>
  );
}

export default async function PropPage() {
  const { data, error } = await load(() => getPropData());
  const accounts = data?.accounts ?? [];
  const caps = await Promise.all(accounts.map((a) => getPropCaps(a.account_id).catch(() => null)));
  const plans = await Promise.all(accounts.map((a) => getPlanState(a.account_id).catch(() => null)));
  return (
    <div className="space-y-8">
      <DataNotice error={error} />
      {accounts.length === 0 && <Card><Empty>No prop firm accounts yet.</Empty></Card>}
      {accounts.map((a, i) => <AccountView key={a.account_id} a={a} trades={data!.trades} days={data!.days} edge={data!.edge} caps={caps[i]} plan={plans[i]} />)}
      {accounts.length > 0 && (
        <Fold title="How Grok handles this account" sub="The standing instructions Grok follows for the prop account.">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12.5px] leading-relaxed text-white/75">{GROK_PROP_PLAYBOOK}</pre>
        </Fold>
      )}
      {data && (
        <Card title="Prop journal" sub="Desk notes about the prop account (Breakout / prop firm mentions).">
          {data.notes.length ? (
            <ul className="space-y-3">
              {data.notes.map((j) => (
                <li key={j.id} className="border-b border-white/[0.05] pb-3 last:border-b-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px] text-white/45">
                    <Mono>#{j.id}</Mono><span>{j.author}</span><span>{whenShort(j.created_at)}</span>
                  </div>
                  <LongText text={j.body} max={260} />
                </li>
              ))}
            </ul>
          ) : <Empty>No prop notes yet.</Empty>}
        </Card>
      )}
    </div>
  );
}
