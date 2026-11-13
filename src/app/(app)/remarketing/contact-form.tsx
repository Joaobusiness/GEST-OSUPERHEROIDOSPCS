import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { logContactAction } from "@/server/remarketing-actions";
import { CONTACT_RESULTS } from "@/server/remarketing";

/** Logs a contact (result + note) and updates the customer's last contact date. */
export function ContactForm({ customerId, kind, campaignContactId }: { customerId: string; kind: "OPERATIONAL" | "MARKETING"; campaignContactId?: string }) {
  return (
    <ActionForm action={logContactAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="kind" value={kind} />
      {campaignContactId && <input type="hidden" name="campaignContactId" value={campaignContactId} />}
      <Field name="result" label="Resultado do contato">
        <Select name="result" defaultValue="" required>
          <option value="" disabled>Escolha</option>
          {CONTACT_RESULTS.map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <Field name="note" label="Anotação (opcional)"><Input name="note" /></Field>
      <SubmitButton className="btn btn-quiet" pendingText="Registrando…">Registrar contato</SubmitButton>
    </ActionForm>
  );
}
