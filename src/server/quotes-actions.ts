"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { done, fail, moneyStr, optional, parse, uuid, type ActionState } from "@/lib/action";
import { requireAuth } from "./auth";
import { DomainError } from "./orders";
import { approveQuote, cancelQuote, convertToOrder, rejectQuote, saveQuote, sendQuote } from "./quotes";
import { itemsField } from "./line-items";

async function wrap(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try { return (await fn()) ?? done(); } catch (e) { if (e instanceof DomainError) return fail(e.message); throw e; }
}

export async function saveQuoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({
    id: optional(uuid), customerId: uuid, serviceOrderId: optional(uuid), items: itemsField,
    discount: moneyStr, extraFee: moneyStr, uberCost: moneyStr, uberMode: z.enum(["INCLUDED", "SEPARATE", "ABSORBED"]),
    uberMarkup: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    // valid through the end of that day (UTC); the list expires SENT quotes after it
    validUntil: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").transform((s) => new Date(`${s}T23:59:59Z`))),
    executionDays: optional(z.string().regex(/^\d{1,4}$/, "Informe dias.").transform(Number)),
    paymentTerms: optional(z.string().max(500)), warranty: optional(z.string().max(500)), notes: optional(z.string().max(2000)),
  }), fd);
  if ("state" in p) return p.state;
  const { id, ...input } = p.data;
  const { db, tenantId } = await requireAuth();
  let to = "";
  const r = await wrap(async () => {
    const { quote, revised } = await saveQuote(db, tenantId, id ?? null, input);
    to = `/orcamentos/${quote.id}${revised ? "?rev=1" : ""}`;
  });
  if (!r.ok) return r;
  revalidatePath("/orcamentos");
  redirect(to);
}

const idOnly = z.object({ id: uuid });
const touch = (id: string) => { revalidatePath(`/orcamentos/${id}`); revalidatePath("/orcamentos"); };

/** Called by the WhatsApp link: marks a draft as sent. */
export async function markSentAction(id: string) {
  if (!uuid.safeParse(id).success) return;
  const { db } = await requireAuth();
  await sendQuote(db, id);
  touch(id);
}

export async function approveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ id: uuid, method: z.string().min(2, "Informe como foi aprovado.").max(40) }), fd);
  if ("state" in p) return p.state;
  const { db } = await requireAuth();
  const r = await wrap(async () => { await approveQuote(db, p.data.id, p.data.method); });
  touch(p.data.id);
  return r.ok ? done("Orçamento aprovado.") : r;
}

export async function rejectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(idOnly, fd);
  if ("state" in p) return p.state;
  const { db } = await requireAuth();
  const r = await wrap(async () => { await rejectQuote(db, p.data.id); });
  touch(p.data.id);
  return r.ok ? done("Orçamento recusado.") : r;
}

export async function cancelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(idOnly, fd);
  if ("state" in p) return p.state;
  const { db } = await requireAuth();
  const r = await wrap(async () => { await cancelQuote(db, p.data.id); });
  touch(p.data.id);
  return r.ok ? done("Orçamento cancelado.") : r;
}

export async function convertAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(idOnly, fd);
  if ("state" in p) return p.state;
  const { db, tenantId, user } = await requireAuth();
  let orderId = "";
  const r = await wrap(async () => { orderId = (await convertToOrder(db, tenantId, user.id, p.data.id)).orderId; });
  if (!r.ok) return r;
  touch(p.data.id); revalidatePath("/ordens");
  redirect(`/ordens/${orderId}`);
}
