import Decimal from "decimal.js";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { quoteFormData } from "../form-data";
import { QuoteForm } from "../quote-form";

export const metadata = { title: "Novo orçamento" };

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { db, tenantId } = await requireAuth();
  const d = await quoteFormData(db, tenantId);
  const customerId = d.customers.find((c) => c.id === sp.cliente)?.id ?? "";
  const fromCalc = fromCalculator(sp);
  return (
    <>
      <PageHeader title="Novo orçamento" sub="Preencha o essencial. O PDF sai pronto para o cliente." />
      <QuoteForm
        customers={d.customers} settings={d.settings}
        initial={{ customerId, items: fromCalc?.items ?? [], discount: "0", extraFee: "0", ...d.uberDefaults, ...(fromCalc?.uber ?? {}), validUntil: "", executionDays: "", paymentTerms: "", warranty: "", notes: "" }}
      />
    </>
  );
}

/** Pricing calculator hands over its result as query params; turn it into one editable line plus the uber setup. */
function fromCalculator(sp: Record<string, string | undefined>) {
  const num = (v?: string) => { try { const d = new Decimal(v ?? ""); return d.isFinite() && !d.isNeg() ? d : null; } catch { return null; } };
  const price = num(sp.preco), cost = num(sp.custo);
  if (!price || !cost) return null;
  const mode = sp.uberModo === "SEPARATE" || sp.uberModo === "ABSORBED" ? sp.uberModo : "INCLUDED";
  const uberCost = num(sp.uberCusto) ?? new Decimal(0);
  const charge = mode === "SEPARATE" ? (num(sp.uberCobrado) ?? new Decimal(0)) : new Decimal(0);
  // the quote adds the separate uber line itself, so the item carries only the job
  const unitPrice = Decimal.max(price.minus(charge), 0);
  const unitCost = Decimal.max(cost.minus(uberCost), 0);
  return {
    items: [{ kind: "OTHER" as const, description: "Serviço", quantity: "1", unitCost: unitCost.toFixed(2), unitPrice: unitPrice.toFixed(2) }],
    uber: { uberMode: mode as "INCLUDED" | "SEPARATE" | "ABSORBED", uberCost: uberCost.toFixed(2), uberMarkup: sp.uberMarkup === "1" },
  };
}
