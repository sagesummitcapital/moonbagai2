import { withAgent, json } from "@/lib/moonbag/apiAuth";
import {
  getActiveTheses, getSystemState, latestReport, listAlerts, listHandoffs, listTrades, moonbagDate,
} from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

/** One call that gives any agent the current canonical state. */
export const GET = withAgent(["claude", "grok"], async () => {
  const [systemState, theses, pendingHandoffs, activeAlerts, openTrades, report] = await Promise.all([
    getSystemState(),
    getActiveTheses(),
    listHandoffs("pending"),
    listAlerts("active"),
    listTrades({ status: "open" }),
    latestReport(),
  ]);
  return json({
    ok: true,
    date: moonbagDate(),
    system_state: systemState,
    active_theses: theses,
    pending_handoffs: pendingHandoffs,
    active_alerts: activeAlerts,
    open_trades: openTrades,
    latest_report: report,
  });
});
