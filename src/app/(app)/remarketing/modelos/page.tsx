import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Empty, PageHeader } from "@/components/ui";
import { requireAuth } from "@/server/auth";
import { TEMPLATE_VARS, listTemplates } from "@/server/remarketing";
import { deleteTemplateAction, saveTemplateAction } from "@/server/remarketing-actions";
import { ConfirmButton } from "../../clientes/confirm-button";

export const metadata = { title: "Modelos de mensagem" };

export default async function ModelosPage({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const { db } = await requireAuth();
  const templates = await listTemplates(db);
  const editing = templates.find((t) => t.id === editar);
  return (
    <>
      <PageHeader title="Modelos de mensagem" sub="Marketing só vai para quem autorizou." />
      {templates.length === 0 ? <Empty title="Nenhum modelo" text="Crie o primeiro modelo abaixo." /> : (
        <div className="card overflow-hidden">
          {templates.map((t) => (
            <div key={t.id} className="list-row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{t.name}</p>
                <span className={t.kind === "MARKETING" ? "chip chip-accent" : "chip"}>{t.kind === "MARKETING" ? "Marketing" : "Operacional"}</span>
              </div>
              <Link href={`/remarketing/modelos?editar=${t.id}`} className="btn btn-quiet btn-sm" aria-label={`Editar ${t.name}`}><Pencil size={16} aria-hidden /></Link>
              <form action={deleteTemplateAction}>
                <input type="hidden" name="id" value={t.id} />
                <ConfirmButton message="Excluir este modelo?" className="btn btn-danger btn-sm"><Trash2 size={16} aria-hidden /><span className="sr-only">Excluir {t.name}</span></ConfirmButton>
              </form>
            </div>
          ))}
        </div>
      )}
      <h2 className="mb-3 mt-8">{editing ? "Editar modelo" : "Novo modelo"}</h2>
      <div className="card card-pad">
        <ActionForm action={saveTemplateAction} resetOnSuccess={!editing} key={editing?.id ?? "new"}>
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <Field name="name" label="Nome"><Input name="name" defaultValue={editing?.name} required /></Field>
          <Field name="kind" label="Tipo" hint="Marketing exige consentimento do cliente.">
            <Select name="kind" defaultValue={editing?.kind ?? "OPERATIONAL"}><option value="OPERATIONAL">Operacional</option><option value="MARKETING">Marketing</option></Select>
          </Field>
          <Field name="body" label="Mensagem" hint={`Variáveis: ${TEMPLATE_VARS.join(" ")}`}><Textarea name="body" defaultValue={editing?.body} required rows={5} /></Field>
          <SubmitButton>Salvar modelo</SubmitButton>
          {editing && <Link href="/remarketing/modelos" className="btn btn-quiet">Cancelar edição</Link>}
        </ActionForm>
      </div>
    </>
  );
}
