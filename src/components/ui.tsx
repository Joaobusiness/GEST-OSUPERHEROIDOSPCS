import Image from "next/image";
import Link from "next/link";
import { Decimal } from "decimal.js";

/** Official wordmark with its black ground converted to transparency. Built for dark surfaces (--ink); do not place it on light ones. */
export function Logo({ height = 40, priority = false }: { height?: number; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo-wordmark-alpha.png"
      alt="Super Herói dos PCs"
      width={Math.round(height * (1174 / 600))}
      height={height}
      priority={priority}
      className="block select-none"
    />
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 pb-5 pt-2">
      <div className="min-w-0">
        <h1>{title}</h1>
        {sub && <p className="mt-1 text-[0.9375rem] text-[var(--text-2)]">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Empty({ title, text, href, cta }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="card card-pad grid justify-items-center gap-2 py-10 text-center">
      <h3>{title}</h3>
      <p className="max-w-[40ch] text-[0.9375rem] text-[var(--text-2)]">{text}</p>
      {href && cta && <Link href={href} className="btn btn-primary mt-2">{cta}</Link>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card grid gap-px overflow-hidden" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton !rounded-none h-16" />)}
    </div>
  );
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const money = (v: Decimal.Value | { toString(): string } | null | undefined) => fmt.format(new Decimal(v?.toString() ?? 0).toNumber());

export function dateBR(d: Date | string | null | undefined, tz = "America/Sao_Paulo") {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}
export function dateTimeBR(d: Date | string | null | undefined, tz = "America/Sao_Paulo") {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export const OS_STATUS: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Aberta", tone: "chip" },
  DIAGNOSIS: { label: "Em diagnóstico", tone: "chip chip-accent" },
  WAITING_APPROVAL: { label: "Aguardando aprovação", tone: "chip chip-warn" },
  WAITING_PARTS: { label: "Aguardando peças", tone: "chip chip-warn" },
  IN_PROGRESS: { label: "Em execução", tone: "chip chip-accent" },
  COMPLETED: { label: "Concluída", tone: "chip chip-ok" },
  DELIVERED: { label: "Entregue", tone: "chip chip-ok" },
  CANCELED: { label: "Cancelada", tone: "chip chip-bad" },
};
export const QUOTE_STATUS: Record<string, { label: string; tone: string }> = {
  DRAFT: { label: "Rascunho", tone: "chip" },
  SENT: { label: "Enviado", tone: "chip chip-accent" },
  APPROVED: { label: "Aprovado", tone: "chip chip-ok" },
  REJECTED: { label: "Recusado", tone: "chip chip-bad" },
  EXPIRED: { label: "Expirado", tone: "chip chip-warn" },
  CANCELED: { label: "Cancelado", tone: "chip chip-bad" },
};
export function Status({ map, value }: { map: Record<string, { label: string; tone: string }>; value: string }) {
  const s = map[value] ?? { label: value, tone: "chip" };
  return <span className={s.tone}>{s.label}</span>;
}
