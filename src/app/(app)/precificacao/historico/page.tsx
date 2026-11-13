import Link from "next/link";
import { Empty, PageHeader, dateTimeBR, money } from "@/components/ui";
import { requireAuth } from "@/server/auth";

export const metadata = { title: "Histórico de simulações" };

type Result = { finalPrice: string; profit: string; effectiveMarginPct: string };

export default async function Page() {
  const { db, tenant } = await requireAuth();
  const sims = await db.pricingSimulation.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader title="Histórico" sub="Simulações salvas. Recalcule para ajustar e reaproveitar." action={<Link href="/precificacao" className="btn btn-primary btn-sm">Nova simulação</Link>} />
      {sims.length === 0 ? (
        <Empty title="Nenhuma simulação salva" text="Calcule um preço e toque em Salvar no histórico para guardar aqui." href="/precificacao" cta="Calcular um preço" />
      ) : (
        <ul className="card overflow-hidden">
          {sims.map((s) => {
            const r = s.result as Result;
            return (
              <li key={s.id} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.label ?? "Sem nome"}</p>
                  <p className="num text-sm text-[var(--text-2)]">{dateTimeBR(s.createdAt, tenant.timezone)} · lucro {money(r.profit)} · margem {r.effectiveMarginPct.replace(".", ",")}%</p>
                </div>
                <p className="num font-bold">{money(r.finalPrice)}</p>
                <Link href={`/precificacao?sim=${s.id}`} className="btn btn-quiet btn-sm">Recalcular</Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
