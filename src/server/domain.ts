import type { TenantDb } from "@/lib/db";

export type Tx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];

/** Expected, user-facing failure (pt-BR message). Actions turn it into an ActionState. */
export class DomainError extends Error {}
