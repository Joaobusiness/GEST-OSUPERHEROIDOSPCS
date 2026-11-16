// Quote draft kept in localStorage: no request per keystroke, survives module navigation, refresh and a killed tab.
// shortcut: per device and browser, upgrade to a server-side draft if the same quote must continue on another phone.
import type { Line } from "@/server/line-items";

export type QuoteDraftData = {
  customerId: string; services: Line[]; products: Line[]; discount: string; extraFee: string;
  uberOn: boolean; uberCost: string;
  notes: string; validUntil: string; executionDays: string; paymentTerms: string; warranty: string;
};
/** What the URL brought in (calculator result, customer picked on another screen). */
export type Seeded = { customerId?: string; items?: Line[]; uberCost?: string };
type Stored = { v: 1; base: string; seed: string; data: QuoteDraftData };
/** null = storage blocked by the browser: every function becomes a no-op. */
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;

/** Scoped by company and user, so a shared phone never shows another account its draft. */
export const draftKey = (tenantId: string, userId: string, quoteId?: string) => `quote-draft:${tenantId}:${userId}:${quoteId ?? "novo"}`;

const isProduct = (l: Line) => l.kind === "PART";
/** false for a line nobody typed in (the empty service line every new quote starts with). */
export const filled = (l: Line) => l.description.trim() !== "" || Number(l.unitPrice) > 0 || Number(l.unitCost) > 0;

export function saveDraft(store: Store, key: string, base: string, seed: string, data: QuoteDraftData) {
  try { store?.setItem(key, JSON.stringify({ v: 1, base, seed, data } satisfies Stored)); } catch { /* private mode or full storage: the form still works */ }
}

export function clearDraft(store: Store, key: string) {
  try { store?.removeItem(key); } catch { /* nothing to clear */ }
}

/**
 * Returns the draft to restore, or null. `base` is the saved quote updatedAt ("" for a new quote): a draft written
 * against an older version of the quote is stale and is dropped instead of overwriting newer data.
 * `seed` is the query string: the same seed never adds its lines twice (refresh, back button).
 */
export function restoreDraft(store: Store, key: string, base: string, seed: string, seeded: Seeded): { data: QuoteDraftData; seed: string } | null {
  if (!store) return null;
  let d: Stored;
  try {
    d = JSON.parse(store.getItem(key) ?? "null");
    if (!d || d.v !== 1 || !d.data || !Array.isArray(d.data.services) || !Array.isArray(d.data.products)) throw 0;
  } catch { clearDraft(store, key); return null; }
  if (d.base !== base) { clearDraft(store, key); return null; }
  if (!seed || seed === d.seed) return { data: d.data, seed: d.seed };
  const add = seeded.items ?? [];
  return {
    seed,
    data: {
      ...d.data,
      customerId: seeded.customerId || d.data.customerId,
      services: [...d.data.services.filter(filled), ...add.filter((l) => !isProduct(l))],
      products: [...d.data.products.filter(filled), ...add.filter(isProduct)],
      ...(seeded.uberCost && Number(seeded.uberCost) > 0 ? { uberOn: true, uberCost: seeded.uberCost } : {}),
    },
  };
}
