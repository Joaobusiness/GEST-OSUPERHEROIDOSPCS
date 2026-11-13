"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { done, fail, optional, parse, type ActionState } from "@/lib/action";
import { toE164 } from "@/lib/br";
import { audit, createSession, destroySession, hashPassword, throttle, verifyPassword } from "./auth";
import { bootstrapTenant } from "./tenant";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const email = z.string().email("E-mail inválido.").transform((s) => s.toLowerCase());
const password = z.string().min(8, "Use ao menos 8 caracteres.").max(200);

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({
    name: z.string().min(2, "Informe seu nome."),
    business: z.string().min(2, "Informe o nome da assistência."),
    email, password, phone: optional(z.string()),
  }), fd);
  if ("state" in p) return p.state;
  const { data } = p;
  if (!throttle(`reg:${await ip()}`, 10)) return fail("Muitas tentativas. Aguarde alguns minutos.");
  const phone = data.phone ? toE164(data.phone) : undefined;
  if (data.phone && !phone) return fail("Confira o telefone.", { phone: "Telefone inválido. Use DDD + número." });
  if (await prisma.user.findUnique({ where: { email: data.email } })) return fail("Este e-mail já tem cadastro.", { email: "E-mail já cadastrado." });

  const passwordHash = await hashPassword(data.password);
  const { user, tenant } = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: { name: data.business, email: data.email, phone, whatsapp: phone } });
    const user = await tx.user.create({ data: { email: data.email, name: data.name, passwordHash } });
    await tx.tenantUser.create({ data: { tenantId: tenant.id, userId: user.id, role: "ADMIN" } });
    await bootstrapTenant(tx, tenant.id);
    return { user, tenant };
  });
  await audit(tenant.id, user.id, "tenant.register", "Tenant", tenant.id);
  await createSession(user.id, tenant.id);
  redirect("/");
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ email, password: z.string().min(1, "Informe a senha.") }), fd);
  if ("state" in p) return p.state;
  const { data } = p;
  // two keys: rotating x-forwarded-for cannot bypass the per-account limit
  if (!throttle(`login:${await ip()}:${data.email}`) || !throttle(`login-acct:${data.email}`, 20)) return fail("Muitas tentativas. Aguarde alguns minutos.");
  const user = await prisma.user.findUnique({ where: { email: data.email }, include: { memberships: true } });
  // same message for unknown e-mail and wrong password: no account enumeration
  if (!user || !(await verifyPassword(user.passwordHash, data.password))) return fail("E-mail ou senha incorretos.");
  const tenantId = user.memberships[0]?.tenantId ?? null;
  await createSession(user.id, tenantId);
  await audit(tenantId, user.id, "auth.login");
  redirect(tenantId ? "/" : user.isSuperAdmin ? "/admin" : "/login");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ email }), fd);
  if ("state" in p) return p.state;
  if (!throttle(`forgot:${await ip()}`, 5)) return fail("Muitas tentativas. Aguarde alguns minutos.");
  const user = await prisma.user.findUnique({ where: { email: p.data.email } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordReset.create({ data: { id: sha(token), userId: user.id, expiresAt: new Date(Date.now() + 3_600_000) } });
    // No mail provider yet. The token is a credential, so it is printed only outside production.
    // Wire SMTP/Resend here before going live; in production nothing is delivered until then.
    if (process.env.NODE_ENV !== "production") console.info(`[password-reset] ${process.env.APP_URL}/redefinir-senha?token=${token}`);
    else console.warn("[password-reset] requested, but no mail provider is configured; token not delivered");
  }
  return done("Se o e-mail existir, enviamos o link de redefinição.");
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ token: z.string().min(10), password }), fd);
  if ("state" in p) return p.state;
  const r = await prisma.passwordReset.findUnique({ where: { id: sha(p.data.token) } });
  if (!r || r.usedAt || r.expiresAt < new Date()) return fail("Link inválido ou expirado. Peça um novo.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: r.userId }, data: { passwordHash: await hashPassword(p.data.password) } }),
    prisma.passwordReset.update({ where: { id: r.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: r.userId } }), // revoke every session
  ]);
  redirect("/login");
}
