# IAM / Authentication / Tenant isolation review

Static read-only review. No code run, no fixes applied. Paths relative to the project root.
Counts: P0 0 / P1 3 / P2 5 / P3 3.

## Findings (by severity)

### I-01 [P1] /admin pages have no guard of their own; only the layout checks
- Where: `src/app/admin/layout.tsx:12` (only `requireSuperAdmin()` call for pages). Unguarded data reads: `src/app/admin/page.tsx:8` (`platformStats()`, `listTenants()`), `src/app/admin/planos/page.tsx:27` (`prisma.subscriptionPlan`), `src/app/admin/empresas/[id]/page.tsx:17`. `src/server/admin.ts` functions have no guard either. No `proxy.ts`/`middleware.ts` exists.
- Why: in the App Router, layouts and pages render in parallel and layouts are not re-run on soft navigation. Next docs say auth must be checked next to the data read. The admin Server Actions are fine (each calls `requireSuperAdmin()` in `admin-actions.ts:13,25,37,49`).
- Exploit: unauthenticated or tenant-user request for an admin segment (RSC fetch of the page segment, or soft navigation after the super admin session was revoked) renders the page and returns all tenants' name, e-mail, status, counts, plan and MRR. Not dynamically verified; exploitability depends on Next partial rendering behaviour.
- Fix: add `await requireSuperAdmin()` as first line of each admin page and inside `listTenants`, `platformStats`, plan reads (or a single `adminOnly()` DAL wrapper).

### I-02 [P1] Brute-force throttle is bypassable and in-memory
- Where: `src/server/auth-actions.ts:17-20` (key uses first `x-forwarded-for` value, client-controlled unless the proxy overwrites it), uses at `:30`, `:52`, `:70`; store `src/server/auth.ts:67-75`. `resetPasswordAction` (`:81`) has no throttle.
- Exploit: attacker sends a different `X-Forwarded-For` per request; key `login:<ip>:<email>` is new every time, so unlimited password guesses against any account, including the Super Admin e-mail. Random header/e-mail values also grow the `Map` without bound (memory DoS). With no header at all every client shares `"local"`.
- Fix: derive IP from the platform's trusted header (or the last hop of a proxy you control), also throttle per e-mail alone (DB or Redis, not process memory), purge old entries, throttle reset by IP.

### I-03 [P1] Seed ships default Super Admin and demo credentials
- Where: `prisma/seed.ts:9` (`ChangeMe!12345` fallback), `:19`, `:26` (`demo@superheroi.local` / `Demo!12345`, ADMIN of a tenant).
- Exploit: if `db:seed` runs against a production database without `SEED_ADMIN_PASSWORD`, anyone who knows the repo logs into `/admin` with `admin@superheroi.local` / `ChangeMe!12345` and controls every tenant's status and plans.
- Fix: throw when `SEED_ADMIN_PASSWORD` is unset or `NODE_ENV=production`; skip the demo tenant in production.

### I-04 [P2] Password reset link is written to the server log; no mail delivery
- Where: `src/server/auth-actions.ts:76`.
- Exploit: anyone with log access (hosting dashboard, log drain) requests a reset for any e-mail, including the Super Admin, reads the link from the log and takes over the account. For real users, recovery does not work at all (no mailer).
- Fix: send mail via provider; never log the token; in dev only, guard with `NODE_ENV !== "production"`.

### I-05 [P2] `forTenant` TENANT_MODELS is incomplete; no DB-level isolation
- Where: `src/lib/db.ts:13-18`. Schema models with `tenantId` missing from the set: `TenantUser` (`schema.prisma:107`), `Session` (`:119`), `AuditLog` (`:415`), `Subscription` (`:439`). All 16 other tenant models (incl. `QuoteItem`, `ServiceOrderItem`, `TransactionPayment`, `CampaignContact`, `PricingSettings`) are covered.
- Current exposure: only `src/server/settings.ts:78,94,96,99,100,101` use these through `c.db` and each adds `tenantId` by hand (correct today). Any future query on them is unscoped. `prisma/` has no RLS/POLICY and FKs are single-column (`customerId -> Customer.id`), so the database cannot reject a cross-tenant reference.
- Fix: add the four models to the set (or stop exposing them on `TenantDb`), and consider composite FKs `(tenantId, id)` or RLS. Handoff to `db` agent: every authorization claim here rests on app code, not on a DB policy.

