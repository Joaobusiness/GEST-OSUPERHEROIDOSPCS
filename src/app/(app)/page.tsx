import Link from "next/link";
import { ChevronRight, FileText, Users, Wallet, Wrench } from "lucide-react";
import { Empty, PageHeader, money } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { loadDashboard, type Alert } from "@/server/dashboard";
import { resolvePeriod } from "@/server/finance";
import { first, PeriodFilter, type SP } from "./financeiro/parts";

export const metadata = { title: "Início" };

const ICON = { quotes: FileText, late: Wrench, overdue: Wallet, inactive: Users } as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, tenant } = await requireAuth();
  const sp = await searchParams;
  const period = resolvePeriod({ p: first(sp.p), de: first(sp.de), ate: first(sp.ate) }, tenant.timezone);
  const d = await loadDashboard(db, period, tenant.timezone);

  if (d.isEmpty) {
    return (
      <>
        <PageHeader title="Início" sub={tenant.name} />
        <Empty
          title="Comece pelo primeiro cliente"
          text="Cadastre um cliente e faça o primeiro orçamento. Os números vão aparecendo aqui no seu dia a dia."
          href="/clientes"
          cta="Cadastrar cliente"
        />
        <Link href="/orcamentos/novo" className="btn btn-quiet mt-3 w-full">Fazer um orçamento</Link>
      </>
    );
  }

  const p = d.estimatedProfit;
  const shown = d.alerts.filter((a) => a.count > 0);

  return (
    <>
      <PageHeader title="Início" sub={tenant.name} />
      <PeriodFilter base="/" period={period} />

      <section aria-label="Dinheiro no período" className="hero rise p-5">
        <p className="text-sm font-medium text-white">Recebido, {period.label.toLowerCase()}</p>
        <p className="num mt-1 text-[2.25rem] font-bold leading-none text-white">{money(d.received)}</p>
        <p className="mt-2 text-sm text-white">Só o que já caiu na mão. O que ainda está pendente não entra.</p>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
          <div>
            <dt className="text-sm text-white">Despesas pagas</dt>
            <dd className="num text-lg font-semibold">{money(d.spent)}</dd>
          </div>
          <div>
            <dt className="text-sm text-white">Lucro estimado</dt>
            <dd className="num text-lg font-semibold text-white">{money(p.profit)}</dd>
          </div>
        </dl>
        <details className="mt-3 border-t border-white/20">
          <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-white [&::-webkit-details-marker]:hidden">
            Como chegamos no lucro estimado
          </summary>
          <div className="grid gap-2 pb-2 text-sm">
            <dl className="grid gap-2">
              <Row t={`Orçamentos aprovados no período (${p.quotes})`} v={money(p.billed)} />
              <Row t="Menos impostos e taxa do cartão" v={`- ${money(p.fees)}`} />
              <Row t="Menos o custo de peças, mão de obra e Uber" v={`- ${money(p.costs)}`} />
              <Row t="Lucro estimado" v={money(p.profit)} strong />
            </dl>
            <p className="text-white">Usa os custos e percentuais guardados em cada orçamento. É uma estimativa e não olha o que já foi pago.</p>
          </div>
        </details>
      </section>

      <section aria-labelledby="atencao" className="mt-6">
        <h2 id="atencao" className="mb-2">Para ver agora</h2>
        {shown.length === 0 ? (
          <p className="card card-pad text-[var(--text-2)]">Tudo em dia por aqui. Nenhum orçamento, prazo ou conta esperando você.</p>
        ) : (
          <ul className="card overflow-hidden">
            {shown.map((a) => <AlertRow key={a.key} a={a} />)}
          </ul>
        )}
      </section>

      <section aria-labelledby="resumo" className="mt-6">
        <h2 id="resumo" className="mb-2">Resumo</h2>
        <ul className="card overflow-hidden">
          <Kpi href="/orcamentos" label="Orçamentos esperando resposta" sub={`${money(d.quotesWaiting.total)} em propostas`} value={String(d.quotesWaiting.count)} />
          <Kpi href="/remarketing" label="Clientes para contatar" sub={`Faz mais de ${d.inactiveDays} dias que não falam com você`} value={String(d.toContact)} />
          <Kpi label="Ticket médio" sub="Média dos orçamentos aprovados no período" value={d.avgTicket ? money(d.avgTicket) : "Sem dados"} />
        </ul>
      </section>
    </>
  );
}

function Row({ t, v, strong }: { t: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "border-t border-[var(--ink-line)] pt-2 font-semibold" : "text-[var(--on-ink-2)]"}`}>
      <dt>{t}</dt>
      <dd className="num shrink-0">{v}</dd>
    </div>
  );
}

function AlertRow({ a }: { a: Alert }) {
  const Icon = ICON[a.key];
  return (
    <li>
      <Link href={a.href} className="list-row">
        <span className="tile tile-accent"><Icon size={20} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{a.label}</span>
          <span className="block text-sm text-[var(--text-2)]">{a.detail}</span>
        </span>
        <span className="chip chip-warn num">{a.count}</span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--text-3)]" />
      </Link>
    </li>
  );
}

function Kpi({ label, sub, value, href }: { label: string; sub?: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {sub && <span className="block text-sm text-[var(--text-2)]">{sub}</span>}
      </span>
      <span className="num text-lg font-semibold">{value}</span>
    </>
  );
  return <li>{href ? <Link href={href} className="list-row">{body}</Link> : <div className="list-row">{body}</div>}</li>;
}
