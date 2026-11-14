# Super Herói dos PCs

SaaS multi-tenant de gestão para assistências técnicas de informática. Next.js 16, TypeScript strict, Tailwind 4, Prisma 7, PostgreSQL. Arquitetura e contratos: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Contexto de produto: [PRODUCT.md](PRODUCT.md).

## Rodar em desenvolvimento

Requer Node 22+ e npm. Não precisa instalar Postgres: `db:up` sobe um servidor real embutido.

```bash
npm install
npm run db:up          # terminal 1: Postgres em localhost:5433 (deixe aberto)
npm run db:deploy      # aplica as migrations (primeira vez)
npm run db:seed        # super admin + assistência demo (idempotente)
npm run dev            # terminal 2: http://localhost:3000
```

Contas locais do seed (somente desenvolvimento):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Assistência demo | `demo@superheroi.local` | `Demo!12345` |
| Super Admin (`/admin`) | `admin@superheroi.local` | definida em `SEED_ADMIN_PASSWORD`; se vazia, o seed gera uma e mostra uma vez |

Em produção defina `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` antes do seed e troque a senha.

## Verificar

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Os testes rodam contra o Postgres real (`DATABASE_URL`); cada teste cria o próprio tenant.

## Variáveis de ambiente

Ver `.env.example`. `DATABASE_URL` (Postgres), `SESSION_COOKIE_NAME`, `SESSION_DAYS`, `APP_URL` (usada no link de redefinição de senha).

## Produção

1. Postgres gerenciado; `DATABASE_URL` em segredo da plataforma.
2. `npm run db:deploy` no deploy (nunca `migrate dev`).
3. `npm run build && npm start`, atrás de HTTPS (o cookie de sessão é `secure` em produção).
4. Ambientes separados (dev, homologação, produção); nenhuma alteração direta em produção.

## Pendências de configuração externa

- **E-mail:** a recuperação de senha grava o link no log do servidor. Ligar SMTP/Resend em `src/server/auth-actions.ts` (`forgotPasswordAction`).
- **PDF:** orçamento usa a página de impressão `/orcamentos/[id]/imprimir` ("Salvar como PDF" do navegador). Sem biblioteca de PDF no MVP.
- **Fotos do equipamento:** não implementado (precisa de armazenamento S3 compatível).
- **Limite de tentativas:** em memória por processo. Com mais de uma instância, mover para Redis ou banco.
- **Cobrança de assinaturas:** manual pelo Super Admin; sem gateway de pagamento.
- **Row Level Security no Postgres:** o isolamento é aplicado na aplicação (`forTenant`) e testado; RLS fica como camada extra recomendada.
- **Revisão jurídica:** `/privacidade` e `/termos` são modelos.
