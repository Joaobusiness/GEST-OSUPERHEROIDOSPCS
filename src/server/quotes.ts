import type { TenantDb } from "@/lib/db";
import type { QuoteStatus, UberMode } from "@/generated/prisma/client";
import { onQuoteApproved, onQuoteCanceled } from "./finance";
import { DomainError, nextOrderNumber, type Tx } from "./orders";
import { dec, quoteTotals, uberCharge, type Line } from "./line-items";

/** Per-tenant sequence, atomic UPDATE ... RETURNING. */
export async function nextQuoteNumber(tx: Pick<Tx, "tenant">, tenantId: string) {
  const t = await tx.tenant.update({ where: { id: tenantId }, data: { quoteSeq: { increment: 1 } }, select: { quoteSeq: true } });
  return `ORC-${String(t.quoteSeq).padStart(4, "0")}`;
}

export type QuoteInput = {
  customerId: string; serviceOrderId?: string; items: Line[];
  discount: string; extraFee: string; validUntil?: Date; executionDays?: number;
  paymentTerms?: string; warranty?: string; notes?: string;
  uberMode: UberMode; uberCost: string; uberMarkup: boolean;
};

const EDITABLE: QuoteStatus[] = ["DRAFT", "SENT"];

async function rates(db: TenantDb, tenantId: string) {
  const s = (await db.pricingSettings.findFirst({ where: { tenantId } })) ?? { partMarginPct: 0, taxPct: 0, cardFeePct: 0 };
  // marginPct is only used to price a SEPARATE uber line with markup
  return { marginPct: s.partMarginPct.toString(), taxPct: s.taxPct.toString(), cardFeePct: s.cardFeePct.toString() };
}

const itemRows = (items: Line[], tenantId: string, quoteId: string) => items.map((i) => ({ ...i, tenantId, quoteId }));

/**
 * Creates (id = null) or updates a quote. DRAFT/SENT are edited in place. Any decided quote is an immutable
 * snapshot: saving creates revision+1 (same number, parentQuoteId) and an APPROVED parent becomes CANCELED.
 */
export async function saveQuote(db: TenantDb, tenantId: string, id: string | null, input: QuoteInput) {
  if (!(await db.customer.findFirst({ where: { id: input.customerId, deletedAt: null } }))) throw new DomainError("Cliente não encontrado.");
  if (input.serviceOrderId && !(await db.serviceOrder.findFirst({ where: { id: input.serviceOrderId, customerId: input.customerId } })))
    throw new DomainError("OS não encontrada para este cliente.");
  const r = await rates(db, tenantId);
  const t = quoteTotals(input.items, input, r, input.discount, input.extraFee);
  if (t.totalAmount.isNeg()) throw new DomainError("O desconto não pode passar do total.");
  const data = {
    customerId: input.customerId, serviceOrderId: input.serviceOrderId ?? null, uberMode: input.uberMode,
    uberCost: dec(input.uberCost).toFixed(2), uberMarkup: input.uberMarkup, discount: dec(input.discount).toFixed(2), extraFee: dec(input.extraFee).toFixed(2),
    ...r, totalCost: t.totalCost.toFixed(2), totalAmount: t.totalAmount.toFixed(2),
    executionDays: input.executionDays ?? null, validUntil: input.validUntil ?? null,
    paymentTerms: input.paymentTerms ?? null, warranty: input.warranty ?? null, notes: input.notes ?? null,
  };
  return db.$transaction(async (tx) => {
    const cur = id ? await tx.quote.findFirst({ where: { id } }) : null;
    if (id && !cur) throw new DomainError("Orçamento não encontrado.");
    if (cur && EDITABLE.includes(cur.status)) {
      await tx.quoteItem.deleteMany({ where: { quoteId: cur.id } });
      await tx.quoteItem.createMany({ data: itemRows(input.items, tenantId, cur.id) });
      return { quote: await tx.quote.update({ where: { id: cur.id }, data }), revised: false };
    }
    if (cur?.status === "CANCELED") throw new DomainError("Orçamento cancelado não pode ser alterado.");
    const number = cur ? cur.number : await nextQuoteNumber(tx, tenantId);
    const revision = cur ? ((await tx.quote.aggregate({ _max: { revision: true }, where: { number } }))._max.revision ?? cur.revision) + 1 : 1;
    const quote = await tx.quote.create({ data: { ...data, tenantId, number, revision, parentQuoteId: cur?.id ?? null } });
    await tx.quoteItem.createMany({ data: itemRows(input.items, tenantId, quote.id) });
    if (cur?.status === "APPROVED") await tx.quote.update({ where: { id: cur.id }, data: { status: "CANCELED" } });
    return { quote, revised: !!cur, supersededApprovedId: cur?.status === "APPROVED" ? cur.id : null };
  }).then(async (r) => {
    // finance runs after commit; both calls are idempotent, so a retry is safe
    if (r.supersededApprovedId) await onQuoteCanceled(db, r.supersededApprovedId);
    return r;
  });
}

