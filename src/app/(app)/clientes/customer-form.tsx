import { maskDocument, maskPhone } from "@/lib/mask";
import { ActionForm, Field, Input, SubmitButton, Textarea } from "@/components/form";
import { saveCustomerAction } from "@/server/crm-actions";
import { addressText } from "@/server/crm";

type C = { id: string; name: string; phone: string; whatsapp: string | null; document: string | null; email: string | null; address: unknown; notes: string | null; marketingConsent: boolean; marketingOptOut: boolean };

export function CustomerForm({ c }: { c?: C }) {
  return (
    <ActionForm action={saveCustomerAction}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <Field name="name" label="Nome"><Input name="name" defaultValue={c?.name} autoComplete="off" required /></Field>
      <Field name="phone" label="Telefone" hint="Com DDD."><Input name="phone" type="tel" inputMode="tel" autoComplete="tel" mask="phone" defaultValue={c?.phone ? maskPhone(c.phone) : ""} required /></Field>
      <details className="grid gap-4" open={!!(c?.whatsapp || c?.document || c?.email || c?.address || c?.notes)}>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[var(--accent)]">Mais dados (opcional)</summary>
        <div className="grid gap-4">
          <Field name="whatsapp" label="WhatsApp" hint="Deixe vazio se for o mesmo telefone."><Input name="whatsapp" type="tel" inputMode="tel" mask="phone" defaultValue={c?.whatsapp ? maskPhone(c.whatsapp) : ""} /></Field>
          <Field name="document" label="CPF ou CNPJ"><Input name="document" inputMode="numeric" mask="document" defaultValue={c?.document ? maskDocument(c.document) : ""} /></Field>
          <Field name="email" label="E-mail"><Input name="email" type="email" defaultValue={c?.email ?? ""} /></Field>
          <Field name="address" label="Endereço"><Input name="address" defaultValue={addressText(c?.address)} autoComplete="street-address" /></Field>
          <Field name="notes" label="Observações"><Textarea name="notes" defaultValue={c?.notes ?? ""} /></Field>
        </div>
      </details>
      {/* O consentimento de marketing já gravado não é apagado ao salvar */}
      {c?.marketingConsent && <input type="hidden" name="marketingConsent" value="on" />}
      {c?.marketingOptOut && <input type="hidden" name="marketingOptOut" value="on" />}
      <SubmitButton>Salvar cliente</SubmitButton>
    </ActionForm>
  );
}
