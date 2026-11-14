import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { loginAction } from "@/server/auth-actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sessao?: string }> }) {
  const { sessao } = await searchParams;
  return (
    <>
      <h1 className="mb-1">Entrar</h1>
      <p className="mb-5 text-[0.9375rem] text-[var(--text-2)]">Acesse a sua assistência.</p>
      {sessao === "expirada" && <p role="status" className="chip chip-warn mb-4 !rounded-[var(--r-md)] !px-3 !py-2 !text-sm">Sua sessão expirou. Entre de novo para continuar.</p>}
      <ActionForm action={loginAction}>
        <Field name="email" label="E-mail"><Input name="email" type="email" inputMode="email" autoComplete="email" required /></Field>
        <Field name="password" label="Senha"><Input name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
      </ActionForm>
      <div className="mt-5 grid gap-2 text-center text-[0.9375rem]">
        <Link href="/esqueci-senha" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">Esqueci minha senha</Link>
        <p className="text-[var(--text-2)]">Ainda não tem conta? <Link href="/cadastro" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">Criar conta</Link></p>
      </div>
    </>
  );
}
