import { Decimal } from "decimal.js";
import type { Prisma, FinancialTransaction } from "@/generated/prisma/client";
import type { TenantDb } from "@/lib/db";
import { legacyPriceFromMargin } from "@/lib/pricing";

/**
 * Finance service. Pure `(db: TenantDb, ...)` functions: no cookies, no redirect.
 * Money is Decimal end to end. Cash view (TransactionPayment.paidAt) is the source of
 * "recebido"/"pago"; PENDING is never counted as received.
 */

export class FinanceError extends Error {}

export const TZ = "America/Sao_Paulo";
const D = (v: { toString(): string } | null | undefined) => new Decimal(v?.toString() ?? 0);
// forTenant() stamps tenantId on create, but Prisma's input types still demand it.
const scoped = <T extends object>(d: T) => d as never;
const isUnique = (e: unknown) => (e as { code?: string })?.code === "P2002";

// ---------------------------------------------------------------- periods (tenant timezone)

export type PeriodKey = "hoje" | "7d" | "30d" | "mes" | "mes-anterior" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "mes-anterior", label: "Mês anterior" },
  { key: "custom", label: "Personalizado" },
];

export interface Period {
  key: PeriodKey;
  label: string;
  /** Instants, end exclusive: for TransactionPayment.paidAt and other timestamps. */
  start: Date;
  end: Date;
  /** UTC-midnight dates, end exclusive: for @db.Date columns (dueDate). */
  dFrom: Date;
  dTo: Date;
  /** Inclusive local days as YYYY-MM-DD. */
  from: string;
  to: string;
}

type Ymd = [number, number, number];
const pad = (n: number) => String(n).padStart(2, "0");
const fmtYmd = ([y, m, d]: Ymd) => `${y}-${pad(m)}-${pad(d)}`;
const addDays = ([y, m, d]: Ymd, n: number): Ymd => {
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()];
};

function ymdIn(at: Date, tz: string): Ymd {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return [g("year"), g("month"), g("day")];
}

/** Wall-clock minus UTC, in ms, for the zone at that instant. */
function offsetMs(at: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(at);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant at which the given local day starts in `tz`. */
export function localMidnight([y, m, d]: Ymd, tz = TZ): Date {
  const guess = Date.UTC(y, m - 1, d);
  const t = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(t), tz));
}

/** Today's local date as a UTC-midnight Date (matches @db.Date comparisons). */
export function todayDate(tz = TZ, now = new Date()): Date {
  const [y, m, d] = ymdIn(now, tz);
  return new Date(Date.UTC(y, m - 1, d));
}

const parseYmd = (s?: string): Ymd | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const r: Ymd = [Number(m[1]), Number(m[2]), Number(m[3])];
  return fmtYmd(addDays(r, 0)) === s ? r : null; // rejects 2026-02-31
};

export function resolvePeriod(input: { p?: string; de?: string; ate?: string } = {}, tz = TZ, now = new Date()): Period {
  const today = ymdIn(now, tz);
  let key = (PERIODS.find((x) => x.key === input.p)?.key ?? "30d") as PeriodKey;
  let from: Ymd = today;
  let to: Ymd = today;
  const [y, m] = today;
  if (key === "custom") {
    const f = parseYmd(input.de), t = parseYmd(input.ate);
    const span = f && t ? (Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(f[0], f[1] - 1, f[2])) / 86_400_000 : -1;
    if (f && t && span >= 0 && span <= 366) {
      from = f; to = t;
    } else key = "30d";
  }
  if (key === "7d") from = addDays(today, -6);
  if (key === "30d") from = addDays(today, -29);
  if (key === "mes") { from = [y, m, 1]; to = [y, m, new Date(Date.UTC(y, m, 0)).getUTCDate()]; }
  if (key === "mes-anterior") {
    const pm = new Date(Date.UTC(y, m - 2, 1));
    const py = pm.getUTCFullYear(), pmm = pm.getUTCMonth() + 1;
    from = [py, pmm, 1]; to = [py, pmm, new Date(Date.UTC(py, pmm, 0)).getUTCDate()];
  }
  const after = addDays(to, 1);
  return {
    key,
    label: PERIODS.find((x) => x.key === key)!.label,
    start: localMidnight(from, tz),
    end: localMidnight(after, tz),
    dFrom: new Date(Date.UTC(from[0], from[1] - 1, from[2])),
    dTo: new Date(Date.UTC(after[0], after[1] - 1, after[2])),
    from: fmtYmd(from),
    to: fmtYmd(to),
  };
}