### I-06 [P2] Admin-set member passwords: no change-password feature, account squatting, cross-tenant e-mail oracle
- Where: `src/server/settings.ts:82-90`, `src/app/(app)/configuracoes/page.tsx:122`, `src/server/settings-actions.ts` (no password change action).
- Exploit 1: the tenant admin knows each member's password forever (UI tells them to "combine a troca", but no screen exists; reset needs mail, see I-04), so they can impersonate the member. Exploit 2: admin pre-creates an account for a person's e-mail; when that person registers they get "e-mail já cadastrado", and if they log in they land in the admin's tenant (`auth-actions.ts:56` takes `memberships[0]` with no ordering). Exploit 3: `settings.ts:84` tells any admin whether an e-mail exists on the platform.
- Fix: add change-password; send an invite link (token, set own password) instead of a chosen password; return a generic message on duplicate.

### I-07 [P2] User enumeration on register and login timing
- Where: `src/server/auth-actions.ts:33` (explicit "E-mail já cadastrado"), `:53-55` (unknown e-mail returns before argon2 verify; the comment promises no enumeration, timing differs by tens of ms).
- Exploit: scripted probing (also unthrottled via I-02) lists which e-mails have accounts.
- Fix: verify against a dummy hash when user is missing; on register show a generic "check your e-mail" flow.

