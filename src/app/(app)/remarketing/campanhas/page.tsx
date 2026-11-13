import Link from "next/link";
import { Plus } from "lucide-react";
import { Empty, PageHeader, dateBR } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { listCampaigns } from "@/server/remarketing";
import { STATUS } from "./status";

export const metadata = { title: "Campanhas" };

export default async function CampanhasPage() {
  const { db, tenant } = await requireAuth();
  const campaigns = await listCampaigns(db);
  return (
    <>
      <PageHeader title="Campanhas" sub="Listas de contato manual, um cliente por vez." action={<Link href="/remarketing/campanhas/nova" className="btn btn-primary btn-sm"><Plus size={18} aria-hidden /> Nova</Link>} />
      {campaigns.length === 0 ? (
        <Empty title="Nenhuma campanha" text="Monte uma lista de clientes de um segmento e registre cada contato." href="/remarketing/campanhas/nova" cta="Criar campanha" />
      ) : (
        <div className="card overflow-hidden">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/remarketing/campanhas/${c.id}`} className="list-row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-sm text-[var(--text-2)]">{c.done} de {c.total} contatados · {dateBR(c.createdAt, tenant.timezone)}</p>
              </div>
              <span className={STATUS[c.status].tone}>{STATUS[c.status].label}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
