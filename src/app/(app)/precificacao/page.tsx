import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { Calculator } from "./calculator";
import { fromSaved, type SimInput } from "./sim";

export const metadata = { title: "Precificação" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  const { sim } = await searchParams;
  const { db, tenantId, user } = await requireAuth();
  const [st, saved] = await Promise.all([
    db.pricingSettings.findUnique({ where: { tenantId } }),
    sim && UUID.test(sim) ? db.pricingSimulation.findFirst({ where: { id: sim } }) : null,
  ]);
  const defaultUberCost = st?.defaultUberCost.toString() ?? "0";
  const defaults: SimInput = { partCost: "", laborCost: "", uberOn: false, uberCost: "0", markupPct: st?.markupPct.toString() ?? "40" };
  const legacy = !!saved && typeof (saved.input as Record<string, unknown>).markupPct !== "string";
  const initial = saved ? fromSaved(saved.input as Record<string, unknown>, defaults) : defaults;
  return (
    <>
      <PageHeader
        title="Precificação"
        sub={saved ? `Refazendo: ${saved.label ?? "simulação guardada"}${legacy ? ". Conta antiga: a margem foi convertida para o markup equivalente." : ""}` : "Custo mais markup: veja quanto cobrar e quanto sobra."}
        action={<Link href="/precificacao/historico" className="btn btn-quiet btn-sm"><History size={18} aria-hidden /> Histórico</Link>}
      />
      <Calculator key={saved?.id ?? "new"} initial={initial} draftKey={saved ? null : `calc-draft:${tenantId}:${user.id}`} defaultUberCost={defaultUberCost} />
    </>
  );
}
