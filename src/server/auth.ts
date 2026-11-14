import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { forTenant, prisma } from "@/lib/db";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "shpcs_session";
const DAYS = Number(process.env.SESSION_DAYS ?? 14);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const hashPassword = (p: string) => hash(p); // argon2id by default
export const verifyPassword = (hashed: string, p: string) => verify(hashed, p);

export async function createSession(userId: string, tenantId: string | null) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DAYS * 86_400_000);
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }); // expired rows never pile up
  await prisma.session.create({ data: { id: sha(token), userId, tenantId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha(token) } });
  jar.delete(COOKIE);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: sha(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s;
}

/** Logged-in tenant user. Redirects otherwise. Suspended tenants are sent to /suspenso. */
export async function requireAuth() {
  const s = await getSession();
  if (!s) redirect("/login?sessao=expirada");
  if (!s.tenantId) redirect(s.user.isSuperAdmin ? "/admin" : "/login");
  const [tenant, membership] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: s.tenantId } }),
    prisma.tenantUser.findUnique({ where: { tenantId_userId: { tenantId: s.tenantId, userId: s.userId } } }),
  ]);
  if (!tenant || !membership) redirect("/login");
  if (tenant.status === "SUSPENDED") redirect("/suspenso");
  return { user: s.user, tenant, tenantId: tenant.id, role: membership.role, db: forTenant(tenant.id) };
}

export async function requireSuperAdmin() {
  const s = await getSession();
  if (!s || !s.user.isSuperAdmin) redirect("/login");
  return s.user;
}

export async function audit(tenantId: string | null, userId: string | null, action: string, entity?: string, entityId?: string, meta?: object) {
  await prisma.auditLog.create({ data: { tenantId, userId, action, entity, entityId, meta } });
}

// Login throttle: in-memory, per process. Move to Redis/DB when running more than one instance.
const attempts = new Map<string, { n: number; reset: number }>();
export function throttle(key: string, max = 8, windowMs = 15 * 60_000) {
  const now = Date.now();
  if (attempts.size > 50_000) { // keys are attacker-chosen: keep the map bounded, scan only past the cap
    for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
    // shortcut: still flooded, so drop IP counters first and per-account login counters last; move to Redis with several instances
    for (const k of [...attempts.keys()]) { if (attempts.size <= 40_000) break; if (!k.startsWith("login-acct:")) attempts.delete(k); }
    for (const k of [...attempts.keys()]) { if (attempts.size <= 40_000) break; attempts.delete(k); }
  }
  const a = attempts.get(key);
  if (!a || a.reset < now) { attempts.set(key, { n: 1, reset: now + windowMs }); return true; }
  a.n += 1;
  return a.n <= max;
}
