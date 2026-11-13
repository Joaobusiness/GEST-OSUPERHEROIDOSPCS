import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { PageHeader, dateTimeBR } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { CrmError } from "@/server/crm";
import { getCampaign } from "@/server/remarketing";
import { STATUS } from "../status";

export const metadata = { title: "Campanha" };

export default async function CampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, tenant } = await requireAuth();
  const camp = await getCampaign(db, id).catch((e) => { if (e instanceof CrmError) return null; throw e; });
  if (!camp) notFound();
  const done = camp.contacts.filter((c) => c.contactedAt).length;
  return (
    <>
      <PageHeader title={camp.name} sub={`${done} de ${camp.contacts.length} contatados${camp.template ? ` · ${camp.template.name}` : ""}`} action={<span className={STATUS[camp.status].tone}>{STATUS[camp.status].label}</span>} />
      <div className="card overflow-hidden">
        {camp.contacts.map((c) => (
          <div key={c.id} className="list-row">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{c.customer?.name ?? "Cliente removido"}</p>
              <p className="text-sm text-[var(--text-2)]">{c.contactedAt ? `${c.result} · ${dateTimeBR(c.contactedAt, tenant.timezone)}` : "Ainda não contatado"}</p>
            </div>
            {!c.contactedAt && c.customer && (
              <Link href={`/remarketing/mensagem?cliente=${c.customerId}&c=${c.id}${camp.templateId ? `&modelo=${camp.templateId}` : ""}`} className="btn btn-primary btn-sm"><MessageCircle size={16} aria-hidden /> Abrir WhatsApp</Link>
            )}
          </div>
        ))}
      </div>
      <Link href="/remarketing/campanhas" className="btn btn-quiet mt-6 w-full sm:w-auto">Voltar às campanhas</Link>
    </>
  );
}
