import Link from "next/link";
import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { registerAction } from "@/server/auth-actions";

export const metadata = { title: "Criar conta" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1">Criar conta</h1>
      <p className="mb-5 text-[0.9375rem] text-[var(--text-2)]">Leva um minuto. Você será o administrador da sua assistência.</p>
      <ActionForm action={registerAction}>
        <Field name="business" label="Nome da assistência"><Input name="business" autoComplete="organization" required /></Field>
        <Field name="name" label="Seu nome"><Input name="name" autoComplete="name" required /></Field>
        <Field name="email" label="E-mail"><Input name="email" type="email" inputMode="email" autoComplete="email" required /></Field>
        <Field name="phone" label="WhatsApp (opcional)" hint="Com DDD. Aparece nos orçamentos."><Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(65) 99999-9999" /></Field>
        <Field name="password" label="Senha" hint="Mínimo de 8 caracteres."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
        <SubmitButton pendingText="Criando…">Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-5 text-center text-[0.9375rem] text-[var(--text-2)]">Já tem conta? <Link href="/login" className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline">Entrar</Link></p>
    </>
  );
}
