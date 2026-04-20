export function fmtPrice(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPips(diff: number): string {
  // For XAUUSD, 1 pip = $0.01 typically; we display $ diff with sign
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(2)}`;
}

export function fmtPct(n: number, digits = 2): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function clsx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