// ---------------------------------------------------------------- categories

export async function ensureCategory(db: TenantDb, name: string, type: "INCOME" | "EXPENSE") {
  const find = () => db.financialCategory.findFirst({ where: { name, type } });
  const hit = await find();
  if (hit) return hit;
  try {
    return await db.financialCategory.create({ data: scoped({ name, type }) });
  } catch (e) {
    if (isUnique(e)) return (await find())!;
    throw e;
  }
}

// ---------------------------------------------------------------- create

async function createOnce(db: TenantDb, data: Omit<Prisma.FinancialTransactionUncheckedCreateWithoutPaymentsInput, "tenantId" | "allocationKey"> & { allocationKey: string }) {
  const find = () => db.financialTransaction.findFirst({ where: { allocationKey: data.allocationKey } });
  const hit = await find();
  if (hit) return hit;
  try {
    return await db.financialTransaction.create({ data: scoped(data) });
  } catch (e) {
    if (isUnique(e)) return (await find())!;
    throw e;
  }
}

function checkAmount(v: Decimal.Value) {
  const a = new Decimal(v);
  if (!a.isFinite() || a.lte(0)) throw new FinanceError("Informe um valor maior que zero.");
  if (a.decimalPlaces() > 2) throw new FinanceError("Use no máximo 2 casas decimais.");
  return a;
}

async function assertOwned(db: TenantDb, ids: { customerId?: string | null; quoteId?: string | null }) {
  const [c, q] = await Promise.all([
    ids.customerId ? db.customer.findFirst({ where: { id: ids.customerId }, select: { id: true } }) : true,
    ids.quoteId ? db.quote.findFirst({ where: { id: ids.quoteId }, select: { id: true } }) : true,
  ]);
  if (!c) throw new FinanceError("Cliente não encontrado.");
  if (!q) throw new FinanceError("Orçamento não encontrado.");
}

/** Idempotent per allocationKey: a second call returns the existing row. */
export async function createReceivable(
  db: TenantDb,
  i: { customerId: string; quoteId?: string | null; amount: Decimal.Value; description: string; dueDate: Date; allocationKey: string },
): Promise<FinancialTransaction> {
  const amount = checkAmount(i.amount);
  await assertOwned(db, i);
  const category = await ensureCategory(db, "Serviços", "INCOME");
  return createOnce(db, {
    type: "INCOME", categoryId: category.id, customerId: i.customerId,
    quoteId: i.quoteId ?? null, amount: amount.toFixed(2), description: i.description, dueDate: i.dueDate, allocationKey: i.allocationKey,
  });
}

/** Manual INCOME/EXPENSE entry from the Financeiro screen. */
export async function createTransaction(
  db: TenantDb,
  i: { type: "INCOME" | "EXPENSE"; description: string; categoryId: string; amount: Decimal.Value; dueDate: Date; customerId?: string | null; paymentMethod?: string | null },
) {
  const amount = checkAmount(i.amount);
  const cat = await db.financialCategory.findFirst({ where: { id: i.categoryId } });
  if (!cat || cat.type !== i.type) throw new FinanceError("Categoria inválida para este tipo de lançamento.");
  await assertOwned(db, i);
  return db.financialTransaction.create({
    data: scoped({
      type: i.type, categoryId: i.categoryId, amount: amount.toFixed(2), description: i.description, dueDate: i.dueDate,
      customerId: i.customerId ?? null, paymentMethod: i.paymentMethod ?? null,
    }),
  });
}

// ---------------------------------------------------------------- payments

const lockRow = (tx: Pick<TenantDb, "$queryRaw">, id: string) =>
  tx.$queryRaw`SELECT 1 FROM "FinancialTransaction" WHERE id = ${id}::uuid FOR UPDATE`;

/** Net paid so far (reversals are negative rows). */
async function paidSum(tx: TenantDb, transactionId: string) {
  const r = await tx.transactionPayment.aggregate({ where: { transactionId }, _sum: { amount: true } });
  return D(r._sum.amount);
}

