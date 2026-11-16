import type { TenantDb } from "@/lib/db";
import type { QuoteStatus, UberMode } from "@/generated/prisma/client";
import { onQuoteApproved, onQuoteCanceled } from "./finance";
import { DomainError, type Tx } from "./domain";
import { MAX_MONEY, dec, quoteTotals, type Line } from "./line-items";

/** Per-tenant sequence, atomic UPDATE ... RETURNING. */
export async function nextQuoteNumber(tx: Pick<Tx, "tenant">, tenantId: string) {
  const t = await tx.tenant.update({ where: { id: tenantId }, data: { quoteSeq: { increment: 1 } }, select: { quoteSeq: true } });
  return `ORC-${String(t.quoteSeq).padStart(4, "0")}`;
}

export type QuoteInput = {
  customerId: string; items: Line[];
  discount: string; extraFee: string; validUntil?: Date; executionDays?: number;
  paymentTerms?: string; warranty?: string; notes?: string;
  uberMode: UberMode; uberCost: string; uberMarkup: boolean;
};

const EDITABLE: QuoteStatus[] = ["DRAFT", "SENT"];

async function rates(db: TenantDb, tenantId: string) {
  const s = (await db.pricingSettings.findFirst({ where: { tenantId } })) ?? { markupPct: 0, taxPct: 0, cardFeePct: 0 };
  // snapshot column; only legacy quotes with uberMarkup read it back (see uberCharge)
  return { marginPct: s.markupPct.toString(), taxPct: "0", cardFeePct: "0" }; // imposto e cartão ficaram fora do MVP
}

const itemRows = (items: Line[], tenantId: string, quoteId: string) => items.map((i) => ({ ...i, tenantId, quoteId }));

/**
 * Creates (id = null) or updates a quote. DRAFT/SENT are edited in place. Any decided quote is an immutable
 * snapshot: saving creates revision+1 (same number, parentQuoteId) and an APPROVED parent becomes CANCELED.
 */
export async function saveQuote(db: TenantDb, tenantId: string, id: string | null, input: QuoteInput) {
  if (!(await db.customer.findFirst({ where: { id: input.customerId, deletedAt: null } }))) throw new DomainError("Cliente não encontrado.");
  const r = await rates(db, tenantId);
  const t = quoteTotals(input.items, input, r, input.discount, input.extraFee);
  if (t.totalAmount.isNeg()) throw new DomainError("O desconto não pode passar do total.");
  if (t.totalAmount.gt(MAX_MONEY) || t.totalCost.gt(MAX_MONEY)) throw new DomainError("Valor total grande demais.");
  const data = {
    customerId: input.customerId, uberMode: input.uberMode,
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

async function decide(db: TenantDb, id: string, from: QuoteStatus[], status: QuoteStatus, approvalMethod?: string) {
  const r = await db.quote.updateMany({ where: { id, status: { in: from } }, data: { status, approvalMethod, decidedAt: new Date() } });
  if (r.count !== 1) throw new DomainError("O status do orçamento não permite esta ação.");
}

export const sendQuote = (db: TenantDb, id: string) =>
  db.quote.updateMany({ where: { id, status: "DRAFT" }, data: { status: "SENT", sentAt: new Date() } });

export async function approveQuote(db: TenantDb, id: string, method: string) {
  // already APPROVED = a previous finance step failed: re-run it (idempotent by allocationKey)
  const cur = await db.quote.findFirst({ where: { id }, select: { status: true } });
  if (cur?.status !== "APPROVED") await decide(db, id, ["DRAFT", "SENT"], "APPROVED", method);
  await onQuoteApproved(db, id);
}
export const rejectQuote = (db: TenantDb, id: string) => decide(db, id, ["DRAFT", "SENT"], "REJECTED");
export async function cancelQuote(db: TenantDb, id: string) {
  const was = await db.quote.findFirst({ where: { id }, select: { status: true } });
  // already CANCELED = retry after a failed finance step: onQuoteCanceled is idempotent
  if (was?.status !== "CANCELED") await decide(db, id, ["DRAFT", "SENT", "APPROVED"], "CANCELED");
  if (was?.status === "APPROVED" || was?.status === "CANCELED") await onQuoteCanceled(db, id);
}

/** One page of quotes, newest first. `page` is clamped to the valid range. */
export async function listQuotes(db: TenantDb, f: { status?: QuoteStatus; q?: string; page?: number; size?: number }) {
  await db.quote.updateMany({ where: { status: "SENT", validUntil: { lt: new Date() } }, data: { status: "EXPIRED" } });
  const q = f.q?.trim();
  const where = {
    ...(f.status ? { status: f.status } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" as const } }, { customer: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const size = f.size ?? 20;
  const total = await db.quote.count({ where });
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, f.page ?? 1), pages);
  const rows = await db.quote.findMany({
    where, include: { customer: { select: { name: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * size, take: size,
  });
  return { rows, total, page, pages };
}
