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
  const defaults: SimInput = {
    partCost: "", laborCost: "", laborPrice: "", uberCost: st?.defaultUberCost.toString() ?? "0", uberMode: st?.defaultUberMode ?? "INCLUDED",
    uberMarkup: st?.uberMarkup ?? false, otherCosts: st?.otherCostsFixed.toString() ?? "0", fixedFees: "",
    marginPct: st?.partMarginPct.toString() ?? "40", taxPct: st?.taxPct.toString() ?? "0", cardFeePct: st?.cardFeePct.toString() ?? "0", manualPrice: "",
  };
  const initial = saved ? { ...defaults, ...(saved.input as Partial<SimInput>) } : defaults;
  return (
    <>
      <PageHeader
        title="Precificação"
        sub={saved ? `Recalculando: ${saved.label ?? "simulação salva"}` : "Descubra o preço certo antes de fechar o serviço."}
        action={<Link href="/precificacao/historico" className="btn btn-quiet btn-sm"><History size={18} aria-hidden /> Histórico</Link>}
      />
      <Calculator key={saved?.id ?? "new"} initial={initial} minMarginPct={st?.minMarginPct.toString() ?? "20"} />
    </>
  );
}