/** Partial payments allowed; PAID once the sum reaches the amount. Row-locked so parallel payments cannot overshoot. */
export async function registerPayment(
  db: TenantDb,
  transactionId: string,
  input: { amount: Decimal.Value; method?: string | null; paidAt?: Date },
): Promise<FinancialTransaction> {
  const amt = checkAmount(input.amount);
  return db.$transaction(async (tx) => {
    const owned = await tx.financialTransaction.findFirst({ where: { id: transactionId }, select: { id: true } });
    if (!owned) throw new FinanceError("Lançamento não encontrado.");
    await lockRow(tx as unknown as TenantDb, transactionId);
    const t = (await tx.financialTransaction.findFirst({ where: { id: transactionId } }))!;
    if (t.status === "CANCELED") throw new FinanceError("Lançamento cancelado não recebe pagamento.");
    if (t.status === "PAID") throw new FinanceError("Este lançamento já está quitado.");
    const paid = await paidSum(tx as unknown as TenantDb, transactionId);
    const remaining = D(t.amount).minus(paid);
    if (amt.gt(remaining)) throw new FinanceError(`Valor maior que o saldo em aberto (${remaining.toFixed(2)}).`);
    const paidAt = input.paidAt ?? new Date();
    await tx.transactionPayment.create({ data: scoped({ transactionId, amount: amt.toFixed(2), paidAt, method: input.method ?? null }) });
    const done = paid.plus(amt).gte(D(t.amount));
    return tx.financialTransaction.update({
      where: { id: transactionId },
      data: { ...(done ? { status: "PAID" as const, paidAt } : {}), ...(input.method ? { paymentMethod: input.method } : {}) },
    });
  });
}

/** Cancel keeps all history; any amount already paid is reversed with a negative row so cash stays right. */
export async function cancelTransaction(db: TenantDb, transactionId: string): Promise<FinancialTransaction> {
  return db.$transaction(async (tx) => {
    const owned = await tx.financialTransaction.findFirst({ where: { id: transactionId }, select: { id: true } });
    if (!owned) throw new FinanceError("Lançamento não encontrado.");
    await lockRow(tx as unknown as TenantDb, transactionId);
    const t = (await tx.financialTransaction.findFirst({ where: { id: transactionId } }))!;
    if (t.status === "CANCELED") return t;
    const paid = await paidSum(tx as unknown as TenantDb, transactionId);
    if (paid.gt(0)) {
      await tx.transactionPayment.create({ data: scoped({ transactionId, amount: paid.negated().toFixed(2), method: "Estorno" }) });
    }
    return tx.financialTransaction.update({ where: { id: transactionId }, data: { status: "CANCELED" } });
  });
}

// ---------------------------------------------------------------- integration hooks

/** Idempotent. Books main revenue, separate Uber revenue (SEPARATE only) and the Uber cost (every mode, once). */
export async function onQuoteApproved(db: TenantDb, quoteId: string): Promise<void> {
  const q = await db.quote.findFirst({ where: { id: quoteId } });
  if (!q) throw new FinanceError("Orçamento não encontrado.");
  const total = D(q.totalAmount);
  const uber = D(q.uberCost);
  let uberCharge = new Decimal(0);
  if (q.uberMode === "SEPARATE" && uber.gt(0)) {
    const fees = D(q.taxPct).plus(D(q.cardFeePct));
    uberCharge = (q.uberMarkup ? legacyPriceFromMargin(uber, D(q.marginPct), fees) : uber.div(new Decimal(1).minus(fees.div(100)))).toDecimalPlaces(2);
    if (uberCharge.gt(total)) uberCharge = total; // manual price below the uber line
  }
  const main = total.minus(uberCharge);
  const dueDate = todayDate();
  const base = { quoteId: q.id };
  const label = `orçamento ${q.number}`;

  if (main.gt(0)) {
    const c = await ensureCategory(db, "Serviços", "INCOME");
    await createOnce(db, { ...base, type: "INCOME", categoryId: c.id, customerId: q.customerId, amount: main.toFixed(2), description: `Serviço, ${label}`, dueDate, allocationKey: `quote:${q.id}:main` });
  }
  if (uberCharge.gt(0)) {
    const c = await ensureCategory(db, "Deslocamento (repasse)", "INCOME");
    await createOnce(db, { ...base, type: "INCOME", categoryId: c.id, customerId: q.customerId, amount: uberCharge.toFixed(2), description: `Deslocamento, ${label}`, dueDate, allocationKey: `quote:${q.id}:uber-income` });
  }
  if (uber.gt(0)) {
    const c = await ensureCategory(db, "Transporte / Uber", "EXPENSE");
    await createOnce(db, { ...base, type: "EXPENSE", categoryId: c.id, customerId: null, amount: uber.toFixed(2), description: `Uber, ${label}`, dueDate, allocationKey: `quote:${q.id}:uber-cost` });
  }
}

