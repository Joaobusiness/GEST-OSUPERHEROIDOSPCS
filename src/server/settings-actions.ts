"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parse, uuid, type ActionState } from "@/lib/action";
import { audit, requireAuth } from "./auth";
import {
  addMember, businessSchema, guard, memberSchema, logoSchema, pricingSchema, removeMember, updateBusiness, updateLogo, updatePricingSettings,
} from "./settings";

async function ctx() {
  const a = await requireAuth();
  return { db: a.db, tenantId: a.tenantId, role: a.role, userId: a.user.id };
}

export async function updateBusinessAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(businessSchema, fd);
  if ("state" in p) return p.state;
  const c = await ctx();
  return guard(async () => {
    await updateBusiness(c, p.data);
    await audit(c.tenantId, c.userId, "settings.business", "Tenant", c.tenantId);
    revalidatePath("/configuracoes");
    return "Dados da empresa salvos.";
  });
}

export async function updatePricingSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(pricingSchema, fd);
  if ("state" in p) return p.state;
  const c = await ctx();
  return guard(async () => {
    await updatePricingSettings(c, p.data);
    await audit(c.tenantId, c.userId, "settings.pricing", "PricingSettings", c.tenantId, p.data);
    revalidatePath("/configuracoes");
    revalidatePath("/precificacao");
    return "Salvo. Vale só para os próximos orçamentos e contas.";
  });
}

export async function addMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(memberSchema, fd);
  if ("state" in p) return p.state;
  const c = await ctx();
  return guard(async () => {
    const id = await addMember(c, p.data);
    await audit(c.tenantId, c.userId, "team.add", "User", id, { email: p.data.email });
    revalidatePath("/configuracoes");
    return "Pessoa adicionada. Passe a senha temporária para ela.";
  });
}

export async function removeMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ userId: uuid }), fd);
  if ("state" in p) return p.state;
  const c = await ctx();
  return guard(async () => {
    await removeMember(c, p.data.userId);
    await audit(c.tenantId, c.userId, "team.remove", "User", p.data.userId);
    revalidatePath("/configuracoes");
    return "Membro removido.";
  });
}

export async function updateLogoAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(logoSchema, fd);
  if ("state" in p) return p.state;
  const c = await ctx();
  return guard(async () => {
    await updateLogo(c, p.data.logo);
    await audit(c.tenantId, c.userId, "settings.logo", "Tenant", c.tenantId);
    revalidatePath("/configuracoes");
    revalidatePath("/orcamentos");
    return p.data.logo ? "Logo salvo." : "Logo removido.";
  });
}
