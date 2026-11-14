"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { done, fail, moneyStr, optional, parse, uuid, ymd, type ActionState } from "@/lib/action";
import { requireAuth } from "./auth";
import { cancelTransaction, createTransaction, FinanceError, registerPayment } from "./finance";

const day = ymd("Informe a data.");

const refresh = () => {
  revalidatePath("/financeiro");
  revalidatePath("/relatorios");
  revalidatePath("/");
};

/** Runs a finance call and turns FinanceError into a form message. */
async function guard(fn: () => Promise<unknown>, ok: string): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof FinanceError) return fail(e.message);
    throw e;
  }
  refresh();
  return done(ok);
}

export async function createTransactionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().min(2, "Descreva o lançamento.").max(200),
    categoryId: uuid,
    amount: moneyStr,
    dueDate: day,
    customerId: optional(uuid),
    paymentMethod: optional(z.string().max(40)),
  }), fd);
  if ("state" in p) return p.state;
  const { dueDate, ...rest } = p.data;
  return guard(() => createTransaction(db, { ...rest, dueDate: new Date(`${dueDate}T00:00:00Z`) }), "Lançamento criado.");
}

export async function registerPaymentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(z.object({ id: uuid, amount: moneyStr, method: optional(z.string().max(40)) }), fd);
  if ("state" in p) return p.state;
  return guard(() => registerPayment(db, p.data.id, { amount: p.data.amount, method: p.data.method }), "Pagamento registrado.");
}

export async function cancelTransactionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, role } = await requireAuth();
  if (role !== "ADMIN") return fail("Só o administrador pode cancelar lançamentos.");
  const p = parse(z.object({ id: uuid }), fd);
  if ("state" in p) return p.state;
  return guard(() => cancelTransaction(db, p.data.id), "Lançamento cancelado. O histórico foi mantido.");
}

const catName = z.string().min(2, "Informe o nome.").max(60);

export async function createCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(z.object({ name: catName, type: z.enum(["INCOME", "EXPENSE"]) }), fd);
  if ("state" in p) return p.state;
  if (await db.financialCategory.findFirst({ where: p.data })) return fail("Já existe uma categoria com este nome.", { name: "Nome já usado." });
  await db.financialCategory.create({ data: p.data as never });
  refresh();
  return done("Categoria criada.");
}

export async function renameCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(z.object({ id: uuid, name: catName }), fd);
  if ("state" in p) return p.state;
  const cat = await db.financialCategory.findFirst({ where: { id: p.data.id } });
  if (!cat) return fail("Categoria não encontrada.");
  if (await db.financialCategory.findFirst({ where: { name: p.data.name, type: cat.type, NOT: { id: cat.id } } })) return fail("Já existe uma categoria com este nome.", { name: "Nome já usado." });
  await db.financialCategory.update({ where: { id: cat.id }, data: { name: p.data.name } });
  refresh();
  return done("Categoria renomeada.");
}

export async function deleteCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(z.object({ id: uuid }), fd);
  if ("state" in p) return p.state;
  if (await db.financialTransaction.count({ where: { categoryId: p.data.id } })) return fail("Esta categoria tem lançamentos. Renomeie em vez de excluir.");
  await db.financialCategory.deleteMany({ where: { id: p.data.id } });
  refresh();
  return done("Categoria excluída.");
}
