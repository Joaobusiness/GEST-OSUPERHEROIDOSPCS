# Auditoria de codigo (estatica) - agent `code`

Escopo: server actions, route handler, auth, db scope, finance, quotes, orders, CRM, remarketing, admin, br.ts, next.config.ts, seed. Somente leitura, nada alterado.

Contagem: P0 0 | P1 0 | P2 5 | P3 9 | INFO 6.
Nao verificado: `npm audit --omit=dev` (sem shell nesta execucao); historico git do `.env` (pasta nao e repositorio git); paginas de UI menores (dashboard.ts, ordens/clientes pages, calculator.tsx, sim.ts, privacidade/termos) lidas so por grep.

Resultado positivo (verificado no codigo): sem `dangerouslySetInnerHTML`; `onSuccessHref` e todo `redirect()` usam constantes ou UUID gerado no servidor (sem open redirect); `whatsappLink` usa `onlyDigits` + `encodeURIComponent` (sem `javascript:`); CSV com neutralizacao de formula (`finance.ts:374`); pagamento com `SELECT ... FOR UPDATE` (`finance.ts:203-237`), aprovar/converter atomicos (`quotes.ts:85`, `:123`); valores negativos e acima do saldo rejeitados; desconto > total rejeitado (`quotes.ts:40`); zod strip evita mass assignment (todos os `data:` sao montados campo a campo); pagina de impressao exige sessao e escopa por tenant; cookie httpOnly + sameSite lax + secure em producao; token de sessao so em hash SHA-256.

---

## P2

### S-01 P2 - Throttle de login/cadastro/recuperacao contornavel e nao distribuido
- `src/server/auth-actions.ts:17-20` usa o primeiro item de `x-forwarded-for` como IP; `:30`, `:52`, `:70` usam esse IP como chave. `src/server/auth.ts:67-75`: mapa em memoria por processo, nunca limpo.
- Exploit: atacante envia `X-Forwarded-For: <aleatorio>` a cada tentativa em `loginAction`; a chave `login:<ip>:<email>` muda sempre, entao ha tentativas ilimitadas contra qualquer e-mail (senha minima so 8 caracteres, `auth-actions.ts:15`). Mesmo sem spoof, varias instancias/serverless nao compartilham o contador. Chaves aleatorias tambem crescem o `Map` sem limite (DoS de memoria). Depende do proxy: se ele apenas acrescenta ao header, o primeiro valor e do cliente.
- `resetPasswordAction` (`:81`) nao tem throttle (token de 256 bits, risco baixo).
- Fix minimo: usar o ultimo IP confiavel do proxy (ou header que a plataforma sobrescreve, ex. `x-real-ip`/`x-vercel-forwarded-for`), alem de um contador por e-mail independente do IP; mover para tabela/Redis e podar entradas expiradas.

### S-02 P2 - Link de redefinicao de senha gravado no log
- `src/server/auth-actions.ts:76`: `console.info(... /redefinir-senha?token=<token>)`.
- Exploit: quem le o log (agregador, suporte, CI) pega o token valido por 1h e redefine a senha de qualquer conta, inclusive Super Admin, apos pedir "esqueci a senha" para o e-mail alvo. Pior: em producao esse e o unico canal, entao o log precisa ser lido para o fluxo funcionar.
- Fix minimo: enviar por e-mail (SMTP/Resend); ate la, bloquear o `console.info` quando `NODE_ENV === "production"` e nao logar o token.

### S-03 P2 - Seed cria Super Admin com senha padrao conhecida
- `prisma/seed.ts:9` (`"ChangeMe!12345"` como fallback), `:19`, e usuario demo `Demo!12345` impresso em `:26`/`:53`. Sem guarda de ambiente.
- Exploit: `npm run db:seed` rodado em producao sem `SEED_ADMIN_PASSWORD` deixa conta `isSuperAdmin` com senha publica (suspende/reativa qualquer tenant, edita planos). A conta demo fica ativa com a mesma senha.
- Fix minimo: exigir `SEED_ADMIN_PASSWORD` (sem fallback) e abortar se `NODE_ENV === "production"`; criar demo so fora de producao.