/** Prefilled draft from an order's items, with the tenant's uber defaults. */
export async function createQuoteFromOrder(db: TenantDb, tenantId: string, orderId: string) {
  const o = await db.serviceOrder.findFirst({ where: { id: orderId }, include: { items: true } });
  if (!o) throw new DomainError("OS não encontrada.");
  const s = await db.pricingSettings.findFirst({ where: { tenantId } });
  const items: Line[] = o.items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity.toString(), unitCost: i.unitCost.toString(), unitPrice: i.unitPrice.toString() }));
  const { quote } = await saveQuote(db, tenantId, null, {
    customerId: o.customerId, serviceOrderId: o.id, items, discount: "0", extraFee: "0",
    uberMode: s?.defaultUberMode ?? "INCLUDED", uberCost: s?.defaultUberCost.toString() ?? "0", uberMarkup: s?.uberMarkup ?? false,
    notes: o.description,
  });
  return quote;
}

async function decide(db: TenantDb, id: string, from: QuoteStatus[], status: QuoteStatus, approvalMethod?: string) {
  const r = await db.quote.updateMany({ where: { id, status: { in: from } }, data: { status, approvalMethod, decidedAt: new Date() } });
  if (r.count !== 1) throw new DomainError("O status do orçamento não permite esta ação.");
}

export const sendQuote = (db: TenantDb, id: string) =>
  db.quote.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENT", sentAt: new Date() } });

export async function approveQuote(db: TenantDb, id: string, method: string) {
  await decide(db, id, ["DRAFT", "SENT"], "APPROVED", method);
  await onQuoteApproved(db, id);
}
export const rejectQuote = (db: TenantDb, id: string) => decide(db, id, ["DRAFT", "SENT"], "REJECTED");
export async function cancelQuote(db: TenantDb, id: string) {
  const was = await db.quote.findFirst({ where: { id }, select: { status: true } });
  await decide(db, id, ["DRAFT", "SENT", "APPROVED"], "CANCELED");
  if (was?.status === "APPROVED") await onQuoteCanceled(db, id);
}

/** Approved quote -> service order, items copied. Repeat calls return the same order. */
export async function convertToOrder(db: TenantDb, tenantId: string, userId: string | null, id: string) {
  const q = await db.quote.findFirst({ where: { id }, include: { items: true } });
  if (!q) throw new DomainError("Orçamento não encontrado.");
  if (q.status !== "APPROVED") throw new DomainError("Só orçamento aprovado vira OS.");
  if (q.serviceOrderId) return { orderId: q.serviceOrderId, created: false };
  const extras: Line[] = [];
  const line = (description: string, price: string): Line => ({ kind: "OTHER", description, quantity: "1", unitCost: "0", unitPrice: price });
  const uber = uberCharge(q, q);
  if (uber.gt(0)) extras.push(line("Deslocamento (Uber)", uber.toFixed(2)));
  if (dec(q.extraFee.toString()).gt(0)) extras.push(line("Taxa extra", q.extraFee.toFixed(2)));
  if (dec(q.discount.toString()).gt(0)) extras.push(line("Desconto", `-${q.discount.toFixed(2)}`));
  const items = [...q.items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity.toString(), unitCost: i.unitCost.toString(), unitPrice: i.unitPrice.toString() })), ...extras];
  try {
    const orderId = await db.$transaction(async (tx) => {
      const orderNumber = await nextOrderNumber(tx, tenantId);
      const o = await tx.serviceOrder.create({ data: { tenantId, customerId: q.customerId, orderNumber, description: q.notes || `Orçamento ${q.number}`, warrantyDays: 0, totalAmount: q.totalAmount.toFixed(2) } });
      await tx.serviceOrderItem.createMany({ data: items.map((i) => ({ ...i, tenantId, serviceOrderId: o.id })) });
      await tx.serviceOrderStatusLog.create({ data: { tenantId, serviceOrderId: o.id, toStatus: "OPEN", userId, note: `Criada do orçamento ${q.number}` } });
      // loser of a double click matches 0 rows and rolls back its order
      const link = await tx.quote.updateMany({ where: { id, serviceOrderId: null }, data: { serviceOrderId: o.id } });
      if (link.count !== 1) throw new DomainError("already");
      return o.id;
    });
    return { orderId, created: true };
  } catch (e) {
    if (e instanceof DomainError && e.message === "already") {
      const again = await db.quote.findFirst({ where: { id } });
      if (again?.serviceOrderId) return { orderId: again.serviceOrderId, created: false };
    }
    throw e;
  }
}

export async function listQuotes(db: TenantDb, f: { status?: QuoteStatus; q?: string }) {
  await db.quote.updateMany({ where: { status: "SENT", validUntil: { lt: new Date() } }, data: { status: "EXPIRED" } });
  const q = f.q?.trim();
  return db.quote.findMany({
    where: {
      ...(f.status ? { status: f.status } : {}),
      ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    include: { customer: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }], take: 100,
  });
}
