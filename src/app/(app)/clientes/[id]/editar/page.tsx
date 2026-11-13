import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { CrmError, getCustomer } from "@/server/crm";
import { CustomerForm } from "../../customer-form";

export const metadata = { title: "Editar cliente" };

export default async function EditarCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireAuth();
  const c = await getCustomer(db, id).catch((e) => { if (e instanceof CrmError) return null; throw e; });
  if (!c) notFound();
  return (
    <>
      <PageHeader title="Editar cliente" sub={c.name} />
      <div className="card card-pad"><CustomerForm c={c} /></div>
    </>
  );
}
