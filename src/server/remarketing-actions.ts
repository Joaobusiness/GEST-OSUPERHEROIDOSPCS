"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { done, fail, optional, parse, uuid, type ActionState } from "@/lib/action";
import { requireAuth } from "@/server/auth";
import { CrmError } from "@/server/crm";
import { SEGMENTS, createCampaign, deleteTemplate, isSegment, logContact, saveTemplate } from "@/server/remarketing";

async function guard(fn: () => Promise<ActionState>): Promise<ActionState> {
  try { return await fn(); } catch (e) {
    if (e instanceof CrmError) return fail(e.message);
    throw e;
  }
}

const templateSchema = z.object({
  id: optional(uuid),
  name: z.string().min(2, "Informe o nome.").max(80),
  kind: z.enum(["OPERATIONAL", "MARKETING"], "Escolha o tipo."),
  body: z.string().min(5, "Escreva a mensagem.").max(1000),
});

export async function saveTemplateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(templateSchema, fd);
  if ("state" in p) return p.state;
  const { id, ...d } = p.data;
  return guard(async () => {
    await saveTemplate(db, id, d);
    revalidatePath("/remarketing/modelos");
    return done("Modelo salvo.");
  });
}

export async function deleteTemplateAction(fd: FormData) {
  const { db } = await requireAuth();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return;
  await deleteTemplate(db, id.data);
  revalidatePath("/remarketing/modelos");
}

const contactSchema = z.object({
  customerId: uuid,
  kind: z.enum(["OPERATIONAL", "MARKETING"]),
  result: z.string().min(1, "Escolha o resultado.").max(60),
  note: optional(z.string().max(500)),
  campaignContactId: optional(uuid),
});

export async function logContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db, user } = await requireAuth();
  const p = parse(contactSchema, fd);
  if ("state" in p) return p.state;
  return guard(async () => {
    await logContact(db, user.id, p.data);
    revalidatePath("/remarketing", "layout");
    revalidatePath(`/clientes/${p.data.customerId}`);
    return done("Contato registrado.");
  });
}

const campaignSchema = z.object({
  name: z.string().min(2, "Informe o nome.").max(80),
  seg: z.string().refine(isSegment, "Segmento inválido."),
  days: optional(z.coerce.number().int().min(1).max(3650)),
  templateId: uuid,
});

export async function createCampaignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAuth();
  const p = parse(campaignSchema, fd);
  if ("state" in p) return p.state;
  const customerIds = fd.getAll("customerId").map(String).filter((v) => uuid.safeParse(v).success);
  if (!customerIds.length) return fail("Selecione ao menos um cliente.");
  let id = "";
  const r = await guard(async () => {
    const seg = p.data.seg as keyof typeof SEGMENTS;
    id = (await createCampaign(db, { name: p.data.name, seg, days: p.data.days, templateId: p.data.templateId, customerIds })).id;
    revalidatePath("/remarketing/campanhas");
    return done("Campanha criada.");
  });
  if (id) redirect(`/remarketing/campanhas/${id}`);
  return r;
}
