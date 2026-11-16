import Decimal from "decimal.js";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import type { Line } from "@/server/line-items";
import { draftKey } from "../draft";
import { quoteFormData } from "../form-data";
import { QuoteForm } from "../quote-form";

export const metadata = { title: "Novo orçamento" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db, tenantId, user } = await requireAuth();
  const d = await quoteFormData(db, tenantId);
  const customerId = d.customers.find((c) => c.id === sp.cliente)?.id ?? "";
  const fromCalc = fromCalculator(sp);
  // identifies what the URL prefilled, so a restored draft receives it once and a refresh never duplicates it
  const seed = customerId || fromCalc ? new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string").sort()).toString() : "";
  return (
    <>
      <PageHeader title="Novo orçamento" sub="Preencha o essencial. O PDF sai pronto para o cliente." />
      <QuoteForm
        customers={d.customers} settings={d.settings}
        draftKey={draftKey(tenantId, user.id)} base="" seed={seed} seeded={{ customerId, items: fromCalc?.items, uberCost: fromCalc?.uberCost }}
        initial={{ customerId, items: fromCalc?.items ?? [], discount: "0", extraFee: "0", uberMode: "SEPARATE", uberCost: fromCalc?.uberCost ?? "0", uberMarkup: false, validUntil: "", executionDays: "", paymentTerms: "", warranty: "", notes: "" }}
      />
    </>
  );
}

/** Pricing calculator hands over its result as query params; turn it into one editable line plus the Uber amount. */
function fromCalculator(sp: Record<string, string | undefined>): { items: Line[]; uberCost: string } | null {
  const num = (v?: string) => { try { const d = new Decimal(v ?? ""); return d.isFinite() && !d.isNeg() ? d : null; } catch { return null; } };
  const price = num(sp.preco), cost = num(sp.custo);
  if (!price || !cost) return null;
  // the quote adds the Uber line itself, so the item carries only the job
  const uber = num(sp.uber) ?? new Decimal(0);
  const unitPrice = Decimal.max(price.minus(uber), 0);
  const unitCost = Decimal.max(cost.minus(uber), 0);
  return {
    items: [{ kind: "OTHER", description: "Serviço", quantity: "1", unitCost: unitCost.toFixed(2), unitPrice: unitPrice.toFixed(2) }],
    uberCost: uber.toFixed(2),
  };
}
