import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { forgotPasswordAction } from "@/server/auth-actions";

export const metadata = { title: "Recuperar senha" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="mb-1">Recuperar senha</h1>
      <p className="mb-5 text-[0.9375rem] text-[var(--text-2)]">Informe o e-mail da conta e enviaremos um link para criar uma nova senha.</p>
      <ActionForm action={forgotPasswordAction}>
        <Field name="email" label="E-mail"><Input name="email" type="email" inputMode="email" autoComplete="email" required /></Field>
        <SubmitButton pendingText="Enviando…">Enviar link</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center"><Link href="/login" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">Voltar ao login</Link></p>
    </>
  );
}
