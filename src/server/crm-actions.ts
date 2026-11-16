"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { done, fail, moneyStr, optional, parse, uuid, ymd, type ActionState } from "@/lib/action";
import { isValidDocument, onlyDigits, toE164 } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import {
  CrmError, DEVICE_CATEGORIES, createCustomer, deleteCustomer, deleteDevice, saveDevice, setDebt, updateCustomer,
} from "@/server/crm";

const phone = z.string().refine((v) => toE164(v) !== null, "Telefone inválido. Use DDD e número.").transform((v) => toE164(v)!);
const checkbox = z.preprocess((v) => v === "on", z.boolean());

const customerSchema = z.object({
  id: optional(uuid),
  name: z.string().min(2, "Informe o nome.").max(150),
  phone,
  whatsapp: optional(phone),
  document: optional(z.string().refine(isValidDocument, "CPF ou CNPJ inválido.").transform(onlyDigits)),
  email: optional(z.string().email("E-mail inválido.").max(150)),
  address: optional(z.string().max(300)),
  notes: optional(z.string().max(2000)),
  marketingConsent: checkbox,
  marketingOptOut: checkbox,
});

/** Runs a service call, turning expected CrmError into form feedback. */
async function guard(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try { return (await fn()) ?? done(); } catch (e) {
    if (e instanceof CrmError) return fail(e.message);
    throw e;
  }
}

const debtSchema = z.object({ id: uuid, owes: checkbox, amount: optional(moneyStr), dueDate: optional(ymd("Data inválida.")) });

export async function saveDebtAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(debtSchema, fd);
  if ("state" in p) return p.state;
  const { id, owes, amount, dueDate } = p.data;
  if (owes && (!amount || Number(amount) <= 0)) return fail("Informe o valor devido.", { amount: "Informe o valor devido." });
  if (owes && !dueDate) return fail("Informe a data combinada.", { dueDate: "Informe a data combinada." });
  return guard(async () => {
    await setDebt(db, id, owes ? { owes: true, amount: amount!, dueDate: new Date(`${dueDate}T00:00:00Z`) } : { owes: false });
    revalidatePath("/"); revalidatePath(`/clientes/${id}`);
    return done(owes ? "Dívida anotada." : "Cliente não está mais devendo.");
  });
}

export async function saveCustomerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(customerSchema, fd);
  if ("state" in p) return p.state;
  const { id, ...input } = p.data;
  let newId: string | undefined;
  const r = await guard(async () => {
    if (id) await updateCustomer(db, id, input);
    else newId = (await createCustomer(db, input)).id;
    revalidatePath("/clientes");
    return done("Cliente salvo.");
  });
  if (newId) redirect(`/clientes/${newId}`);
  return r;
}

export async function deleteCustomerAction(fd: FormData) {
  const { db, role } = await requireAuth();
  if (role !== "ADMIN") return; // members cannot delete customers
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  try { await deleteCustomer(db, id.data); } catch (e) { if (!(e instanceof CrmError)) throw e; }
  revalidatePath("/clientes");
  redirect("/clientes");
}

const deviceSchema = z.object({
  customerId: uuid,
  id: optional(uuid),
  category: z.enum(DEVICE_CATEGORIES, "Escolha a categoria."),
  brand: optional(z.string().max(80)),
  model: optional(z.string().max(80)),
  serialNumber: optional(z.string().max(80)),
  accessories: optional(z.string().max(300)),
  conditionNotes: optional(z.string().max(500)),
});

export async function saveDeviceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(deviceSchema, fd);
  if ("state" in p) return p.state;
  const { customerId, id, ...input } = p.data;
  return guard(async () => {
    await saveDevice(db, customerId, id, input);
    revalidatePath(`/clientes/${customerId}`);
    return done("Equipamento salvo.");
  });
}

export async function deleteDeviceAction(fd: FormData) {
  const { db } = await requireAuth();
  const ids = z.object({ customerId: uuid, id: uuid }).safeParse({ customerId: fd.get("customerId"), id: fd.get("id") });
  if (!ids.success) return;
  try { await deleteDevice(db, ids.data.customerId, ids.data.id); } catch (e) { if (!(e instanceof CrmError)) throw e; }
  revalidatePath(`/clientes/${ids.data.customerId}`);
}
