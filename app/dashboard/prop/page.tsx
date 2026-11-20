import { load } from "../_components/data";
import type { ReactNode } from "react";
import { DataNotice } from "../_components/Notice";
import { Badge, Card, Empty, Expander, Fold, KV, LongText, Mono, Money, Note, PageHeader, RMult, Section, Table, Ticket, TicketField, TicketFoot, TicketHead, TicketRow, Updated, biasGlyph, biasTone, money, whenShort, type Tone } from "../_components/ui";
import { getPlanState, PRE_TRADE_CHECKLIST, type PlanState } from "@/lib/moonbag/propPlan";
import { getPropData, getPropCaps, capsLine, lossesToLimit, edgeLines, GROK_PROP_PLAYBOOK, type PropCaps, type DeskEdge, type PropStatus, type PropTrade, type PropDay } from "@/lib/moonbag/prop";

export const dynamic = "force-dynamic";

/**
 * Prop firm desk (CR-56, Stavros 2026-11-04). Separate book from BloFin. Evaluation → Funded.
 * Hard = the firm's rules (breach ends the account). Soft = his 0.5–1% sizing guidance (never flagged as a break).
 */
const n = (v: unknown) => Number(v ?? 0);
const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;

// A hairline meter under an instrument number: how much of the room (or the target) is left.
function Meter({ value, max, tone }: { value: number; max: number; tone: Tone }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bg = { green: "bg-accent-green", red: "bg-rose-400", amber: "bg-amber-300", cyan: "bg-accent-cyan", gray: "bg-white/40" }[tone];
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.08]" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${w}%` }} />
    </div>
  );
}

const LABEL = "text-[11px] font-medium uppercase tracking-[0.16em] text-white/45";
const BAND = "border-t border-white/[0.06] px-4 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30 md:px-5";
// Room numbers stay white while there is plenty; amber when it is getting thin; rose when it is nearly or fully gone.
const roomText = (t: Tone) => (t === "red" ? "text-rose-300" : t === "amber" ? "text-amber-200" : "text-white");

/** One instrument on the prop panel: label, number, optional hairline meter, one quiet line. Hairlines, no box of its own. */
function Gauge({ k, v, unit, cls = "text-white", meter, sub }: { k: ReactNode; v: ReactNode; unit?: ReactNode; cls?: string; meter?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 border-l border-t border-white/[0.06] px-4 py-3.5 md:px-5">
      <div className={LABEL}>{k}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className={`fig font-mono text-[20px] font-semibold leading-none ${cls}`}>{v}</span>
        {unit && <span className="font-mono text-[11.5px] tabular-nums text-white/40">{unit}</span>}
      </div>
      {meter && <div className="mt-2.5">{meter}</div>}
      {sub && <div className="mt-1.5 text-[11.5px] leading-snug text-white/45">{sub}</div>}
    </div>
  );
}
const roomTone = (room: number, limit: number): Tone => (room <= 0 ? "red" : room / limit <= 0.34 ? "red" : room / limit <= 0.6 ? "amber" : "green");

const STEPS = [
  { key: "evaluation", label: "Evaluation", sub: "Hit +12% without breaking a rule" },
  { key: "passed", label: "Passed", sub: "Firm review, funded account issued" },
  { key: "funded", label: "Funded", sub: "Same rules, 80% of profit paid out" },
];

// Where the account is on the road to funded: one slim line. The step you are on carries its one-sentence meaning.
function Stepper({ stage }: { stage: string }) {
  const failed = stage === "breached" || stage === "closed";
  const at = STEPS.findIndex((s) => s.key === stage);
  return (
    <div className="rounded-xl border border-white/[0.06] px-3.5 py-2.5">
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => {
          const done = !failed && i < at;
          const cur = !failed && i === at;
          return (
            <li key={s.key} className="min-w-0">
              <div className={`flex items-center gap-2 text-[12.5px] font-semibold ${cur ? "text-white" : done ? "text-white/70" : "text-white/40"}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[11px] ${cur ? "bg-accent-cyan text-black" : done ? "bg-accent-green text-black" : "bg-white/10 text-white/60"}`}>{done ? "✓" : i + 1}</span>
                <span className="truncate">{s.label}</span>
              </div>
              <div className={`mt-1 hidden text-[11.5px] leading-snug sm:block ${cur ? "text-white/55" : "text-white/35"}`}>{s.sub}</div>
            </li>
          );
        })}
      </ol>
      {!failed && at >= 0 && <p className="mt-1.5 text-[11.5px] leading-snug text-white/55 sm:hidden">{STEPS[at].label}: {STEPS[at].sub}</p>}
    </div>
  );
}

