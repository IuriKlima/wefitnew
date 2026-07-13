# Gym Management Platform

Fundacao tecnica de uma plataforma SaaS multi-tenant para gestao de profissionais, academias e redes de academias.

## Objetivo

Construir uma unica plataforma com funcionalidades liberadas por plano contratado: Personal, Academia e Redes. A arquitetura parte de um monolito modular para reduzir complexidade inicial e preservar a possibilidade de separar modulos no futuro, se houver necessidade comprovada.

## Arquitetura resumida

- `Organization` e o tenant principal.
- `Unit` pertence a uma `Organization`.
- Usuarios participam de organizacoes por `Membership`.
- Papeis e permissoes sao granulares e podem ter escopo de unidade.
- O backend e a autoridade final para autenticacao, autorizacao e entitlements.
- Planos e funcionalidades sao configuraveis por dados, nao por limites comerciais hardcoded.
- Integracoes externas e catracas devem usar adapters isolados.

## Requisitos locais

- Node.js 22 ou superior.
- pnpm 10 ou superior.
- Docker com Docker Compose para PostgreSQL, Redis e testes de integracao.

No Windows PowerShell, use `pnpm.cmd` caso `pnpm` seja bloqueado pela politica de execucao.

## Instalacao

```bash
pnpm install
pnpm db:generate
```

Copie `.env.example` para `.env` e ajuste somente valores locais. Nao versionar `.env`.

## Variaveis principais

- `DATABASE_URL`: conexao PostgreSQL de desenvolvimento.
- `DATABASE_URL_TEST`: conexao PostgreSQL exclusiva para testes de integracao; o banco deve terminar com `_test`.
- `REDIS_URL`: conexao Redis.
- `CORS_ORIGINS`: origens permitidas separadas por virgula. `*` nao e aceito com credentials.
- `SWAGGER_ENABLED`: habilita Swagger da API; padrao ligado fora de producao.
- `AUTH_ADAPTER`: `temporary-header` apenas para desenvolvimento/teste; producao deve usar provider externo.
- `ALLOW_TEST_DATABASE_RESET`: deve ser `true` para permitir reset em testes de integracao.

## Infraestrutura local

```bash
pnpm docker:up
pnpm db:migrate
pnpm db:test:deploy
```

O Compose sobe dois bancos separados:

- desenvolvimento: `localhost:5432/gym_platform_dev`
- integracao: `localhost:55432/gym_platform_test`

Se existir volume antigo de outro nome de projeto, ele nao e reutilizado automaticamente. Exporte qualquer dado local importante antes de remover volumes antigos.

## Execucao das aplicacoes

```bash
pnpm dev
```

Portas padrao:

- Admin web: `http://localhost:3000`
- API: `http://localhost:3333`
- Swagger: `http://localhost:3333/docs`

## Autenticacao temporaria

Durante a fundacao, a API usa `AUTH_ADAPTER=temporary-header` fora de producao. Envie `x-dev-user-id` com um UUID de `User` existente. O adapter nao aceita email, roles ou permissoes por header.

Em `NODE_ENV=production`, `temporary-header` e rejeitado na validacao de ambiente.

## Migrations

- Desenvolvimento: `pnpm db:migrate`
- Ambiente controlado: `pnpm db:deploy`
- Banco de teste: `pnpm db:test:deploy`
- Formatar schema Prisma: `pnpm db:format`
- Validar schema Prisma: `pnpm db:validate`

Nunca altere migrations ja aplicadas. Mudancas posteriores devem entrar em nova migration.

## Testes e verificacao

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
```

`pnpm test` executa apenas unitarios. `pnpm test:integration` aplica migrations no banco definido por `DATABASE_URL_TEST` e recusa reset se o nome do banco nao terminar com `_test`.

## Estrutura de pastas

```text
apps/
  admin-web/
  api/
  student-app/
  access-gateway/
  workers/
packages/
  database/
  auth/
  permissions/
  contracts/
  validation/
  config/
  observability/
  ui/
  eslint-config/
  typescript-config/
docs/
  architecture/
  product/
  decisions/
```

## Documentacao disponivel

- Visao de produto: `docs/product/product-vision.md`
- Planos e entitlements: `docs/product/plans-and-entitlements.md`
- Arquitetura: `docs/architecture/system-overview.md`
- Autenticacao e autorizacao: `docs/architecture/authentication-and-authorization.md`
- Multi-tenancy: `docs/architecture/multi-tenancy.md`
- Supply chain: `docs/architecture/supply-chain.md`
- ADRs: `docs/decisions`
- Questoes pendentes: `docs/product/open-questions.md`

## Decisoes pendentes

Nao foram decididos nome comercial, identidade visual, precos, limites comerciais, provedor definitivo de autenticacao, provedor de pagamento, infraestrutura final, politica de inadimplencia, fabricante de catraca, formato final do app mobile ou armazenamento de biometria.