### S-04 P2 - Sem cabecalhos de seguranca
- `next.config.ts:4-17` nao define `headers()`: faltam CSP, `X-Frame-Options`/`frame-ancestors`, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Exploit: embutir o app em iframe (clickjacking; atenuado porque o cookie e SameSite=Lax) e sem CSP qualquer XSS futuro nao tem rede de seguranca. A URL com `?token=` de redefinicao nao tem `Referrer-Policy` explicito.
- Fix minimo: `async headers()` com `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (se HTTPS terminado no app/CDN) e CSP com nonce.

### S-05 P2 - LGPD: bloqueio de marketing depende de campo vindo do cliente e nao ha prova de consentimento
- `src/server/remarketing-actions.ts:47` aceita `kind` do FormData (hidden em `contact-form.tsx:10`); `remarketing.ts:128` so checa consentimento quando `kind === "MARKETING"`. A pagina `mensagem/page.tsx:29,48-53` e uma checagem de UI; o link wa.me e montado sem servidor controlar o envio.
- Exploit: usuario/forca da UI envia `kind=OPERATIONAL` para um modelo de marketing e registra contato a cliente sem consentimento ou com `marketingOptOut`; `createCampaign` (`remarketing.ts:156`) tambem confia no `kind` do modelo, que o proprio tenant define (`saveTemplate`, `:99`), podendo classificar texto promocional como OPERATIONAL.
- `crm.ts:26-33`/`:37-40`: consentimento e opt-out sao booleanos sem data, origem ou trilha de auditoria; qualquer membro altera sem registro (`saveCustomerAction` nao chama `audit`). Sem como provar consentimento a ANPD/cliente.
- Fix minimo: derivar `kind` do modelo no servidor (`logContact` busca o template), gravar `marketingConsentAt`/`source` e `audit()` ao alterar consentimento/opt-out.

---

## P3

### S-06 P3 - LGPD: exclusao nao anonimiza; CPF/CNPJ em texto puro
- `src/server/crm.ts:74-90`: com historico so `deletedAt`; nome, telefone, documento e notas ficam para sempre. Nao ha exportacao nem eliminacao a pedido do titular. `crm.ts:28` guarda documento sem criptografia.
- Fix minimo: acao "anonimizar" (limpar PII, manter agregados financeiros); avaliar criptografia do documento.

### S-07 P3 - Equipamento criado antes de validar o cliente (referencia cross-tenant, sem transacao)
- `src/server/orders-actions.ts:39-41`: `customerId` do cliente (UUID) vai para `db.customerDevice.create` antes de `createOrder` checar posse (`orders.ts:26`).
- Exploit: informar UUID de cliente de outro tenant cria linha `CustomerDevice` no tenant do atacante apontando para ele (FK) e depois falha com "Cliente nao encontrado"; deixa linha orfa e vira oraculo de existencia (UUID inexistente gera erro de FK 500, existente gera mensagem de dominio). UUIDs nao adivinhaveis, entao impacto baixo. Viola a regra do ARCHITECTURE.md ("verifique que o pai pertence ao tenant").
- Fix minimo: chamar `getCustomer(db, customerId)` antes do `create` ou mover tudo para uma transacao.

### S-08 P3 - Taxas somadas >= 100% quebram preco/receita
- `src/lib/action.ts:38-41` valida cada percentual ate 100, nao a soma; `settings.ts:44-45`. `pricing.ts:73` (`uber.div(1 - fees/100)` sem a guarda de `priceFromCost`) e `finance.ts:266`.
- Exploit (admin do proprio tenant): `taxPct=60`, `cardFeePct=60`, uber SEPARATE sem markup gera `uberCharge` negativo ou Infinity; total do orcamento cai/erro, e `onQuoteApproved` registra receita principal acima do total (`main = total - negativo`).
- Fix minimo: validar `taxPct + cardFeePct + margem < 100` no `pricingSchema` e usar a mesma guarda no ramo sem markup.

### S-09 P3 - Numeros sem teto e datas invalidas viram erro 500
- `src/lib/action.ts:33-36`, `line-items.ts:23-25,32`: regex `^\d+` sem limite de digitos; colunas sao `Decimal(12,2)`/`(10,2)` (`schema.prisma`). Valor grande causa "numeric field overflow" nao tratado (`wrap`/`guard` relancam).
- Datas `^\d{4}-\d{2}-\d{2}$` aceitam `2026-13-45`: `new Date(...)` invalido em `finance-actions.ts:9,43`, `orders-actions.ts:18`, `quotes-actions.ts:22`, `admin.ts:84` -> excecao do Prisma sem mensagem amigavel. Em producao o Next oculta o detalhe (sem vazamento), mas o log guarda parametros.
- Fix minimo: `.max(12)` digitos / `Decimal.lt(1e10)` e validar data (`parseYmd` ja existe em `finance.ts:83`).

### S-10 P3 - Hooks financeiros fora da transacao e corrida editar x aprovar
- `src/server/quotes.ts:92-95` (`decide` e `onQuoteApproved` separados), `:61-66`, `:97-101`: se o segundo passo falha, o orcamento fica APROVADO sem recebivel (retry de "aprovar" falha pelo status) ou recebivel de revisao antiga fica ativo (dupla contagem).
- `quotes.ts:49-54`: edicao no lugar le `cur` sem trava e atualiza por `id`; uma aprovacao concorrente pode ter o `totalAmount`/itens trocados depois, quebrando o "snapshot imutavel". Janela estreita.
- Fix minimo: `updateMany({ where: { id, status: { in: EDITABLE } } })` no update e rodar o hook na mesma transacao.

### S-11 P3 - Enumeracao de contas e timing
- `auth-actions.ts:33` ("Este e-mail ja tem cadastro") e `settings.ts:84` (qualquer admin testa e-mails de outros tenants via `db.user`, modelo nao escopado). `auth-actions.ts:55`: usuario inexistente retorna sem rodar argon2 (diferenca de tempo mensuravel). Cadastro nao verifica posse do e-mail.
- Fix minimo: hash dummy quando usuario nao existe; mensagem generica no cadastro/convite ou verificacao por e-mail.

### S-12 P3 - Sem controle de papel alem das configuracoes
- Unico `assertAdmin` em `settings.ts:15`. Qualquer `MEMBER` cancela lancamentos (`finance-actions.ts:53`), registra pagamentos, exporta o CSV de ate 5000 linhas (`relatorios/csv/route.ts`), exclui clientes e categorias.
- Exploit: tecnico demitido ainda com senha exporta todo o financeiro; remocao do membro invalida sessoes (`settings.ts:100`), mas ate la nao ha limite.
- Fix minimo: exigir ADMIN para exportacao/cancelamento/exclusao, ou documentar a decisao.

### S-13 P3 - OS pode ter total negativo
- `line-items.ts:25` aceita `unitPrice` negativo (feito para linha de desconto) tambem em `saveItemsAction`; `orders.ts:36,64` nao rejeita total < 0 (so orcamentos checam, `quotes.ts:40`). `onOrderDelivered` ignora total <= 0 (`finance.ts:300`), entao a entrega nao gera cobranca.
- Fix minimo: `if (total.isNeg()) throw DomainError` em `createOrder`/`saveOrderItems`.

### S-14 P3 - Assinatura vencida nao bloqueia acesso
- `auth.ts:53` so olha `tenant.status === "SUSPENDED"`; `Subscription.status/expiresAt` (`admin.ts:76-88`) nunca sao aplicados. Se a cobranca depende disso, e controle de negocio ausente.

### S-15 P3 - Campos de texto sem limite de tamanho
- `auth-actions.ts:24-26` (name, business), `settings.ts:34-40` (name, street, city, zip...), `remarketing-actions.ts` ok. So o limite padrao de 1 MB do corpo da action protege; permite inchar o banco e a UI.
- Fix minimo: `.max(150)` nos campos acima.

---

## INFO

- I-1 `src/lib/db.ts:13-23`: `User`, `Session`, `Tenant`, `TenantUser`, `AuditLog`, `Subscription*` nao estao em `TENANT_MODELS`; hoje os usos passam `tenantId` explicito (`settings.ts:94-102`, `orders/[id]/page.tsx:29` filtra por ids do tenant). `WHERE_OPS` nao cobre `updateManyAndReturn` (nao usado) e escritas aninhadas nao recebem `tenantId`. Risco futuro, sem exploit atual.
- I-2 CSV (`finance.ts:374-377`): prefixo `'` para `= + - @ \t \r` esta correto. Nao cobre `|` nem espaco inicial seguido de formula; so descricao digitada pelo proprio tenant, vitima limitada a membros dele.
- I-3 `quotes.ts:138`: `listQuotes` faz `updateMany` (expira orcamentos) em renderizacao de leitura; efeito colateral em GET, sem risco de seguranca.
- I-4 `.env` existe na raiz (nao li os valores; chaves: DATABASE_URL, TEST_DATABASE_URL, SESSION_COOKIE_NAME, SESSION_DAYS, APP_URL) e esta em `.gitignore:34,44`. A pasta nao e repo git, entao nao ha como confirmar ausencia no historico. Nenhuma variavel `NEXT_PUBLIC_*` nem segredo em codigo cliente.
- I-5 Cookie sem prefixo `__Host-` (`auth.ts:19-25`) e `secure` so em producao; sessoes expiradas nunca sao apagadas do banco.
- I-6 `scripts/db.mjs:7` usa `postgres/postgres` no Postgres embutido de desenvolvimento (porta 5433, local).

