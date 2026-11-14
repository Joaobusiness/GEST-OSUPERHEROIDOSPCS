"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, done, optional, parse, type ActionState } from "@/lib/action";
import { PricingError, calculatePrice } from "@/lib/pricing";
import { toPricingInput, type SimInput } from "@/app/(app)/precificacao/sim";
import { requireAuth } from "./auth";

const str = z.string().max(20);
const simSchema = z.object({
  partCost: str, laborCost: str, laborPrice: str, uberCost: str, uberMode: z.enum(["INCLUDED", "SEPARATE", "ABSORBED"]),
  uberMarkup: z.boolean(), otherCosts: str, fixedFees: str, marginPct: str, taxPct: str, cardFeePct: str, manualPrice: str,
});

/** The result is recomputed here from the input; the client's numbers are never trusted. */
export async function saveSimulationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = parse(z.object({ label: optional(z.string().max(80)), input: z.string() }), fd);
  if ("state" in p) return p.state;
  let sim: SimInput;
  try { sim = simSchema.parse(JSON.parse(p.data.input)); } catch { return fail("Não deu para guardar essa conta. Refaça e tente de novo."); }
  const built = toPricingInput(sim);
  if ("error" in built) return fail(built.error);
  const { db, tenantId } = await requireAuth();
  const settings = await db.pricingSettings.findUnique({ where: { tenantId } });
  let result;
  try { result = calculatePrice(built.input, settings?.minMarginPct.toString()); } catch (e) {
    if (e instanceof PricingError) return fail(e.message);
    throw e;
  }
  await db.pricingSimulation.create({ data: { label: p.data.label ?? null, input: sim, result } as never });
  revalidatePath("/precificacao/historico");
  return done("Guardado no histórico.");
}