/** A quote that was APPROVED is revised or canceled: cancel what it booked so the revision is not counted twice. */
export async function onQuoteCanceled(db: TenantDb, quoteId: string): Promise<void> {
  const rows = await db.financialTransaction.findMany({ where: { quoteId, status: { not: "CANCELED" } }, select: { id: true } });
  for (const r of rows) await cancelTransaction(db, r.id);
}


/** open = PENDING amount minus what was already paid on those rows. */
export async function openBalance(db: TenantDb, type: "INCOME" | "EXPENSE", overdueBefore?: Date) {
  const tx: Prisma.FinancialTransactionWhereInput = { type, status: "PENDING", ...(overdueBefore ? { dueDate: { lt: overdueBefore } } : {}) };
  const [a, p] = await Promise.all([
    db.financialTransaction.aggregate({ where: tx, _sum: { amount: true }, _count: true }),
    db.transactionPayment.aggregate({ where: { transaction: tx }, _sum: { amount: true } }),
  ]);
  return { total: D(a._sum.amount).minus(D(p._sum.amount)), count: a._count };
}

export async function cashSummary(db: TenantDb, period: Period, tz = TZ) {
  const pay = (type: "INCOME" | "EXPENSE") =>
    db.transactionPayment.aggregate({ where: { paidAt: cashRange(period), transaction: { type } }, _sum: { amount: true } });
  const due = (type: "INCOME" | "EXPENSE") =>
    db.financialTransaction.aggregate({ where: { type, status: { not: "CANCELED" }, dueDate: { gte: period.dFrom, lt: period.dTo } }, _sum: { amount: true } });
  const today = todayDate(tz);
  const [rec, paid, dueIn, dueOut, toReceive, toPay, lateIn, lateOut] = await Promise.all([
    pay("INCOME"), pay("EXPENSE"), due("INCOME"), due("EXPENSE"),
    openBalance(db, "INCOME"), openBalance(db, "EXPENSE"), openBalance(db, "INCOME", today), openBalance(db, "EXPENSE", today),
  ]);
  const received = D(rec._sum.amount), spent = D(paid._sum.amount);
  const accIn = D(dueIn._sum.amount), accOut = D(dueOut._sum.amount);
  return {
    received, spent, net: received.minus(spent),
    accrualIncome: accIn, accrualExpense: accOut, accrualNet: accIn.minus(accOut),
    toReceive, toPay, lateIn, lateOut,
  };
}

export interface TxFilter {
  type?: string; status?: string; categoryId?: string; q?: string; overdue?: boolean; paid?: boolean; open?: boolean; page?: number; pageSize?: number;
}

function txWhere(period: Period, f: TxFilter, tz = TZ): Prisma.FinancialTransactionWhereInput {
  const where: Prisma.FinancialTransactionWhereInput = {};
  if (f.type === "INCOME" || f.type === "EXPENSE") where.type = f.type;
  if (f.status === "PENDING" || f.status === "PAID" || f.status === "CANCELED") where.status = f.status;
  if (f.categoryId) where.categoryId = f.categoryId;
  if (f.q) where.description = { contains: f.q, mode: "insensitive" };
  if (f.overdue) {
    where.status = "PENDING";
    where.dueDate = { lt: todayDate(tz) };
  } else if (f.paid) {
    // cards "Recebido"/"Pago": tudo que teve pagamento no período, mesmo parcial
    where.payments = { some: { paidAt: cashRange(period) } };
  } else if (f.open) {
    // cards "A receber"/"A pagar": o que ainda falta, de qualquer data
    where.status = "PENDING";
  } else {
    // due in the period, or touched by a payment in the period
    where.OR = [{ dueDate: { gte: period.dFrom, lt: period.dTo } }, { payments: { some: { paidAt: cashRange(period) } } }];
  }
  return where;
}

