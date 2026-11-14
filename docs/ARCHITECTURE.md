# Arquitetura — Super Herói dos PCs

Monolito modular em Next.js 16 (App Router) + TypeScript strict + Tailwind 4 + Prisma 7 + PostgreSQL. Leia `PRODUCT.md` e `node_modules/next/dist/docs/` (esta versão do Next tem mudanças: `params`/`searchParams`/`cookies()` são Promises).

## Contrato (todo módulo segue)

1. **Serviços puros** em `src/server/<modulo>.ts`: funções `(db: TenantDb, ...)` sem `cookies()`/`redirect()`. Testáveis com Vitest contra o banco real.
2. **Server Actions** em `src/server/<modulo>-actions.ts` (`"use server"`): chamam `requireAuth()`, validam com zod via `parse()` (`src/lib/action.ts`), delegam ao serviço, `revalidatePath`, retornam `ActionState`.
3. **Páginas** em `src/app/(app)/<rota>/`. Server Components por padrão; `"use client"` só onde há estado de UI.
4. **Tenant**: nunca importar `prisma` direto em módulo de negócio. Usar `db` vindo de `requireAuth()` (`forTenant(tenantId)` injeta/forçam `tenantId`). Exceção: Super Admin (`src/server/admin.ts`) e auth.
5. **Dinheiro**: `Decimal` (decimal.js) / `Prisma.Decimal`; nunca `number` para somar. Formatar com `money()` de `src/components/ui.tsx`. Cálculo de preço só via `calculatePrice()` em `src/lib/pricing.ts`.
6. **Datas**: UTC no banco; exibir com `dateBR()`/`dateTimeBR()` no fuso do tenant.
7. **Transações**: operação que toca mais de uma tabela usa `db.$transaction(async (tx) => ...)`.
8. **UI**: só tokens de `src/app/globals.css` (`var(--...)`), classes `.card .btn .input .chip .list-row`, componentes de `src/components/form.tsx` e `ui.tsx`. Mobile-first (390px primeiro), alvos de toque ≥ 44px, `font-size` ≥ 16px em inputs. Todo módulo entrega estados: carregando (`loading.tsx` com `<Skeleton/>`), vazio (`<Empty/>`), erro (`error.tsx`), sucesso.
9. **Copy**: pt-BR, direto, botão nomeia a ação. Sem emoji. Ícones só `lucide-react`.
10. **Logo**: só `<Logo/>` (`public/brand/`). Nunca trocar por ícone genérico.

## Isolamento multi-tenant

- `forTenant()` (`src/lib/db.ts`) estampa `tenantId` em create/upsert e força `where.tenantId` em find/update/delete/count/aggregate/groupBy.
- Relações: ao criar linhas filhas apontando para um id vindo do cliente (ex.: `customerId`), **verifique que o pai pertence ao tenant** com `db.customer.findFirst({ where: { id } })` antes.
- Sessão: cookie httpOnly, token aleatório, só o SHA-256 vai ao banco.

## Interfaces entre módulos

`src/server/finance.ts` (dono: Financeiro). Outros módulos só chamam estas funções:

```ts
createReceivable(db, { customerId, quoteId?, amount, description, dueDate, allocationKey }): Promise<FinancialTransaction>
registerPayment(db, transactionId, { amount, method?, paidAt? }): Promise<FinancialTransaction> // parcial; PAID quando soma >= valor
onQuoteApproved(db, quoteId): Promise<void>  // idempotente (allocationKey): receita principal, receita de repasse (SEPARATE), custo do Uber (todos os modos, nunca 2x)
onOrderDelivered(db, orderId): Promise<void> // garante recebível se não houver orçamento aprovado
```

`src/server/quotes.ts`: `nextQuoteNumber(tx, tenantId)` usam `Tenant.quoteSeq` com `UPDATE ... RETURNING` na mesma transação.

`src/server/crm.ts` (dono: CRM): `touchLastContact(db, customerId)`, `customerTimeline(db, customerId)`.

## Regras de negócio críticas

- Não há ordem de serviço no MVP: o orçamento aprovado é o registro do serviço e gera o financeiro.
- Orçamento aprovado é snapshot imutável; alterar gera nova revisão (`revision+1`, `parentQuoteId`).
- Uber: INCLUDED (dentro do custo), SEPARATE (linha própria; repasse puro ou com margem), ABSORBED (custo do negócio, sem receita). O custo entra **uma vez** em qualquer modo; lançamentos usam `allocationKey` único por tenant.
- Pendente nunca é "recebido". Indicadores: recebido = soma de `TransactionPayment` no período (caixa).
- Marketing exige `marketingConsent = true` e `marketingOptOut = false`. Mensagem operacional não exige. Nunca presumir consentimento.
- Exclusão de cliente com histórico = lógica (`deletedAt`).

## Dev

`npm run db:up` (Postgres embutido :5433) · `npm run db:migrate` · `npm run db:seed` · `npm run dev` · `npm test` · `npm run typecheck`.
Testes usam `DATABASE_URL`; cada teste cria seu próprio tenant (`tests/helpers.ts`), sem depender de dados alheios.
