import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Field, Select } from "@/components/form";
import { PageHeader } from "@/components/ui";
import { formatPhone, whatsappLink } from "@/lib/br";
import { requireAuth } from "@/server/auth";
import { CrmError, getCustomer } from "@/server/crm";
import { SEGMENTS, buildMessage, isSegment, listTemplates, marketingBlock } from "@/server/remarketing";
import { ContactForm } from "../contact-form";

export const metadata = { title: "Mensagem" };

export default async function MensagemPage({ searchParams }: { searchParams: Promise<{ cliente?: string; seg?: string; modelo?: string; c?: string }> }) {
  const sp = await searchParams;
  const { db, tenant } = await requireAuth();
  const customer = sp.cliente ? await getCustomer(db, sp.cliente).catch((e) => { if (e instanceof CrmError) return null; throw e; }) : null;
  if (!customer) notFound();
  const templates = await listTemplates(db);
  const wantKind = sp.seg && isSegment(sp.seg) ? SEGMENTS[sp.seg].kind : undefined;
  const tpl = templates.find((t) => t.id === sp.modelo) ?? templates.find((t) => t.kind === wantKind) ?? templates[0];
  const back = sp.c ? "/remarketing/campanhas" : "/remarketing";
  if (!tpl) return (
    <>
      <PageHeader title="Mensagem" sub={customer.name} />
      <p>Crie um modelo de mensagem primeiro. <Link href="/remarketing/modelos" className="font-semibold text-[var(--accent)] underline">Ir para modelos</Link></p>
    </>
  );
  const blocked = tpl.kind === "MARKETING" ? marketingBlock(customer) : undefined;
  const text = await buildMessage(db, tenant, customer.id, tpl.body);

  return (
    <>
      <PageHeader title="Mensagem" sub={`${customer.name} · ${formatPhone(customer.whatsapp ?? customer.phone)}`} />
      <form className="mb-5 flex items-end gap-2">
        <input type="hidden" name="cliente" value={customer.id} />
        {sp.seg && <input type="hidden" name="seg" value={sp.seg} />}
        {sp.c && <input type="hidden" name="c" value={sp.c} />}
        <div className="min-w-0 flex-1">
          <Field name="modelo" label="Modelo">
            <Select name="modelo" defaultValue={tpl.id}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.kind === "MARKETING" ? "marketing" : "operacional"})</option>)}</Select>
          </Field>
        </div>
        <button className="btn btn-quiet mb-6 shrink-0">Usar</button>
      </form>
      <h2 className="mb-2">Prévia</h2>
      <p className="card whitespace-pre-wrap p-5 text-[0.9375rem]">{text}</p>
      {blocked ? (
        <p role="alert" className="chip chip-warn mt-4 !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">Não é possível enviar este modelo: {blocked} Use um modelo operacional ou peça o consentimento ao cliente.</p>
      ) : (
        <>
          <a href={whatsappLink(customer.whatsapp ?? customer.phone, text)} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4 w-full sm:w-auto">
            <ExternalLink size={18} aria-hidden /> Abrir WhatsApp com esta mensagem
          </a>
          <section className="mt-8 grid gap-3" aria-labelledby="registro">
            <h2 id="registro">Depois do envio</h2>
            <p className="text-[0.9375rem] text-[var(--text-2)]">Registre o que aconteceu. Isso atualiza o último contato do cliente.</p>
            <ContactForm customerId={customer.id} kind={tpl.kind} campaignContactId={sp.c} />
          </section>
        </>
      )}
      <Link href={back} className="btn btn-quiet mt-8 w-full sm:w-auto">Voltar</Link>
    </>
  );
}
