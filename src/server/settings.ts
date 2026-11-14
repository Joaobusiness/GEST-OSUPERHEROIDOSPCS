import { z } from "zod";
import type { TenantDb } from "@/lib/db";
import { fail, done, moneyStr, optional, pctStr, type ActionState } from "@/lib/action";
import { isValidDocument, toE164 } from "@/lib/br";
import { hashPassword } from "@/server/auth";

export type Ctx = { db: TenantDb; tenantId: string; role: "ADMIN" | "MEMBER"; userId: string };

/** Expected failure with a message that is safe to show the user. */
export class UserError extends Error {}
export class ForbiddenError extends UserError {
  constructor() { super("Apenas administradores podem alterar as configurações."); }
}

const assertAdmin = (c: Ctx) => { if (c.role !== "ADMIN") throw new ForbiddenError(); };

/** Runs a service call and turns UserError into an ActionState. */
export async function guard(fn: () => Promise<string>): Promise<ActionState> {
  try { return done(await fn()); } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    throw e;
  }
}

export const TIMEZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Campo_Grande", "America/Belem",
  "America/Fortaleza", "America/Recife", "America/Bahia", "America/Porto_Velho", "America/Boa_Vista",
  "America/Rio_Branco", "America/Noronha",
];

const phoneField = (msg: string) => optional(z.string().refine((s) => toE164(s) !== null, msg));

export const businessSchema = z.object({
  name: z.string().min(2, "Informe o nome da assistência."),
  document: optional(z.string().refine(isValidDocument, "CPF ou CNPJ inválido.")),
  email: z.string().email("E-mail inválido.").transform((s) => s.toLowerCase()),
  phone: phoneField("Telefone inválido. Use DDD + número."),
  whatsapp: phoneField("WhatsApp inválido. Use DDD + número."),
  street: optional(z.string()), number: optional(z.string()), district: optional(z.string()),
  city: optional(z.string()), state: optional(z.string().max(2, "Use a sigla (ex.: MT).")), zip: optional(z.string()),
  timezone: z.enum(TIMEZONES as [string, ...string[]], "Fuso inválido."),
});

export const pricingSchema = z.object({
  partMarginPct: pctStr, defaultUberCost: moneyStr,
  // Fora do MVP: o formulário não envia mais. Seguem opcionais para não apagar o que já está salvo.
  laborMarginPct: pctStr.optional(), minMarginPct: pctStr.optional(), cardFeePct: pctStr.optional(), taxPct: pctStr.optional(), otherCostsFixed: moneyStr.optional(),
  defaultUberMode: z.enum(["INCLUDED", "SEPARATE", "ABSORBED"]),
  uberMarkup: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  inactiveDays: z.coerce.number().int("Use um número inteiro.").min(1, "Mínimo 1 dia.").max(3650),
  warrantyAlertDays: z.coerce.number().int("Use um número inteiro.").min(1, "Mínimo 1 dia.").max(365),
});

export async function updateBusiness(c: Ctx, d: z.infer<typeof businessSchema>) {
  assertAdmin(c);
  const address = { street: d.street, number: d.number, district: d.district, city: d.city, state: d.state?.toUpperCase(), zip: d.zip };
  await c.db.tenant.update({
    where: { id: c.tenantId },
    data: {
      name: d.name, document: d.document ?? null, email: d.email, timezone: d.timezone,
      phone: d.phone ? toE164(d.phone) : null, whatsapp: d.whatsapp ? toE164(d.whatsapp) : null, address,
    },
  });
}

// Only future quotes/simulations read these; approved quote snapshots are never rewritten.
export async function updatePricingSettings(c: Ctx, d: z.infer<typeof pricingSchema>) {
  assertAdmin(c);
  await c.db.pricingSettings.update({ where: { tenantId: c.tenantId }, data: d });
}

export const memberSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("E-mail inválido.").transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Use ao menos 8 caracteres.").max(200),
});

export async function listTeam(c: Ctx) {
  const rows = await c.db.tenantUser.findMany({ where: { tenantId: c.tenantId }, include: { user: true }, orderBy: { user: { name: "asc" } } });
  return rows.map((r) => ({ userId: r.userId, name: r.user.name, email: r.user.email, role: r.role }));
}

export async function addMember(c: Ctx, d: z.infer<typeof memberSchema>) {
  assertAdmin(c);
  if (await c.db.user.findUnique({ where: { email: d.email } })) throw new UserError("Este e-mail já tem cadastro.");
  const passwordHash = await hashPassword(d.password);
  const user = await c.db.user.create({
    data: { email: d.email, name: d.name, passwordHash, memberships: { create: { tenantId: c.tenantId, role: "MEMBER" } } },
  });
  return user.id;
}

export async function removeMember(c: Ctx, userId: string) {
  assertAdmin(c);
  const target = await c.db.tenantUser.findUnique({ where: { tenantId_userId: { tenantId: c.tenantId, userId } }, include: { user: true } });
  if (!target) throw new UserError("Membro não encontrado.");
  if (target.role === "ADMIN" && (await c.db.tenantUser.count({ where: { tenantId: c.tenantId, role: "ADMIN" } })) <= 1) {
    throw new UserError("Mantenha ao menos um administrador na equipe.");
  }
  await c.db.tenantUser.delete({ where: { tenantId_userId: { tenantId: c.tenantId, userId } } });
  await c.db.session.deleteMany({ where: { userId, tenantId: c.tenantId } });
  const other = await c.db.tenantUser.count({ where: { userId } });
  if (other === 0 && !target.user.isSuperAdmin) await c.db.user.delete({ where: { id: userId } });
}

const LOGO_PREFIX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const logoSchema = z.object({ logo: z.string().max(400_000, "Imagem grande demais.").refine((s) => s === "" || LOGO_PREFIX.test(s), "Use uma imagem PNG, JPG ou WebP.") });

/** Empty string removes the logo. */
export async function updateLogo(c: Ctx, logo: string) {
  assertAdmin(c);
  await c.db.tenant.update({ where: { id: c.tenantId }, data: { logoUrl: logo || null } });
}
