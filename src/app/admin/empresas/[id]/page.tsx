import { requireSuperAdmin } from "@/server/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Status, dateBR } from "@/components/ui";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { listTenants } from "@/server/admin";
import { setSubscriptionAction, setTenantStatusAction } from "@/server/admin-actions";
import { ConfirmButton } from "../../confirm-button";
import { SUB } from "../../status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin(); // the layout check alone is not enough: pages and actions can be reached without it
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [tenants, plans] = await Promise.all([listTenants(), prisma.subscriptionPlan.findMany({ orderBy: { name: "asc" } })]);
  const t = tenants.find((x) => x.id === id);
  if (!t) notFound();
  const suspended = t.status === "SUSPENDED";
  return (
    <>
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[var(--accent)]"><ArrowLeft size={16} aria-hidden /> Empresas</Link>
      <PageHeader title={t.name} sub={`${t.email} · criada em ${dateBR(t.createdAt)}`} />
      <p className="num mb-6 text-[0.9375rem] text-[var(--text-2)]">{t.customerCount} clientes · {t.orderCount} ordens de serviço · {t.userCount} usuários</p>

      <section className="card card-pad mb-6 grid gap-3">
        <h2>Acesso</h2>
        <p className="text-[0.9375rem] text-[var(--text-2)]">
          {suspended ? "Empresa suspensa: ninguém da equipe consegue entrar." : "Suspender encerra as sessões abertas e bloqueia o acesso da equipe até você reativar."}
        </p>
        <ActionForm action={setTenantStatusAction}>
          <input type="hidden" name="tenantId" value={t.id} />
          <input type="hidden" name="status" value={suspended ? "ACTIVE" : "SUSPENDED"} />
          {suspended
            ? <SubmitButton pendingText="Reativando…">Reativar empresa</SubmitButton>
            : <ConfirmButton className="btn btn-danger" message={`Suspender ${t.name}? A equipe perde o acesso agora.`}>Suspender empresa</ConfirmButton>}
        </ActionForm>
      </section>

      <section className="card card-pad grid gap-3">
        <div className="flex items-center justify-between gap-3"><h2>Assinatura</h2>{t.subscriptionStatus && <Status map={SUB} value={t.subscriptionStatus} />}</div>
        <ActionForm action={setSubscriptionAction}>
          <input type="hidden" name="tenantId" value={t.id} />
          <Field name="planId" label="Plano">
            <Select name="planId" defaultValue={plans.find((p) => p.name === t.planName)?.id}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}{p.isActive ? "" : " (inativo)"}</option>)}
            </Select>
          </Field>
          <Field name="status" label="Situação">
            <Select name="status" defaultValue={t.subscriptionStatus ?? "TRIAL"}>
              <option value="TRIAL">Teste</option><option value="ACTIVE">Ativa</option>
              <option value="PAST_DUE">Em atraso</option><option value="CANCELED">Cancelada</option>
            </Select>
          </Field>
          <Field name="expiresAt" label="Vence em" hint="Opcional. Controle manual: o sistema não bloqueia sozinho no vencimento.">
            <Input name="expiresAt" type="date" defaultValue={t.expiresAt?.toISOString().slice(0, 10) ?? ""} />
          </Field>
          <SubmitButton>Salvar assinatura</SubmitButton>
        </ActionForm>
      </section>
    </>
  );
}
