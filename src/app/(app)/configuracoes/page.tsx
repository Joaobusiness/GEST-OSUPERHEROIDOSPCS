import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { requireAuth } from "@/server/auth";
import { TIMEZONES, listTeam } from "@/server/settings";
import { addMemberAction, removeMemberAction, updateBusinessAction, updatePricingSettingsAction } from "@/server/settings-actions";
import { ConfirmButton } from "@/app/admin/confirm-button";
import { formatPhone } from "@/lib/br";

export const metadata = { title: "Configurações" };

type Addr = { street?: string; number?: string; district?: string; city?: string; state?: string; zip?: string };

export default async function Page() {
  const { db, tenant, tenantId, role, user } = await requireAuth();
  const isAdmin = role === "ADMIN";
  const [st, team] = await Promise.all([
    db.pricingSettings.findUnique({ where: { tenantId } }),
    listTeam({ db, tenantId, role, userId: user.id }),
  ]);
  const a = (tenant.address ?? {}) as Addr;
  const v = (x: { toString(): string } | undefined, d = "") => x?.toString() ?? d;

  return (
    <>
      <PageHeader title="Configurações" sub={isAdmin ? "Dados da empresa, padrões de preço e equipe." : "Somente administradores podem alterar. Você pode consultar."} />
      <div className="grid gap-6">
        <section className="card card-pad grid gap-4">
          <h2>Empresa</h2>
          <ActionForm action={updateBusinessAction}>
            <fieldset disabled={!isAdmin} className="grid gap-4 border-0 p-0">
              <Field name="name" label="Nome da assistência"><Input name="name" defaultValue={tenant.name} required /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="document" label="CNPJ ou CPF"><Input name="document" inputMode="numeric" defaultValue={tenant.document ?? ""} /></Field>
                <Field name="email" label="E-mail"><Input name="email" type="email" defaultValue={tenant.email} required /></Field>
                <Field name="phone" label="Telefone"><Input name="phone" type="tel" defaultValue={tenant.phone ? formatPhone(tenant.phone) : ""} /></Field>
                <Field name="whatsapp" label="WhatsApp"><Input name="whatsapp" type="tel" defaultValue={tenant.whatsapp ? formatPhone(tenant.whatsapp) : ""} /></Field>
              </div>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field name="street" label="Rua"><Input name="street" defaultValue={a.street ?? ""} /></Field>
                <Field name="number" label="Número"><Input name="number" defaultValue={a.number ?? ""} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field name="district" label="Bairro"><Input name="district" defaultValue={a.district ?? ""} /></Field>
                <Field name="zip" label="CEP"><Input name="zip" inputMode="numeric" defaultValue={a.zip ?? ""} /></Field>
              </div>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field name="city" label="Cidade"><Input name="city" defaultValue={a.city ?? ""} /></Field>
                <Field name="state" label="UF"><Input name="state" maxLength={2} defaultValue={a.state ?? ""} /></Field>
              </div>
              <Field name="timezone" label="Fuso horário" hint="Datas aparecem neste fuso.">
                <Select name="timezone" defaultValue={tenant.timezone}>
                  {TIMEZONES.map((z) => <option key={z} value={z}>{z.replace("America/", "").replace("_", " ")}</option>)}
                </Select>
              </Field>
              {isAdmin && <SubmitButton>Salvar empresa</SubmitButton>}
            </fieldset>
          </ActionForm>
        </section>

        <section className="card card-pad grid gap-4">
          <div>
            <h2>Preço e relacionamento</h2>
            <p className="hint mt-1">Estes padrões valem para novos orçamentos e simulações. Orçamentos aprovados não mudam.</p>
          </div>
          {st && (
            <ActionForm action={updatePricingSettingsAction}>
              <fieldset disabled={!isAdmin} className="grid gap-4 border-0 p-0">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Field name="partMarginPct" label="Margem de peças (%)"><Input name="partMarginPct" inputMode="decimal" defaultValue={v(st.partMarginPct)} /></Field>
                  <Field name="laborMarginPct" label="Margem de mão de obra (%)"><Input name="laborMarginPct" inputMode="decimal" defaultValue={v(st.laborMarginPct)} /></Field>
                  <Field name="minMarginPct" label="Margem mínima (%)" hint="Abaixo disso você recebe um aviso."><Input name="minMarginPct" inputMode="decimal" defaultValue={v(st.minMarginPct)} /></Field>
                  <Field name="taxPct" label="Imposto (%)"><Input name="taxPct" inputMode="decimal" defaultValue={v(st.taxPct)} /></Field>
                  <Field name="cardFeePct" label="Taxa do cartão (%)"><Input name="cardFeePct" inputMode="decimal" defaultValue={v(st.cardFeePct)} /></Field>
                  <Field name="otherCostsFixed" label="Outros custos fixos (R$)"><Input name="otherCostsFixed" inputMode="decimal" defaultValue={v(st.otherCostsFixed)} /></Field>
                  <Field name="defaultUberCost" label="Uber padrão (R$)"><Input name="defaultUberCost" inputMode="decimal" defaultValue={v(st.defaultUberCost)} /></Field>
                  <Field name="defaultUberMode" label="Cobrança do Uber">
                    <Select name="defaultUberMode" defaultValue={st.defaultUberMode}>
                      <option value="INCLUDED">Incluído no preço</option>
                      <option value="SEPARATE">Cobrado separado</option>
                      <option value="ABSORBED">Absorvido por mim</option>
                    </Select>
                  </Field>
                </div>
                <label className="flex min-h-11 items-center gap-3 text-[0.9375rem]">
                  <input type="checkbox" name="uberMarkup" className="size-5 accent-[var(--accent)]" defaultChecked={st.uberMarkup} />
                  <span>Uber cobrado separado com margem (desmarcado: repasse puro)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Field name="inactiveDays" label="Cliente inativo após (dias)"><Input name="inactiveDays" inputMode="numeric" defaultValue={st.inactiveDays} /></Field>
                  <Field name="warrantyAlertDays" label="Avisar garantia (dias antes)"><Input name="warrantyAlertDays" inputMode="numeric" defaultValue={st.warrantyAlertDays} /></Field>
                </div>
                {isAdmin && <SubmitButton>Salvar padrões</SubmitButton>}
              </fieldset>
            </ActionForm>
          )}
        </section>

        <section className="card grid overflow-hidden">
          <div className="card-pad grid gap-1 pb-3"><h2>Equipe</h2><p className="hint">Administradores alteram configurações. Membros só consultam.</p></div>
          {team.map((m) => (
            <div key={m.userId} className="list-row">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{m.name}</p>
                <p className="truncate text-sm text-[var(--text-2)]">{m.email}</p>
              </div>
              <span className={m.role === "ADMIN" ? "chip chip-accent" : "chip"}>{m.role === "ADMIN" ? "Administrador" : "Membro"}</span>
              {isAdmin && m.userId !== user.id && (
                <ActionForm action={removeMemberAction} className="shrink-0">
                  <input type="hidden" name="userId" value={m.userId} />
                  <ConfirmButton message={`Remover ${m.name} da equipe? O acesso é encerrado agora.`}>Remover</ConfirmButton>
                </ActionForm>
              )}
            </div>
          ))}
          {isAdmin && (
            <div className="card-pad border-t border-[var(--line)]">
              <h3 className="mb-3">Adicionar membro</h3>
              <ActionForm action={addMemberAction} resetOnSuccess>
                <Field name="name" label="Nome"><Input name="name" required /></Field>
                <Field name="email" label="E-mail"><Input name="email" type="email" autoComplete="off" required /></Field>
                <Field name="password" label="Senha temporária" hint="Mínimo de 8 caracteres. Combine com a pessoa a troca da senha."><Input name="password" type="password" autoComplete="new-password" required /></Field>
                <SubmitButton pendingText="Adicionando…">Adicionar membro</SubmitButton>
              </ActionForm>
            </div>
          )}
        </section>

        <section className="card card-pad grid gap-2">
          <h2>Privacidade (LGPD)</h2>
          <p className="hint">Você trata dados de clientes. Marketing só com consentimento registrado.</p>
          <div className="flex flex-wrap gap-x-6">
            <Link href="/privacidade" className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]">Política de privacidade</Link>
            <Link href="/termos" className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)]">Termos de uso</Link>
          </div>
        </section>
      </div>
    </>
  );
}
