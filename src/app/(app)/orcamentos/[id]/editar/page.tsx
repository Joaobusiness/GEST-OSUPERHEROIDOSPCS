import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { uuid } from "@/lib/action";
import { requireAuth } from "@/server/auth";
import { quoteFormData } from "../../form-data";
import { QuoteForm } from "../../quote-form";

export const metadata = { title: "Editar orçamento" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { db, tenantId } = await requireAuth();
  const [q, d] = await Promise.all([db.quote.findFirst({ where: { id }, include: { items: { orderBy: { id: "asc" } } } }), quoteFormData(db, tenantId)]);
  if (!q) notFound();
  if (q.status === "CANCELED") redirect(`/orcamentos/${id}`);
  return (
    <>
      <PageHeader title={`${q.number} rev. ${q.revision}`} sub="Editar orçamento" />
      <QuoteForm
        customers={d.customers} orders={d.orders} settings={d.settings}
        revisesDecided={q.status !== "DRAFT" && q.status !== "SENT"}
        initial={{
          id: q.id, customerId: q.customerId, serviceOrderId: q.serviceOrderId ?? "",
          items: q.items.map((i) => ({ kind: i.kind, description: i.description, quantity: i.quantity.toString(), unitCost: i.unitCost.toString(), unitPrice: i.unitPrice.toString() })),
          discount: q.discount.toString(), extraFee: q.extraFee.toString(), uberMode: q.uberMode, uberCost: q.uberCost.toString(), uberMarkup: q.uberMarkup,
          validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : "", executionDays: q.executionDays?.toString() ?? "",
          paymentTerms: q.paymentTerms ?? "", warranty: q.warranty ?? "", notes: q.notes ?? "",
        }}
      />
    </>
  );
}
