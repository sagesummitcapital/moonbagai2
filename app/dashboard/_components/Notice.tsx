import Link from "next/link";

export function DataNotice({ error }: { error: string | null }) {
  if (!error) return null;
  if (error === "not-configured") {
    return (
      <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-5 text-[14px] text-amber-100/90">
        Supabase isn&apos;t connected yet, so there&apos;s no data to show.{" "}
        <Link href="/setup" className="underline">Open the setup checklist</Link>.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-400/[0.06] p-5 text-[14px] text-rose-100/90">
      Couldn&apos;t load data: {error}. If you just created the database, make sure the migration SQL was run (SETUP.md, step 2).
    </div>
  );
}
