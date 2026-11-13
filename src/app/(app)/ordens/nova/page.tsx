import { PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { DEVICE_CATEGORIES } from "@/server/crm";
import { NewOrderForm } from "./new-order-form";

export const metadata = { title: "Nova OS" };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const { cliente } = await searchParams;
  const { db } = await requireAuth();
  const [customers, devices] = await Promise.all([
    db.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    db.customerDevice.findMany({ select: { id: true, customerId: true, category: true, brand: true, model: true }, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);
  return (
    <>
      <PageHeader title="Nova OS" sub="Cliente, equipamento e problema. O resto você completa depois." />
      <NewOrderForm
        customers={customers} categories={[...DEVICE_CATEGORIES]}
        customerId={customers.some((c) => c.id === cliente) ? cliente : undefined}
        devices={devices.map((d) => ({ id: d.id, customerId: d.customerId, label: [d.category, d.brand, d.model].filter(Boolean).join(" ") }))}
      />
    </>
  );
}