const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

/**
 * The 3-second read (design direction 11/9, item 3). One panel: can he trade and the most he can risk (the hero), then the
 * firm's limits and his own plan as two rows of instrument numbers. Same numbers and the same colour rules as the old
 * "Today's plan" card and four tiles — only the layout changed. The snapshot time sits in the top line, never below the fold.
 */
function Cockpit({ a, p, gain, targetGain, ddLimit, dailyTone, ddTone, resetPhx }: {
  a: PropStatus; p?: PlanState | null; gain: number; targetGain: number; ddLimit: number; dailyTone: Tone; ddTone: Tone; resetPhx: string;
}) {
  const open = p?.status === "OPEN";
  const stale = p?.status === "STALE";
  const breached = a.stage === "breached";
  const bad = breached || (p != null && !open);
  const ring = bad ? "border-rose-400/30 bg-rose-400/[0.04]" : open ? "border-accent-green/25 bg-accent-green/[0.03]" : "border-white/[0.08] bg-white/[0.02]";
  const rail = bad ? "bg-rose-400" : open ? "bg-accent-green" : "bg-white/20";
  const HERO = "fig mt-2.5 font-mono font-semibold leading-none";
  return (
    <section aria-label="Prop account now" className={`min-w-0 overflow-hidden rounded-2xl border ${ring}`}>
      <div className="relative px-4 py-5 pl-5 md:px-6 md:py-6 md:pl-7">
        <span className={`absolute inset-y-4 left-0 w-[3px] rounded-r ${rail}`} aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className={LABEL}>{p ? (open ? "Today's plan · next trade risks up to" : "Today's plan") : "Balance"}</div>
          {/* Every number on this panel is only as fresh as this snapshot. */}
          <Updated label="balance snapshot" at={a.last_snapshot_at} cadenceH={24} verb="taken" />
        </div>
        {p ? (
          open
            ? <div className={`${HERO} text-[40px] text-accent-green sm:text-[48px] xl:text-[56px]`}>{usd(p.allowed_risk)}</div>
            : <div className={`${HERO} text-[32px] uppercase text-rose-300 sm:text-[40px]`}>{stale ? "Out of date" : "Locked"}</div>
        ) : (
          <div className={`${HERO} text-[40px] text-white sm:text-[48px] xl:text-[56px]`}>{money(a.balance)}</div>
        )}
        {p && (
          <p className={`mt-3 flex items-center gap-2.5 text-[15px] font-semibold leading-snug ${open ? "text-accent-green" : "text-rose-300"}`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${open ? "bg-accent-green" : `bg-rose-400 ${stale ? "motion-safe:animate-pulse-dot" : ""}`}`} aria-hidden />
            <span className="min-w-0">{open ? "Open — you can take a trade" : stale ? "Balance is out of date — no new trades until a fresh snapshot" : "Locked — no new trades"}</span>
          </p>
        )}
        {p && !open && p.locks.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[13px] leading-snug text-rose-100/85">
            {p.locks.map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
        )}
      </div>

      <div className={BAND}>Firm limits · one breach ends the account</div>
      <div className="overflow-hidden">
        <div className="-ml-px grid grid-cols-2 lg:grid-cols-4">
          <Gauge
            k="Room today"
            v={money(a.room_today)}
            unit={<>of {money(a.daily_limit_usd)}</>}
            cls={roomText(dailyTone)}
            meter={<Meter value={n(a.room_today)} max={n(a.daily_limit_usd)} tone={dailyTone} />}
            sub={<>floor {money(a.daily_floor)} today · checked on equity · resets {resetPhx} Phoenix</>}
          />
          <Gauge
            k="To the floor"
            v={money(a.room_to_floor)}
            unit={<>of {money(ddLimit)}</>}
            cls={roomText(ddTone)}
            meter={<Meter value={n(a.room_to_floor)} max={ddLimit} tone={ddTone} />}
            sub={<>static floor {money(a.dd_floor)} · never moves</>}
          />
          <Gauge
            k="To pass"
            v={money(a.to_target)}
            unit="to go"
            meter={<Meter value={Math.max(0, gain)} max={targetGain} tone="green" />}
            sub={<>{pct(n(a.target_progress_pct), 0)} of +{money(targetGain)} · pass at {money(a.target_balance)}</>}
          />
          <Gauge
            k="Balance"
            v={money(a.balance)}
            sub={<><Money v={gain} /> since start · equity {money(a.equity)} · start {money(a.starting_balance)}<br /><Updated label="snapshot" at={a.last_snapshot_at} cadenceH={24} verb="taken" /></>}
          />
        </div>
      </div>

      {p && (
        <>
          <div className={BAND}>Your plan today · room counts open trades at their stops</div>
          <div className="overflow-hidden">
            <div className="-ml-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <Gauge k="Trades left" v={p.trades_left} unit={<>of {p.rules.max_trades}</>} />
              <Gauge k="Losses left" v={p.losses_left} unit={<>of {p.rules.max_losses}</>} cls={p.losses_left === 0 ? "text-rose-300" : "text-white"} />
              <Gauge k="Today" v={<Money v={p.pnl_today} />} sub="this firm day" />
              <Gauge k="To day stop" v={usd(p.room_to_day_stop)} unit={<>of {usd(p.rules.day_stop)}</>} cls={p.room_to_day_stop <= 0 ? "text-rose-300" : "text-white"} />
              <Gauge k="To floor" v={usd(p.room_to_floor)} cls={p.room_to_floor < 200 ? "text-amber-200" : "text-white"} />
              <Gauge k="Open risk" v={usd(p.open_risk)} sub="open trades at their stops" />
            </div>
          </div>
          <div className="space-y-2 border-t border-white/[0.06] px-4 py-3.5 md:px-5">
            <p className="text-[12px] leading-snug text-white/50">
              Take profit at 2R · alert at +1R · 2 trades a day · 2 losses = done · day stop −${p.rules.day_stop} · no entries 6 PM–5 AM · resets 5:30 PM Phoenix.
            </p>
            <Expander open={open} summary={<><span className="font-semibold text-white/85">Before you click — your 11 checks</span> <span className="text-white/40">(reminders, never a block)</span></>}>
              <ol className="grid gap-x-6 gap-y-1 text-[12.5px] leading-snug text-white/75 sm:grid-cols-2">
                {PRE_TRADE_CHECKLIST.map((x, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 shrink-0 text-right font-mono tabular-nums text-white/35">{i + 1}</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ol>
            </Expander>
            <Expander summary="Your rules in full (11/13)">
              <p className="text-[12.5px] leading-relaxed text-white/60">
                Your rules (11/13): risk up to $100 ($50 inside $200 of the target), smaller as room shrinks, never bigger after a win or a loss · take profit at 2R, alert at +1R, you manage it · New York open · 2 trades a day · 2 losses = done · day stop −${p.rules.day_stop} ·
                no entries 6 PM–5 AM · 30 min after a loss · BTC/ETH/SOL same side = one position. Room counts open trades at their stops ({usd(p.open_risk)} now). Resets 5:30 PM Phoenix.
              </p>
            </Expander>
          </div>
        </>
      )}
    </section>
  );
}

/** One prop trade on a phone: every column of the desktop table, in three short lines instead of a sideways scroll. */
function TradeLine({ t }: { t: PropTrade }) {
  return (
    <li className="border-b border-white/[0.05] py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="text-[14px] text-white">{t.symbol}</strong>
          <Badge tone={biasTone(t.direction)}>{biasGlyph(t.direction)} {t.direction}</Badge>
          <span className="text-[12px] text-white/55">{t.status}</span>
        </div>
        <span className="text-[14px] font-semibold"><RMult v={t.r_multiple} /></span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11.5px] tabular-nums text-white/50">
        <span>{whenShort(t.opened_at)}</span>
        <span>lev {t.leverage != null ? `${n(t.leverage)}x` : "—"}</span>
        <span>risk {t.risk_dollars != null ? money(t.risk_dollars) : "—"}{t.risk_pct_of_start != null ? ` (${pct(n(t.risk_pct_of_start), 2)})` : ""}</span>
        {t.firm_flags?.length ? <span className="text-rose-300">firm flags: {t.firm_flags.join(", ")}</span> : <span className="text-white/35">no firm flags</span>}
      </div>
      {t.guidance_note && <p className="mt-1 text-[12px] leading-snug text-white/50">{t.guidance_note}</p>}
    </li>
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
  const live = mine.filter((t) => t.status === "open");
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
      {breached && <Note>This account breached a firm rule. Log what happened in the journal before buying another evaluation.</Note>}
      <Cockpit a={a} p={plan} gain={gain} targetGain={targetGain} ddLimit={ddLimit} dailyTone={dailyTone} ddTone={ddTone} resetPhx={resetPhx} />
      <Stepper stage={a.stage} />

      <Card title="Trades" right={<Mono>{a.trades} total · {a.open_trades} open{a.total_r != null ? ` · ${n(a.total_r) > 0 ? "+" : ""}${n(a.total_r).toFixed(2)}R · win ${pct(n(a.win_pct), 0)}` : ""}</Mono>}
        sub={flagged.length ? `${flagged.length} trade(s) with firm flags` : "Tell Grok each fill (with a screenshot) and he logs it here."}>
        {/* Open prop trades read like every other ticket on the desk. Same rows as the list below — nothing new is decided here. */}
        {live.length > 0 && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {live.map((t) => (
              <Ticket key={t.trade_id} tone={t.firm_flags?.length ? "caution" : "live"}>
                <TicketHead coin={t.symbol} side={t.direction} right={t.r_multiple != null ? <RMult v={t.r_multiple} /> : undefined}>
                  <Badge tone="green" dot>open</Badge>
                  {t.firm_flags?.length ? <Badge tone="red">{t.firm_flags.join(", ")}</Badge> : null}
                </TicketHead>
                <TicketRow cols={4} label="Position" className="mt-3">
                  <TicketField k="Risk" v={t.risk_dollars != null ? money(t.risk_dollars) : "—"} sub="lost if the stop is hit" />
                  <TicketField k="Risk · % of start" v={t.risk_pct_of_start != null ? pct(n(t.risk_pct_of_start), 2) : "—"} />
                  <TicketField k="Leverage" v={t.leverage != null ? `${n(t.leverage)}x` : "—"} />
                  <TicketField k="Opened" v={whenShort(t.opened_at)} />
                </TicketRow>
                {t.guidance_note && <p className="mt-2.5 text-[12px] leading-snug text-white/55">{t.guidance_note}</p>}
                <TicketFoot>
                  <span>{t.trade_id}</span>
                  <span className="text-white/35">entry, stop and target: read them on Breakout</span>
                </TicketFoot>
              </Ticket>
            ))}
          </div>
        )}
        {mine.length > 0 && <ul className="md:hidden">{mine.map((t) => <TradeLine key={t.trade_id} t={t} />)}</ul>}
        <div className={mine.length > 0 ? "hidden md:block" : ""}>
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
        </div>
      </Card>

      <Card title="Daily log" sub="The firm's trading days (they reset at 5:30 PM Phoenix). Daily limit is 3% of the balance that day started with.">
        <Table
          dense
          minWidth={0}
          head={["Firm day", "Trades", "P&L", "P&L %", "Limit"]}
          align={["l", "r", "r", "r", "r"]}
          empty="No trading days yet."
          rows={myDays.map((d) => [
            <span key="d" className="whitespace-nowrap font-mono tabular-nums">{d.day_utc}</span>,
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

      <Fold title="What your BloFin data says" sub="Same trader, same setups — your live record applied to this account. Facts, not new rules.">
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-snug text-white/75">
          {edgeLines(a, edge).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </Fold>
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
