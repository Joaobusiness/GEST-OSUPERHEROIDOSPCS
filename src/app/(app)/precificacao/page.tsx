import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { Calculator } from "./calculator";
import type { SimInput } from "./sim";

export const metadata = { title: "Precificação" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  const { sim } = await searchParams;
  const { db, tenantId } = await requireAuth();
  const [st, saved] = await Promise.all([
    db.pricingSettings.findUnique({ where: { tenantId } }),
    sim && UUID.test(sim) ? db.pricingSimulation.findFirst({ where: { id: sim } }) : null,
  ]);
  // MVP: só margem e Uber. Imposto, cartão, outros custos e preço manual ficam zerados.
  const defaults: SimInput = {
    partCost: "", laborCost: "", laborPrice: "", uberCost: st?.defaultUberCost.toString() ?? "0", uberMode: st?.defaultUberMode ?? "INCLUDED",
    uberMarkup: false, otherCosts: "0", fixedFees: "", marginPct: st?.partMarginPct.toString() ?? "40", taxPct: "0", cardFeePct: "0", manualPrice: "",
  };
  const initial = saved ? { ...defaults, ...(saved.input as Partial<SimInput>), laborPrice: "", uberMarkup: false, otherCosts: "0", fixedFees: "", taxPct: "0", cardFeePct: "0", manualPrice: "" } : defaults;
  return (
    <>
      <PageHeader
        title="Precificação"
        sub={saved ? `Refazendo: ${saved.label ?? "simulação guardada"}` : "Veja quanto cobrar para ficar com o lucro que você quer."}
        action={<Link href="/precificacao/historico" className="btn btn-quiet btn-sm"><History size={18} aria-hidden /> Histórico</Link>}
      />
      <Calculator key={saved?.id ?? "new"} initial={initial} />
    </>
  );
}
