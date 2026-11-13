import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Empty, PageHeader, dateBR } from "@/components/ui";
import { formatPhone, whatsappLink } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { CrmError, DEVICE_CATEGORIES, addressText, customerTimeline, getCustomer, inactiveDays } from "@/server/crm";
import { deleteCustomerAction, deleteDeviceAction, saveDeviceAction } from "@/server/crm-actions";
import { ConfirmButton } from "../confirm-button";
import { ContactForm } from "../../remarketing/contact-form";

export const metadata = { title: "Cliente" };

export default async function FichaCliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ equipamento?: string }> }) {
  const [{ id }, { equipamento }] = await Promise.all([params, searchParams]);
  const { db, tenant } = await requireAuth();
  const c = await getCustomer(db, id).catch((e) => { if (e instanceof CrmError) return null; throw e; });
  if (!c) notFound();
  const [devices, timeline, quotePending, lastOrder, days] = await Promise.all([
    db.customerDevice.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
    customerTimeline(db, id),
    db.quote.count({ where: { customerId: id, status: "SENT" } }),
    db.serviceOrder.findFirst({ where: { customerId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    inactiveDays(db),
  ]);
  const inactive = isInactive(lastOrder?.createdAt ?? c.createdAt, days);
  const editing = devices.find((d) => d.id === equipamento);
  const tz = tenant.timezone;
  const address = addressText(c.address);

  return (
    <>
      <PageHeader
        title={c.name}
        sub={formatPhone(c.phone)}
        action={<Link href={`/clientes/${id}/editar`} className="btn btn-quiet btn-sm"><Pencil size={16} aria-hidden /> Editar</Link>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {quotePending > 0 && <span className="chip chip-warn">Orçamento pendente</span>}
        {inactive && <span className="chip">Inativo</span>}
        {c.marketingOptOut ? <span className="chip chip-bad">Não quer marketing</span> : c.marketingConsent ? <span className="chip chip-ok">Aceita marketing</span> : <span className="chip">Sem consentimento de marketing</span>}
      </div>
      <a href={whatsappLink(c.whatsapp ?? c.phone, "")} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full sm:w-auto">
        <MessageCircle size={20} aria-hidden /> Abrir WhatsApp
      </a>

      <section className="mt-8 grid gap-3" aria-labelledby="contato">
        <h2 id="contato">Contato</h2>
        <dl className="card grid gap-3 p-5 text-[0.9375rem]">
          {c.whatsapp && <Row k="WhatsApp" v={formatPhone(c.whatsapp)} />}
          {c.email && <Row k="E-mail" v={c.email} />}
          {c.document && <Row k="CPF/CNPJ" v={c.document} />}
          {address && <Row k="Endereço" v={address} />}
          <Row k="Último contato" v={c.lastContactAt ? dateBR(c.lastContactAt, tz) : "Nenhum registrado"} />
          {c.notes && <Row k="Observações" v={c.notes} />}
        </dl>
        <details className="card p-5">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[var(--accent)]">Registrar contato</summary>
          <div className="pt-3"><ContactForm customerId={id} kind="OPERATIONAL" /></div>
        </details>
      </section>

      <section className="mt-8 grid gap-3" aria-labelledby="equipamentos">
        <h2 id="equipamentos">Equipamentos</h2>
        {devices.length === 0 ? (
          <p className="text-[0.9375rem] text-[var(--text-2)]">Nenhum equipamento cadastrado.</p>
        ) : (
          <div className="card overflow-hidden">
            {devices.map((d) => (
              <div key={d.id} className="list-row">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{[d.brand, d.model].filter(Boolean).join(" ") || d.category}</p>
                  <p className="truncate text-sm text-[var(--text-2)]">{[d.category, d.serialNumber].filter(Boolean).join(" · ")}</p>
                </div>
                <Link href={`/clientes/${id}?equipamento=${d.id}#equipamentos`} className="btn btn-quiet btn-sm" aria-label={`Editar ${d.category}`}><Pencil size={16} aria-hidden /></Link>
                <form action={deleteDeviceAction}>
                  <input type="hidden" name="customerId" value={id} />
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmButton message="Excluir este equipamento?" className="btn btn-danger btn-sm"><Trash2 size={16} aria-hidden /><span className="sr-only">Excluir equipamento</span></ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        )}
        <details className="card p-5" open={!!editing}>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[var(--accent)]">{editing ? "Editar equipamento" : "Adicionar equipamento"}</summary>
          <div className="pt-3">
            <ActionForm action={saveDeviceAction} resetOnSuccess={!editing} key={editing?.id ?? "new"}>
              <input type="hidden" name="customerId" value={id} />
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field name="category" label="Categoria">
                <Select name="category" defaultValue={editing?.category ?? "Notebook"}>{DEVICE_CATEGORIES.map((k) => <option key={k}>{k}</option>)}</Select>
              </Field>
              <Field name="brand" label="Marca"><Input name="brand" defaultValue={editing?.brand ?? ""} /></Field>
              <Field name="model" label="Modelo"><Input name="model" defaultValue={editing?.model ?? ""} /></Field>
              <Field name="serialNumber" label="Número de série"><Input name="serialNumber" defaultValue={editing?.serialNumber ?? ""} /></Field>
              <Field name="accessories" label="Acessórios"><Input name="accessories" defaultValue={editing?.accessories ?? ""} /></Field>
              <Field name="conditionNotes" label="Estado do equipamento"><Textarea name="conditionNotes" defaultValue={editing?.conditionNotes ?? ""} /></Field>
              <SubmitButton>Salvar equipamento</SubmitButton>
              {editing && <Link href={`/clientes/${id}#equipamentos`} className="btn btn-quiet">Cancelar edição</Link>}
            </ActionForm>
          </div>
        </details>
      </section>

      <section className="mt-8 grid gap-3" aria-labelledby="historico">
        <h2 id="historico">Histórico</h2>
        {timeline.length === 0 ? <Empty title="Sem histórico" text="Os eventos do cliente aparecem aqui." /> : (
          <ol className="card grid">
            {timeline.map((e, i) => {
              const body = (
                <>
                  <p className="text-sm text-[var(--text-2)]">{dateBR(e.at, tz)}</p>
                  <p className="font-semibold">{e.title}</p>
                  {e.detail && <p className="text-[0.9375rem] text-[var(--text-2)]">{e.detail}</p>}
                </>
              );
              return (
                <li key={i} className="border-t border-[var(--line)] first:border-t-0">
                  {e.href ? <Link href={e.href} className="block px-5 py-3 active:bg-[var(--bg)]">{body}</Link> : <div className="px-5 py-3">{body}</div>}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <form action={deleteCustomerAction} className="mt-10">
        <input type="hidden" name="id" value={id} />
        <ConfirmButton message="Excluir este cliente? Se ele tiver histórico, será arquivado e sai das listas." className="btn btn-danger w-full sm:w-auto">
          <Trash2 size={18} aria-hidden /> Excluir cliente
        </ConfirmButton>
      </form>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[var(--text-2)]">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

/** Outside the component: it reads the clock, which render code must not. */
function isInactive(since: Date, days: number) {
  return Date.now() - since.getTime() >= days * 86_400_000;
}
