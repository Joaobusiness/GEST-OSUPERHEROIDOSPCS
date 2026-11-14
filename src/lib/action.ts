import { z } from "zod";

/** Shape every server action returns to ActionForm. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const fail = (error: string, fieldErrors?: Record<string, string>): ActionState => ({ error, fieldErrors });
export const done = (message = "Salvo."): ActionState => ({ ok: true, message });

/** Parses FormData with zod. Returns data or an ActionState with per-field messages (pt-BR). */
export function parse<T extends z.ZodType>(schema: T, fd: FormData): { data: z.infer<T> } | { state: ActionState } {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    raw[k] = typeof v === "string" ? v.trim() : v;
  }
  const r = schema.safeParse(raw);
  if (r.success) return { data: r.data };
  const fieldErrors: Record<string, string> = {};
  for (const i of r.error.issues) fieldErrors[String(i.path[0] ?? "_")] ??= i.message;
  return { state: fail("Confira os campos destacados.", fieldErrors) };
}

/** Empty string from a form field becomes undefined, so optional fields validate cleanly. */
export const optional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v), s.optional());

/** Money/decimal text from a pt-BR or plain input ("1.234,56" or "1234.56"). */
export const moneyStr = z
  .string()
  .transform((s) => (s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s))
  .refine((s) => /^\d{1,10}(\.\d{1,2})?$/.test(s), "Valor inválido.");

export const pctStr = z
  .string()
  .transform((s) => s.replace(",", "."))
  .refine((s) => /^\d{1,3}(\.\d{1,2})?$/.test(s) && Number(s) <= 100, "Percentual inválido (0 a 100).");

/** yyyy-mm-dd that is a real calendar day (rejects 2026-13-45 and 2026-02-31, which would reach the DB and 500). */
export const ymd = (msg = "Data inválida.") =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, msg).refine((s) => { const d = new Date(`${s}T00:00:00Z`); return !isNaN(+d) && d.toISOString().startsWith(s) && s >= "1900-01-01" && s <= "2999-12-31"; }, msg);

export const uuid = z.string().uuid("Seleção inválida.");
