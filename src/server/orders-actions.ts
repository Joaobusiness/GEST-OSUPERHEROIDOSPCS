"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { done, fail, optional, parse, uuid, type ActionState } from "@/lib/action";
import { toE164 } from "@/lib/br";
import { requireAuth } from "./auth";
import { changeStatus, createOrder, DomainError, reopenOrder, saveOrderItems, updateOrderDetails } from "./orders";
import { createQuoteFromOrder } from "./quotes";
import { itemsField } from "./line-items";

async function wrap(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try { return (await fn()) ?? done(); } catch (e) { if (e instanceof DomainError) return fail(e.message); throw e; }
}

// <input type=date> gives yyyy-mm-dd; noon UTC keeps the same calendar day in Brazil
const day = optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").transform((s) => new Date(`${s}T12:00:00Z`)));
const days = z.string().regex(/^\d{1,4}$/, "Informe dias (0 ou mais).").transform(Number);

export async function createOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({
    customerId: optional(uuid), newName: optional(z.string().min(2, "Informe o nome.").max(150)), newPhone: optional(z.string()),
    deviceId: optional(uuid), newCategory: optional(z.string().min(1).max(60)), newBrand: optional(z.string().max(60)), newModel: optional(z.string().max(60)),
    description: z.string().min(3, "Descreva o problema.").max(2000), estimatedDeliveryAt: day,
  }), fd);
  if ("state" in p) return p.state;
  const d = p.data;
  const { db, tenantId, user } = await requireAuth();
  let id: string;
  const r = await wrap(async () => {
    let customerId = d.customerId;
    if (!customerId) {
      if (!d.newName) return fail("Escolha um cliente ou informe o nome do novo.", { customerId: "Obrigatório." });
      const phone = d.newPhone ? toE164(d.newPhone) : null;
      if (!phone) return fail("Confira o telefone.", { newPhone: "Informe DDD + número." });
      customerId = (await db.customer.create({ data: { tenantId, name: d.newName, phone } })).id;
    }
    let deviceId = d.deviceId;
    if (!deviceId && d.newCategory) deviceId = (await db.customerDevice.create({ data: { tenantId, customerId, category: d.newCategory, brand: d.newBrand ?? null, model: d.newModel ?? null } })).id;
    id = (await createOrder(db, tenantId, user.id, { customerId, deviceId, description: d.description, estimatedDeliveryAt: d.estimatedDeliveryAt })).id;
  });
  if (!r.ok) return r;
  revalidatePath("/ordens");
  redirect(`/ordens/${id!}`);
}

export async function saveDetailsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({
    id: uuid, description: z.string().min(3, "Descreva o problema.").max(2000),
    diagnosis: optional(z.string().max(4000)), notes: optional(z.string().max(4000)), warrantyDays: days, estimatedDeliveryAt: day,
  }), fd);
  if ("state" in p) return p.state;
  const { id, ...rest } = p.data;
  const { db } = await requireAuth();
  const r = await wrap(async () => { await updateOrderDetails(db, id, rest); });
  revalidatePath(`/ordens/${id}`);
  return r;
}

export async function saveItemsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ id: uuid, items: itemsField }), fd);
  if ("state" in p) return p.state;
  const { db, tenantId } = await requireAuth();
  const r = await wrap(async () => { await saveOrderItems(db, tenantId, p.data.id, p.data.items); });
  revalidatePath(`/ordens/${p.data.id}`);
  return r.ok ? done("Itens salvos.") : r;
}

const STATUSES = ["OPEN", "DIAGNOSIS", "WAITING_APPROVAL", "WAITING_PARTS", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELED"] as const;

export async function changeStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ id: uuid, status: z.enum(STATUSES, "Escolha o status."), note: optional(z.string().max(500)) }), fd);
  if ("state" in p) return p.state;
  const { db, tenantId, user } = await requireAuth();
  const r = await wrap(async () => { await changeStatus(db, tenantId, user.id, p.data.id, p.data.status, p.data.note); });
  revalidatePath(`/ordens/${p.data.id}`); revalidatePath("/ordens");
  return r.ok ? done("Status atualizado.") : r;
}

export async function reopenAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ id: uuid, note: z.string().min(3, "Explique o motivo.").max(500) }), fd);
  if ("state" in p) return p.state;
  const { db, tenantId, user } = await requireAuth();
  const r = await wrap(async () => { await reopenOrder(db, tenantId, user.id, p.data.id, p.data.note); });
  revalidatePath(`/ordens/${p.data.id}`); revalidatePath("/ordens");
  return r.ok ? done("OS reaberta.") : r;
}

/** Button form: creates a draft quote from the order items and opens it. */
export async function orderToQuoteAction(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!uuid.safeParse(id).success) return;
  const { db, tenantId } = await requireAuth();
  const q = await createQuoteFromOrder(db, tenantId, id);
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${q.id}`);
}
