import Image from "next/image";
import Link from "next/link";
import { Inbox } from "lucide-react";
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

/** Iniciais num quadrado arredondado. A cor vem do nome: o mesmo cliente tem sempre a mesma. */
export function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  const tone = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 4;
  return <span aria-hidden className={`avatar ${tone ? `avatar-${tone}` : ""}`}>{ini}</span>;
}

export function Empty({ title, text, href, cta }: { title: string; text: string; href?: string; cta?: string }) {
  return (
    <div className="card card-pad grid justify-items-center gap-2 py-10 text-center">
      <span aria-hidden className="tile tile-accent mb-1 !size-12 !rounded-2xl"><Inbox size={22} /></span>
      <h3>{title}</h3>
      <p className="max-w-[40ch] text-[0.9375rem] text-[var(--text-2)]">{text}</p>
      {href && cta && <Link href={href} className="btn btn-primary mt-2">{cta}</Link>}
    </div>
  );
}

/** Preloader: imita o layout real (cabeçalho + linhas com avatar, texto e valor) para a página não "pular" quando o conteúdo chega. Só aparece após 150ms, então navegação rápida não pisca. */
export function Skeleton({ rows = 4, header = false }: { rows?: number; header?: boolean }) {
  return (
    <div role="status" className="skeleton-wrap grid gap-4">
      <span className="sr-only">Carregando…</span>
      {header && (
        <div className="grid gap-2 pb-3 pt-2" aria-hidden>
          <div className="skeleton h-8 w-44 max-w-full" />
          <div className="skeleton h-4 w-64 max-w-full" />
        </div>
      )}
      <div className="card divide-y divide-[var(--line)] overflow-hidden" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-4">
            <div className="skeleton size-11 shrink-0 !rounded-[14px]" />
            <div className="grid min-w-0 flex-1 gap-2">
              <div className="skeleton h-4 w-2/5" />
              <div className="skeleton h-3.5 w-3/5" />
            </div>
            <div className="skeleton h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
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
