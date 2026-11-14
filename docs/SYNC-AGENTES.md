# Sincronização entre agentes (atualizado em 2026-11-14)

Leia antes de mexer no banco, em testes, em auth ou em validação. Sem segredos neste arquivo.

## Banco de dados: agora é o Neon
- `.env` `DATABASE_URL` aponta para o Neon (projeto `spring-heart-43399280`, branch `production`). **Não é mais o Postgres local.**
- `DATABASE_URL_UNPOOLED` é usada só por `prisma migrate` (`prisma.config.ts`). O app usa a pooled.
- As 2 migrations (`init`, `remove_service_orders`) já foram aplicadas no Neon (22 tabelas).
- **Nunca rode seed, `drop-demo`, scripts de teste ou `db:seed:volume` com o `.env` atual**: eles escreveriam no banco real. Para dev local, sobrescreva `DATABASE_URL` na linha de comando.
- Testes: `vitest.config.ts` agora exige `TEST_DATABASE_URL` (Postgres local, porta 5433) e **recusa** qualquer URL `neon.tech`. Se a migration nova não estiver no banco de teste local: `DATABASE_URL=<url de teste> DATABASE_URL_UNPOOLED=<url de teste> npx prisma migrate deploy`.
- `neon.ts` declara só Postgres. Neon Auth fica desligado de propósito (o app tem login próprio em `src/server/auth.ts`). Não ligue `auth: true`.
- Uma nova migration que apague dados no Neon exige backup antes.

## Super Admin
- Existe exatamente 1 Super Admin no Neon (o dono do projeto). Nenhum outro caminho do app concede `isSuperAdmin`. Não crie outro.
- `prisma/seed.ts` em produção exige `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD`; sem default conhecido.
- A senha não deve ser copiada para arquivos, commits, logs ou mensagens entre agentes.

## Correções de segurança (branch `sec/2026-11-14`, nada commitado)
- Login: tempo de resposta igualado (anti-enumeração); limites em login, cadastro, esqueci-senha (por IP e por conta, resposta silenciosa) e redefinição. Mapa de limites com teto e remoção de IP antes de conta (`src/server/auth.ts`).
- Entradas: tetos de dígitos em `moneyStr`/`pctStr`/itens, total máximo `MAX_MONEY` (`line-items.ts`, `quotes.ts`), `ymd()` em `src/lib/action.ts` (datas reais, 1900-2999), tamanhos máximos nos formulários de cadastro e configurações.
- `src/lib/db.ts` `forTenant`: `updateManyAndReturn` filtrado por empresa; `update` não muda `tenantId`.
- Não remova esses limites nem os testes em `tests/input-limits.test.ts` e `tests/tenant-isolation.test.ts`.

## Conflitos já vistos
- Outra sessão refatorou `quotes.ts` (removeu ordens de serviço). As linhas de `MAX_MONEY` em `quotes.ts` foram preservadas; mantenha.
- Relatórios dos validadores: `.security-audit/2026-11-14/` (`verifier.md`, `verifier-round2.md`).

## Pendências abertas
- Limitador em memória e IP por `x-forwarded-for`: resolver com Redis e proxy real.
- Sem tela de troca de senha; recuperação por e-mail ainda sem provedor.
- Decisões de negócio: permissões do MEMBER, bloqueio por assinatura vencida, CSP `script-src` com nonce.

## Requisito de produto
- O sistema será um PWA nativo (instalável, mobile-first). Service worker, se existir, nunca cacheia páginas autenticadas, dados de empresa/cliente nem server actions: só assets estáticos. Não aumentar SESSION_DAYS sem avisar. Não criar service worker sem alinhar com os outros agentes.
