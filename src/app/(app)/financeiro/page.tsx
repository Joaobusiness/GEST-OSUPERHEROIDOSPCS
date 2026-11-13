import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Plus, Tags } from "lucide-react";
import { Field, Input, Select } from "@/components/form";
import { dateBR, Empty, money, PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { cashSummary, listTransactions, resolvePeriod, todayDate } from "@/server/finance";
import { chipOff, chipOn, first, PeriodFilter, qs, type SP } from "./parts";

export const metadata = { title: "Financeiro" };

const STATUS = [["PENDING", "Pendente"], ["PAID", "Pago"], ["CANCELED", "Cancelado"]] as const;

export default async function Financeiro({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, tenant } = await requireAuth();
  const sp = await searchParams;
  const tz = tenant.timezone;
  const period = resolvePeriod({ p: first(sp.p), de: first(sp.de), ate: first(sp.ate) }, tz);
  const accrual = first(sp.v) === "competencia";
  const f = { type: first(sp.tipo), status: first(sp.status), categoryId: first(sp.cat), q: first(sp.q), overdue: first(sp.overdue) === "1" };
  const keep = { de: first(sp.de), ate: first(sp.ate), v: first(sp.v), tipo: f.type, status: f.status, cat: f.categoryId, q: f.q, overdue: f.overdue ? "1" : undefined };
  const periodKeep = { ...keep, de: undefined, ate: undefined };

  const [s, list, categories] = await Promise.all([
    cashSummary(db, period, tz),
    listTransactions(db, period, { ...f, page: Number(first(sp.pg)) || 1 }, tz),
    db.financialCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);
  const ids = [...new Set(list.rows.map((r) => r.customerId).filter((x): x is string => !!x))];
  const customers = ids.length ? await db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const customerName = new Map(customers.map((c) => [c.id, c.name]));
  const today = todayDate(tz);
  const filtered = !!(f.type || f.status || f.categoryId || f.q || f.overdue);
  const pageHref = (pg: number) => `/financeiro${qs({ ...keep, p: period.key, pg: String(pg) })}`;

  const lines = accrual
    ? [
        ["Receita por vencimento", "Tudo que vence no período, pago ou não. Não é dinheiro em caixa.", s.accrualIncome],
        ["Despesas por vencimento", "Contas que vencem no período, pagas ou não.", s.accrualExpense],
        ["Resultado por vencimento", "Receita menos despesas previstas. Faturamento não é lucro.", s.accrualNet],
      ] as const
    : [
        ["Receita recebida", "Dinheiro de clientes que entrou no período.", s.received],
        ["Despesas pagas", "Contas que você pagou no período.", s.spent],
        ["Resultado de caixa", "Entrou menos saiu. Não é lucro: ainda não considera o custo de cada serviço.", s.net],
      ] as const;

  return (
    <>
      <PageHeader
        title="Financeiro"
        sub={`${period.label}: ${dateBR(period.start, tz)} a ${dateBR(new Date(period.end.getTime() - 1), tz)}`}
        action={<Link href="/financeiro/nova" className="btn btn-primary btn-sm"><Plus size={18} aria-hidden /> Novo</Link>}
      />
      <PeriodFilter base="/financeiro" period={period} keep={periodKeep} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={`/financeiro${qs({ ...keep, p: period.key, v: undefined })}`} className={accrual ? chipOff : chipOn}>Caixa</Link>
        <Link href={`/financeiro${qs({ ...keep, p: period.key, v: "competencia" })}`} className={accrual ? chipOn : chipOff}>Por vencimento</Link>
        <Link href="/financeiro/categorias" className={`${chipOff} ml-auto gap-2`}><Tags size={16} aria-hidden /> Categorias</Link>
      </div>

      <ul className="card overflow-hidden" aria-label="Indicadores">
        {lines.map(([label, def, v]) => <Line key={label} label={label} def={def} value={v.toFixed(2)} />)}
        <Line label="A receber" def="Valores de clientes ainda pendentes, de qualquer data." value={s.toReceive.total.toFixed(2)}
          extra={s.lateIn.count > 0 ? { href: "/financeiro?overdue=1&tipo=INCOME", text: `${money(s.lateIn.total)} vencidos` } : undefined} />
        <Line label="A pagar" def="Contas suas ainda pendentes, de qualquer data." value={s.toPay.total.toFixed(2)}
          extra={s.lateOut.count > 0 ? { href: "/financeiro?overdue=1&tipo=EXPENSE", text: `${money(s.lateOut.total)} vencidos` } : undefined} />
      </ul>

      <h2 className="mb-2 mt-6">Lançamentos</h2>
      <details open={filtered} className="card mb-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden">
          Filtrar{filtered ? " (ativo)" : ""}
        </summary>
        <form method="get" action="/financeiro" className="grid gap-3 border-t border-[var(--line)] p-4">
          {Object.entries({ p: period.key, de: first(sp.de), ate: first(sp.ate), v: first(sp.v) }).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
          <Field name="q" label="Buscar"><Input name="q" defaultValue={f.q} placeholder="Descrição" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field name="tipo" label="Tipo">
              <Select name="tipo" defaultValue={f.type ?? ""}><option value="">Todos</option><option value="INCOME">Receita</option><option value="EXPENSE">Despesa</option></Select>
            </Field>
            <Field name="status" label="Situação">
              <Select name="status" defaultValue={f.status ?? ""}><option value="">Todas</option>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
          </div>
          <Field name="cat" label="Categoria">
            <Select name="cat" defaultValue={f.categoryId ?? ""}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === "INCOME" ? "receita" : "despesa"})</option>)}
            </Select>
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1">Aplicar filtros</button>
            <Link href={`/financeiro${qs({ p: period.key, de: first(sp.de), ate: first(sp.ate), v: first(sp.v) })}`} className="btn btn-quiet">Limpar</Link>
          </div>
        </form>
      </details>

      {list.total === 0 ? (
        <Empty
          title={filtered ? "Nada com estes filtros" : "Nenhum lançamento neste período"}
          text={filtered ? "Limpe os filtros ou escolha outro período." : "Receitas aparecem quando um orçamento é aprovado ou uma OS é entregue. Despesas você lança aqui."}
          href="/financeiro/nova"
          cta="Novo lançamento"
        />
      ) : (
        <>
          <ul className="card overflow-hidden">
            {list.rows.map((r) => {
              const inc = r.type === "INCOME";
              const late = r.status === "PENDING" && r.dueDate < today;
              const chip = r.status === "PAID" ? ["chip chip-ok", "Pago"] : r.status === "CANCELED" ? ["chip chip-bad", "Cancelado"]
                : late ? ["chip chip-bad", "Vencida"] : r.paid.gt(0) ? ["chip chip-warn", "Parcial"] : ["chip", "Pendente"];
              const who = r.customerId ? customerName.get(r.customerId) : undefined;
              const Icon = inc ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={r.id}>
                  <Link href={`/financeiro/${r.id}`} className="list-row">
                    <Icon size={20} aria-hidden className={`shrink-0 ${inc ? "text-[var(--ok)]" : "text-[var(--bad)]"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.description}</span>
                      <span className="block truncate text-sm text-[var(--text-2)]">
                        {r.category.name} · vence {dateBR(r.dueDate, "UTC")}{who ? ` · ${who}` : ""}
                      </span>
                    </span>
                    <span className="grid shrink-0 justify-items-end gap-1">
                      <span className="num font-semibold">{inc ? "" : "- "}{money(r.amount)}</span>
                      <span className={chip[0]}>{chip[1]}</span>
                    </span>
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-[var(--text-3)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {list.pages > 1 && (
            <nav aria-label="Páginas" className="mt-3 flex items-center justify-between gap-3">
              {list.page > 1 ? <Link href={pageHref(list.page - 1)} className="btn btn-quiet btn-sm">Anterior</Link> : <span />}
              <span className="num text-sm text-[var(--text-2)]">{list.page} de {list.pages}</span>
              {list.page < list.pages ? <Link href={pageHref(list.page + 1)} className="btn btn-quiet btn-sm">Próxima</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}

function Line({ label, def, value, extra }: { label: string; def: string; value: string; extra?: { href: string; text: string } }) {
  const neg = value.startsWith("-");
  return (
    <li className="list-row !items-start">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-[var(--text-2)]">{def}</span>
        {extra && <Link href={extra.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--bad)] underline underline-offset-2">{extra.text}</Link>}
      </span>
      <span className={`num shrink-0 text-lg font-semibold ${neg ? "text-[var(--bad)]" : ""}`}>{money(value)}</span>
    </li>
  );
}
