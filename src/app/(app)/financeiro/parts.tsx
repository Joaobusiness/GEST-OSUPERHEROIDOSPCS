import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { PERIODS, type Period } from "@/server/finance";

export type SP = Record<string, string | string[] | undefined>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export const METHODS = ["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Transferência", "Boleto", "Outro"];

/** Builds "?a=1&b=2" skipping empty values. */
export const qs = (o: Record<string, string | undefined>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
};

const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors";
export const chipOn = `${chip} border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]`;
export const chipOff = `${chip} border-[var(--line)] bg-[var(--card)] text-[var(--text)] hover:bg-[var(--bg)]`;

/** Period chips as plain links (works without JS). `keep` carries other query params across changes. */
export function PeriodFilter({ base, period, keep = {} }: { base: string; period: Period; keep?: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Período" className="mb-4 grid gap-2">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        {PERIODS.filter((p) => p.key !== "custom").map((p) => (
          <Link key={p.key} href={`${base}${qs({ ...keep, p: p.key })}`} className={period.key === p.key ? chipOn : chipOff} aria-current={period.key === p.key ? "true" : undefined}>
            {p.label}
          </Link>
        ))}
      </div>
      <details open={period.key === "custom"} className="card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden">
          <CalendarRange size={18} aria-hidden className="text-[var(--accent)]" /> Personalizado
          {period.key === "custom" && <span className="num ml-auto text-sm font-medium text-[var(--text-2)]">{period.from} a {period.to}</span>}
        </summary>
        <form method="get" action={base} className="grid gap-3 border-t border-[var(--line)] p-4">
          {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <input type="hidden" name="p" value="custom" />
          <div className="grid grid-cols-2 gap-3">
            <label className="field"><span className="label">De</span><input className="input" type="date" name="de" defaultValue={period.from} required /></label>
            <label className="field"><span className="label">Até</span><input className="input" type="date" name="ate" defaultValue={period.to} required /></label>
          </div>
          <button className="btn btn-primary">Aplicar período</button>
        </form>
      </details>
    </nav>
  );
}

/** Destructive action behind an explicit second step. Works without JS. */
export function Danger({ label, warning, children }: { label: string; warning: string; children: React.ReactNode }) {
  return (
    <details className="rounded-[var(--r-md)] border border-[var(--line)]">
      <summary className="btn btn-danger w-full cursor-pointer list-none [&::-webkit-details-marker]:hidden">{label}</summary>
      <div className="grid gap-3 p-4">
        <p className="text-[0.9375rem] text-[var(--text-2)]">{warning}</p>
        {children}
      </div>
    </details>
  );
}