## Challenge duty
Nenhuma proposta de `red` recebida.

## File coverage
| file | total lines | reviewed ranges | complete/partial | finding ids | unreviewed | status |
|---|---|---|---|---|---|---|
| src/server/auth.ts | 75 | 1-75 | complete | S-01,S-14,I-5 | - | done |
| src/server/auth-actions.ts | 92 | 1-92 | complete | S-01,S-02,S-11,S-15 | - | done |
| src/lib/action.ts | 43 | 1-43 | complete | S-08,S-09 | - | done |
| src/lib/db.ts | 56 | 1-56 | complete | I-1 | - | done |
| src/lib/br.ts | 53 | 1-53 | complete | - | - | done |
| src/lib/pricing.ts | 99 | 1-99 | complete | S-08 | - | done |
| src/server/finance.ts | 428 | 1-428 | complete | S-08,S-10,I-2 | - | done |
| src/server/finance-actions.ts | 92 | 1-92 | complete | S-09,S-12 | - | done |
| src/server/quotes.ts | 148 | 1-148 | complete | S-10,I-3 | - | done |
| src/server/quotes-actions.ts | 86 | 1-86 | complete | S-09 | - | done |
| src/server/line-items.ts | 80 | 1-80 | complete | S-09,S-13 | - | done |
| src/server/orders.ts | 128 | 1-128 | complete | S-07,S-13 | - | done |
| src/server/orders-actions.ts | 98 | 1-98 | complete | S-07,S-09 | - | done |
| src/server/crm.ts | 155 | 1-155 | complete | S-05,S-06 | - | done |
| src/server/crm-actions.ts | 91 | 1-91 | complete | S-05 | - | done |
| src/server/remarketing.ts | 182 | 1-182 | complete | S-05 | - | done |
| src/server/remarketing-actions.ts | 87 | 1-87 | complete | S-05 | - | done |
| src/server/settings.ts | 103 | 1-103 | complete | S-08,S-11,S-12,S-15 | - | done |
| src/server/settings-actions.ts | 63 | 1-63 | complete | - | - | done |
| src/server/pricing-actions.ts | 34 | 1-34 | complete | - | - | done |
| src/server/admin.ts | 88 | 1-88 | complete | S-09,S-14 | - | done |
| src/server/admin-actions.ts | 56 | 1-56 | complete | - | - | done |
| src/server/tenant.ts | 23 | 1-23 | complete | - | - | done |
| src/app/(app)/relatorios/csv/route.ts | 15 | 1-15 | complete | S-12 | - | done |
| src/app/(app)/relatorios/page.tsx | 73 | 1-73 | complete | - | - | done |
| src/app/(app)/orcamentos/[id]/imprimir/page.tsx | 85 | 1-85 | complete | - | - | done |
| src/app/(app)/orcamentos/[id]/page.tsx | 108 | 1-108 | complete | - | - | done |
| src/app/(app)/orcamentos/share-buttons.tsx | 17 | 1-17 | complete | - | - | done |
| src/app/(app)/remarketing/mensagem/page.tsx | 65 | 1-65 | complete | S-05 | - | done |
| src/app/(app)/remarketing/contact-form.tsx | 22 | 1-22 | complete | S-05 | - | done |
| src/app/(app)/remarketing/page.tsx | ~70 | 1-30 | partial | - | 31-end | partial |
| src/app/(app)/financeiro/page.tsx | ~160 | 1-60 | partial | - | 61-end | partial |
| src/app/(app)/ordens/[id]/page.tsx | ~130 | 1-60 | partial | - | 61-end | partial |
| src/app/(app)/layout.tsx | 30 | 1-30 | complete | - | - | done |
| src/app/(auth)/redefinir-senha/page.tsx | 18 | 1-18 | complete | - | - | done |
| src/app/(app)/error.tsx | 11 | 1-11 | complete | - | - | done |
| src/components/form.tsx | 73 | 1-73 | complete | - | - | done |
| prisma/seed.ts | 72 | 1-72 | complete | S-03 | - | done |
| next.config.ts | 19 | 1-19 | complete | S-04 | - | done |
| .gitignore / .env.example / package.json / docs/ARCHITECTURE.md | - | all | complete | I-4 | - | done |
| .env | - | chaves apenas (valores nao lidos) | partial | I-4 | valores | partial |
| restante de src/app/**, src/components/{shell,ui}.tsx, src/server/dashboard.ts, tests | - | grep de sinks (dangerouslySetInnerHTML, redirect, href, console, raw SQL) | partial | - | leitura linha a linha | NOT VERIFIED |

## Checklist
- Injecao SQL/comando: PASS (unico `$queryRaw` e tagged template parametrizado, `finance.ts:203`).
- XSS / javascript: URL: PASS (sem `dangerouslySetInnerHTML`; wa.me so com digitos).
- Open redirect: PASS.
- CSV injection: PASS (I-2).
- Mass assignment: PASS.
- Dinheiro/Decimal: PASS com ressalvas S-08, S-09, S-13.
- Corridas de dinheiro (pagamento duplo, aprovar/converter duplo): PASS; S-10 como ressalva.
- Rate limiting: FAIL (S-01).
- Cabecalhos de seguranca: FAIL (S-04).
- Segredos/logs: FAIL (S-02, S-03).
- LGPD consentimento server-side: FAIL (S-05).
- Dependencias (`npm audit`): NOT VERIFIED.
