import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { resetPasswordAction } from "@/server/auth-actions";

export const metadata = { title: "Nova senha" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="mb-5">Criar nova senha</h1>
      <ActionForm action={resetPasswordAction}>
        <input type="hidden" name="token" value={token ?? ""} />
        <Field name="password" label="Nova senha" hint="Mínimo de 8 caracteres."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
        <SubmitButton>Salvar nova senha</SubmitButton>
      </ActionForm>
    </>
  );
}