### I-08 [P2] No role split below settings/team: MEMBER can run destructive finance and data actions
- Where: `src/server/finance-actions.ts:46-58` (register payment, cancel and reverse transaction), `:72-92` (rename/delete categories), `src/server/crm-actions.ts:53` (delete customer), `src/server/remarketing-actions.ts:37` (delete template), `src/app/(app)/relatorios/csv/route.ts:5` (export 5000 finance rows). Only `settings.ts:15` enforces ADMIN, and it is correct (server-side, role read from DB each request, `auth.ts:54`).
- Exploit: a MEMBER (or anyone with a member's password, see I-06) cancels receivables, writes reversal payments and exports the full ledger.
- Fix: decide the policy; if finance is admin-only, call `assertAdmin` in those services.

### I-09 [P3] Device created for an unverified `customerId` before the ownership check
- Where: `src/server/orders-actions.ts:40` (`db.customerDevice.create` with form `customerId`); the tenant check is only later at `src/server/orders.ts:26`.
- Exploit: tenant A posts `customerId` = UUID of a tenant B customer plus `newCategory`. Row is stamped with A's tenantId but points to B's customer; the next step fails with "Cliente não encontrado" and leaves the orphan. B never sees it (every device read filters by tenantId, e.g. `crm.ts:124`). Residual: FK error versus success is an existence oracle for foreign customer UUIDs (unguessable).
- Fix: `await getCustomer(db, customerId)` before line 40, or create the device inside `createOrder`.

### I-10 [P3] Session and reset-token hygiene
- Where: `src/server/auth.ts:39` (expired sessions are never deleted), `:28-33` (no "log out everywhere", no rotation of an existing cookie at login), `src/server/auth-actions.ts:74` (new reset does not invalidate older tokens), `:84-90` (read then update, not atomic: two parallel requests can both use a token), `redefinir-senha/page.tsx:8` (token in query string, Referrer leak risk).
- Fix: `updateMany where usedAt null` and check count; delete other tokens of the user; cron purge of sessions; `Referrer-Policy: no-referrer`.

### I-11 [P3] `forTenant` does not strip `data.tenantId` on update
- Where: `src/lib/db.ts:37-49` only forces `where`. Callers passing user-shaped objects to `update`/`updateMany` (for example `settings.ts:68`, `crm.ts:107`) are safe today because zod strips unknown keys.
- Exploit: a future handler that spreads form data into `update.data` could move a row to another tenant.
- Fix: `delete a.data.tenantId` for update/updateMany/upsert.update.

## Scenario answers (evidence or NOT VERIFIED)

| Scenario | Result |
|---|---|
| BOLA/IDOR on customerId, deviceId, serviceOrderId, quoteId, transactionId, templateId, campaignId, categoryId | PASS. Every id goes through `where` with forced `tenantId` (`db.ts:38`) or an explicit `findFirst` ownership check: `orders.ts:26-28`, `quotes.ts:35-37`, `finance.ts:159-168,190,220,242`, `crm.ts:44,103,105`, `remarketing.ts:101,134,154`. Exception: I-09. |
| Nested includes leaking other tenants | PASS. Includes follow FKs of tenant-filtered rows (`orders/[id]/page.tsx:22`, `quotes.ts:72`, `crm.ts:59`); child writes always stamp tenantId and verify the parent. |
| Direct `prisma` outside auth/admin | PASS. Only `auth.ts`, `auth-actions.ts`, `admin.ts`, `tenant.ts`, admin pages `planos`/`empresas/[id]` (those are subject to I-01). Raw SQL only `finance.ts:204`, after ownership check. |
| Route handler `relatorios/csv` | PASS for auth (`route.ts:5` `requireAuth`, tenant `db`); role: see I-08. |
| Vertical escalation, client-controlled role | PASS. Role never read from the client; `addMember` hardcodes MEMBER (`settings.ts:87`); no role-change feature. |
| Mass assignment | PASS. zod objects strip unknown keys; no spread of raw FormData. |
| Super Admin guard on actions | PASS (`admin-actions.ts`). Pages: FAIL, I-01. |
| Suspended tenant | PASS. `auth.ts:53` on every request via `requireAuth` plus session purge `admin.ts:54`. Not enforced: expired or PAST_DUE subscriptions (stated by design). |
| Session fixation | PASS. Server-generated 32-byte token, new on each login (`auth.ts:16`), SHA-256 stored, httpOnly, sameSite lax, secure in prod. |
| Session not revoked after logout / password reset / member removal | PASS. `auth.ts:31`, `auth-actions.ts:89`, `settings.ts:100`. No password-change or role-change feature exists. |
| Token replay | Partial: reset tokens single-use but racy (I-10). |
| User enumeration | FAIL, I-07 (and I-06). |
| Recovery abuse | FAIL, I-04, I-10. |
| Account linking / invite takeover | FAIL, I-06. |
| Tenant boundary | App layer PASS, DB layer none (I-05). |
| Interactive `$transaction` on the extended client inherits tenant scoping | NOT VERIFIED at runtime (Prisma behaviour assumed; tests in `src/server/*.test.ts` not run). |

## File coverage

Read completely: `docs/ARCHITECTURE.md`, `prisma/schema.prisma`, `prisma/seed.ts` (1-30 only, partial), `src/lib/db.ts`, `src/lib/action.ts`, `src/server/{auth,auth-actions,tenant,orders,orders-actions,quotes,quotes-actions,line-items,finance,finance-actions,crm,crm-actions,settings,settings-actions,remarketing,remarketing-actions,pricing-actions,dashboard,admin,admin-actions}.ts`, `src/app/admin/{layout,page}.tsx`, `src/app/admin/{planos,empresas/[id]}/page.tsx`, `src/app/(app)/{layout,mais/page,configuracoes/page,orcamentos/form-data,ordens/nova/page}`, `relatorios/csv/route.ts`, `redefinir-senha/page.tsx`.
Partial (first 40-60 lines, auth call and query only): `ordens/[id]`, `orcamentos/[id]`, `orcamentos/[id]/imprimir`, `orcamentos/[id]/editar`, `financeiro/[id]`, `clientes/[id]`, `remarketing/campanhas/[id]`, `remarketing/mensagem`.
Not read (grep confirmed `requireAuth` call present): remaining `(app)` list/new pages, client components, `src/components/*`, tests, `src/generated/*`. Login/register/forgot pages and `suspenso`, `privacidade`, `termos` not read.