export async function listTransactions(db: TenantDb, period: Period, f: TxFilter = {}, tz = TZ) {
  const size = f.pageSize ?? 20;
  const where = txWhere(period, f, tz);
  const total = await db.financialTransaction.count({ where });
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const rows = await db.financialTransaction.findMany({
    where, orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * size, take: size,
    include: { category: { select: { name: true } }, payments: { select: { amount: true } } },
  });
  return { rows: rows.map((r) => ({ ...r, paid: r.payments.reduce((s, p) => s.plus(D(p.amount)), new Decimal(0)) })), total, page, pages };
}

const csvCell = (v: string) => {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // spreadsheet formula injection
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function transactionsCsv(db: TenantDb, period: Period, tz = TZ) {
  const rows = await db.financialTransaction.findMany({
    where: txWhere(period, {}, tz), orderBy: { dueDate: "asc" }, take: 5000,
    include: { category: { select: { name: true } }, payments: { select: { amount: true } } },
  });
  const head = ["Vencimento", "Tipo", "Descrição", "Categoria", "Valor", "Pago", "Situação"];
  const st = { PENDING: "Pendente", PAID: "Pago", CANCELED: "Cancelado" } as const;
  const lines = rows.map((r) =>
    [r.dueDate.toISOString().slice(0, 10), r.type === "INCOME" ? "Receita" : "Despesa", r.description, r.category.name, D(r.amount).toFixed(2),
      r.payments.reduce((s, p) => s.plus(D(p.amount)), new Decimal(0)).toFixed(2), st[r.status]].map(csvCell).join(";"));
  return "﻿" + [head.join(";"), ...lines].join("\r\n");
}

// ---------------------------------------------------------------- reads

type Range = { gte: Date; lt: Date };
const cashRange = (p: Period): Range => ({ gte: p.start, lt: p.end });

/** Cash flow rows for reports. shortcut: folds in JS, fine up to tens of thousands of payments per period; move to SQL GROUP BY after that. */
export async function cashReport(db: TenantDb, period: Period, tz = TZ) {
  const pays = await db.transactionPayment.findMany({
    where: { paidAt: cashRange(period) },
    select: { amount: true, paidAt: true, transaction: { select: { type: true, customerId: true, category: { select: { name: true } } } } },
  });
  const month = new Map<string, { income: Decimal; expense: Decimal }>();
  const cat = new Map<string, { name: string; type: "INCOME" | "EXPENSE"; total: Decimal }>();
  const cust = new Map<string, Decimal>();
  for (const p of pays) {
    const a = D(p.amount), t = p.transaction;
    const [y, m] = ymdIn(p.paidAt, tz);
    const mk = `${y}-${pad(m)}`;
    const mm = month.get(mk) ?? { income: new Decimal(0), expense: new Decimal(0) };
    if (t.type === "INCOME") mm.income = mm.income.plus(a); else mm.expense = mm.expense.plus(a);
    month.set(mk, mm);
    const ck = `${t.type}:${t.category.name}`;
    const cc = cat.get(ck) ?? { name: t.category.name, type: t.type, total: new Decimal(0) };
    cc.total = cc.total.plus(a);
    cat.set(ck, cc);
    if (t.type === "INCOME" && t.customerId) cust.set(t.customerId, (cust.get(t.customerId) ?? new Decimal(0)).plus(a));
  }
  const top = [...cust.entries()].sort((a, b) => b[1].comparedTo(a[1])).slice(0, 10);
  const names = top.length ? await db.customer.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, name: true } }) : [];
  const nameOf = new Map(names.map((c) => [c.id, c.name]));
  return {
    byMonth: [...month.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => ({ month: k, ...v, net: v.income.minus(v.expense) })),
    byCategory: [...cat.values()].sort((a, b) => b.total.comparedTo(a.total)),
    topCustomers: top.map(([id, total]) => ({ id, name: nameOf.get(id) ?? "Cliente removido", total })),
  };
}
