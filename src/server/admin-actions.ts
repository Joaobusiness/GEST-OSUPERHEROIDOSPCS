"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parse, uuid, type ActionState } from "@/lib/action";
import { planSchema, savePlan, setPlanActive, setSubscription, setTenantStatus, subscriptionSchema } from "./admin";
import { audit, requireSuperAdmin } from "./auth";
import { guard } from "./settings";

export async function setTenantStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ tenantId: uuid, status: z.enum(["ACTIVE", "SUSPENDED"]) }), fd);
  if ("state" in p) return p.state;
  const u = await requireSuperAdmin();
  return guard(async () => {
    await setTenantStatus(p.data.tenantId, p.data.status);
    await audit(p.data.tenantId, u.id, p.data.status === "SUSPENDED" ? "admin.tenant.suspend" : "admin.tenant.reactivate", "Tenant", p.data.tenantId);
    revalidatePath("/admin", "layout");
    return p.data.status === "SUSPENDED" ? "Empresa suspensa." : "Empresa reativada.";
  });
}

export async function setSubscriptionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(subscriptionSchema, fd);
  if ("state" in p) return p.state;
  const u = await requireSuperAdmin();
  return guard(async () => {
    await setSubscription(p.data);
    await audit(p.data.tenantId, u.id, "admin.subscription.set", "Subscription", p.data.tenantId, p.data);
    revalidatePath("/admin", "layout");
    return "Assinatura atualizada.";
  });
}

export async function savePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(planSchema, fd);
  if ("state" in p) return p.state;
  const u = await requireSuperAdmin();
  return guard(async () => {
    const id = await savePlan(p.data);
    await audit(null, u.id, p.data.id ? "admin.plan.update" : "admin.plan.create", "SubscriptionPlan", id, p.data);
    revalidatePath("/admin/planos");
    return "Plano salvo.";
  });
}

export async function setPlanActiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ planId: uuid, active: z.enum(["true", "false"]) }), fd);
  if ("state" in p) return p.state;
  const u = await requireSuperAdmin();
  return guard(async () => {
    await setPlanActive(p.data.planId, p.data.active === "true");
    await audit(null, u.id, "admin.plan.active", "SubscriptionPlan", p.data.planId, { active: p.data.active });
    revalidatePath("/admin/planos");
    return p.data.active === "true" ? "Plano ativado." : "Plano desativado.";
  });
}
