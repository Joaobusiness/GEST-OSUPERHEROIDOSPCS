import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarClock, ChevronRight, Clock, Plus, Tags, type LucideIcon } from "lucide-react";
import { Field, Input, Select } from "@/components/form";
import { dateBR, Empty, money, PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { cashSummary, listTransactions, resolvePeriod, todayDate } from "@/server/finance";
import { chipOff, first, PeriodFilter, qs, type SP } from "./parts";

export const metadata = { title: "Financeiro" };

const STATUS = [["PENDING", "Pendente"], ["PAID", "Pago"], ["CANCELED", "Cancelado"]] as const;

export default async function Financeiro({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, tenant } = await requireAuth();
  const sp = await searchParams;
  const tz = tenant.timezone;
  const period = resolvePeriod({ p: first(sp.p), de: first(sp.de), ate: first(sp.ate) }, tz);
  const accrual = first(sp.v) === "competencia";
  const f = { type: first(sp.tipo), status: first(sp.status), categoryId: first(sp.cat), q: first(sp.q), overdue: first(sp.overdue) === "1", paid: first(sp.pago) === "1", open: first(sp.aberto) === "1" };
  const keep = { de: first(sp.de), ate: first(sp.ate), v: first(sp.v), tipo: f.type, status: f.status, cat: f.categoryId, q: f.q, overdue: f.overdue ? "1" : undefined, pago: f.paid ? "1" : undefined, aberto: f.open ? "1" : undefined };
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
  const filtered = !!(f.type || f.status || f.categoryId || f.q || f.overdue || f.paid || f.open);
  const cardLabel = f.paid ? (f.type === "EXPENSE" ? "Pago no período" : "Recebido no período") : f.open ? (f.type === "EXPENSE" ? "A pagar" : "A receber") : f.overdue ? "Atrasados" : null;
  const base = { p: period.key, de: first(sp.de), ate: first(sp.ate), v: first(sp.v) };
  const pageHref = (pg: number) => `/financeiro${qs({ ...keep, p: period.key, pg: String(pg) })}`;

  const cash = !accrual;
  const hero = cash
    ? { label: "Resultado de caixa", note: "Entrou menos saiu. Ainda não é lucro: não desconta o custo de cada serviço.", value: s.net }
    : { label: "Resultado por vencimento", note: "Tudo que vence no período, pago ou não. Não é dinheiro em caixa.", value: s.accrualNet };
  const inV = cash ? s.received : s.accrualIncome;
  const outV = cash ? s.spent : s.accrualExpense;

  return (
    <>
      <PageHeader
        title="Financeiro"
        sub={`${period.label}: ${dateBR(period.start, tz)} a ${dateBR(new Date(period.end.getTime() - 1), tz)}`}
        action={<Link href="/financeiro/nova" className="btn btn-primary btn-sm"><Plus size={18} aria-hidden /> Novo</Link>}
      />
      <PeriodFilter base="/financeiro" period={period} keep={periodKeep} />

      <div className="mb-4">
        <nav className="seg" aria-label="Como contar">
          <Link href={`/financeiro${qs({ ...keep, p: period.key, v: undefined })}`} aria-current={cash ? "true" : undefined}>Caixa</Link>
          <Link href={`/financeiro${qs({ ...keep, p: period.key, v: "competencia" })}`} aria-current={accrual ? "true" : undefined}>Por vencimento</Link>
        </nav>
      </div>

      <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="hero rise p-5 col-span-2 lg:col-span-4">
          <p className="text-sm font-medium text-white">{hero.label}</p>
          <p className={`num mt-1 break-words text-[2.5rem] font-bold leading-none tracking-tight sm:text-5xl ${hero.value.isNeg() ? "text-[#ffd0cb]" : ""}`}>{money(hero.value)}</p>
          <p className="mt-3 max-w-[48ch] text-sm text-white">{hero.note}</p>
        </div>
        <Stat icon={ArrowDownLeft} tone="tile-ok" label={cash ? "Recebido" : "Receitas"} value={money(inV)} on={f.type === "INCOME" && (cash ? f.paid : !f.status && !f.open && !f.overdue && !f.paid)}
          href={`/financeiro${qs({ ...base, tipo: "INCOME", pago: cash ? "1" : undefined })}`} />
        <Stat icon={ArrowUpRight} tone="tile-bad" label={cash ? "Pago" : "Despesas"} value={money(outV)} on={f.type === "EXPENSE" && (cash ? f.paid : !f.status && !f.open && !f.overdue && !f.paid)}
          href={`/financeiro${qs({ ...base, tipo: "EXPENSE", pago: cash ? "1" : undefined })}`} />
        <Stat icon={Clock} tone="tile-accent" label="A receber" value={money(s.toReceive.total)} on={f.open && f.type === "INCOME"} href={`/financeiro${qs({ ...base, tipo: "INCOME", aberto: "1" })}`}
          extra={s.lateIn.count > 0 ? { href: "/financeiro?overdue=1&tipo=INCOME", text: `${money(s.lateIn.total)} atrasado` } : undefined} />
        <Stat icon={CalendarClock} tone="tile-warn" label="A pagar" value={money(s.toPay.total)} on={f.open && f.type === "EXPENSE"} href={`/financeiro${qs({ ...base, tipo: "EXPENSE", aberto: "1" })}`}
          extra={s.lateOut.count > 0 ? { href: "/financeiro?overdue=1&tipo=EXPENSE", text: `${money(s.lateOut.total)} atrasado` } : undefined} />
      </section>

      <div className="mb-2 mt-7 flex items-center justify-between gap-3">
        <h2>{cardLabel ?? "Lançamentos"}</h2>
        {cardLabel
          ? <Link href={`/financeiro${qs({ p: period.key, de: first(sp.de), ate: first(sp.ate), v: first(sp.v) })}`} className={`${chipOff} gap-2`}>Ver tudo</Link>
          : <Link href="/financeiro/categorias" className={`${chipOff} gap-2`}><Tags size={16} aria-hidden /> Categorias</Link>}
      </div>
      <details open={!!(f.q || f.categoryId || f.status)} className="card mb-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-[0.9375rem] font-semibold [&::-webkit-details-marker]:hidden">
          Filtrar lançamentos{filtered ? " (ativo)" : ""}
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
            <button className="btn btn-primary flex-1">Filtrar</button>
            <Link href={`/financeiro${qs({ p: period.key, de: first(sp.de), ate: first(sp.ate), v: first(sp.v) })}`} className="btn btn-quiet">Limpar</Link>
          </div>
        </form>
      </details>

      {list.total === 0 ? (
        <Empty
          title={filtered ? "Nada encontrado com esses filtros" : "Nada lançado neste período"}
          text={filtered ? "Tire os filtros ou escolha outro período." : "As entradas aparecem quando um orçamento é aprovado. As despesas você lança aqui."}
          href="/financeiro/nova"
          cta="Lançar agora"
        />
      ) : (
        <>
          <ul className="card overflow-hidden">
            {list.rows.map((r) => {
              const inc = r.type === "INCOME";
              const late = r.status === "PENDING" && r.dueDate < today;
              const chip = r.status === "PAID" ? ["chip chip-ok", "Pago"] : r.status === "CANCELED" ? ["chip chip-bad", "Cancelado"]
                : late ? ["chip chip-bad", "Atrasada"] : r.paid.gt(0) ? ["chip chip-warn", "Parcial"] : ["chip", "Pendente"];
              const who = r.customerId ? customerName.get(r.customerId) : undefined;
              const Icon = inc ? ArrowDownLeft : ArrowUpRight;
              return (
                <li key={r.id}>
                  <Link href={`/financeiro/${r.id}`} className="list-row">
                    <span className={`tile ${inc ? "tile-ok" : "tile-bad"}`}><Icon size={20} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 break-words font-medium">{r.description}</span>
                      <span className="block truncate text-sm text-[var(--text-2)]">
                        {r.category.name} · vence {dateBR(r.dueDate, "UTC")}{who ? ` · ${who}` : ""}
                      </span>
                    </span>
                    <span className="grid shrink-0 justify-items-end gap-1">
                      <span className={`num font-semibold ${inc ? "text-[var(--ok)]" : ""}`}>{inc ? "+ " : "- "}{money(r.amount)}</span>
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

function Stat({ icon: Icon, tone, label, value, extra, href, on }: { icon: LucideIcon; tone: string; label: string; value: string; extra?: { href: string; text: string }; href: string; on?: boolean }) {
  return (
    <div className={`card stat rise rise-2 relative grid content-between gap-3 p-4 ${on ? "ring-2 ring-[var(--accent)]" : ""}`}>
      <div className="flex flex-col items-start gap-2.5">
        <span className={`tile ${tone}`}><Icon size={20} aria-hidden /></span>
        <Link href={href} aria-current={on ? "true" : undefined} aria-label={`Ver lançamentos: ${label}`} className="min-w-0 rounded-[var(--r-lg)] text-[0.9375rem] font-medium text-[var(--text-2)] after:absolute after:inset-0 after:rounded-[var(--r-lg)] after:content-['']">{label}</Link>
      </div>
      <div>
        <p className="num break-words text-2xl font-bold tracking-tight">{value}</p>
        {extra && <Link href={extra.href} className="relative z-10 mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--bad)] underline underline-offset-2">{extra.text}</Link>}
      </div>
    </div>
  );
}
