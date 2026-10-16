// One line of Stavros's trader's code under the desk title — a different line each day (Phoenix date). Display only.
// Source: docs/TRADER_CODE.md (Stavros, 2026-10-15).
const CODE = [
  "Wait for your setup. Manage your risk.",
  "Professionals know when to do nothing.",
  "A level touch isn't a trade — wait for confirmation.",
  "Price action first, your opinion last.",
  "Stop clicking — you're bored, not bullish.",
  "Patience, then execution.",
  "Know your stop before your entry.",
  "If the risk doesn't fit, the trade doesn't fit.",
  "More contracts don't fix bad discipline.",
  "Add when the trade confirms, not when you're desperate for a bounce.",
  "Put a shot clock on your trade. If nothing is happening, get out.",
  "A winning trade can still be a bad decision. A losing trade can still be the right one.",
  "Take the loss, goldfish memory, next setup.",
  "After your stop gets hit, the trade is over.",
  "No clear head, no trade.",
  "Missing a trade isn't losing money. Chasing it can be.",
  "Slow down.",
];

export function TraderCode() {
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });
  const n = Math.floor(Date.parse(day) / 86_400_000);
  return <span className="mt-1 block text-[13px] italic text-white/45">“{CODE[n % CODE.length]}”</span>;
}
