import { withAgent, json, readJson, requireFields } from "@/lib/moonbag/apiAuth";
import { createReport, latestReport } from "@/lib/moonbag/db";

export const dynamic = "force-dynamic";

export const GET = withAgent(["claude", "grok"], async () => json({ ok: true, report: await latestReport() }));

/** Save the "MOONBAG DAILY" markdown report (immutable). */
export const POST = withAgent(["claude"], async (req) => {
  const body = await readJson(req);
  requireFields(body, ["markdown"]);
  const report = await createReport({
    markdown: String(body.markdown),
    title: typeof body.title === "string" ? body.title : null,
    ...(typeof body.report_date === "string" ? { report_date: body.report_date } : {}),
  });
  return json({ ok: true, report }, 201);
});
