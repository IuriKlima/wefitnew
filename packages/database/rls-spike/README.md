# Spike isolado de RLS

Este harness cria objetos exclusivamente no schema `rls_spike` de um banco PostgreSQL cujo nome
termine em `_test`. Ele nao altera o schema Prisma, migrations ou tabelas do produto.

## Pre-requisitos

- Node.js, pnpm e dependencias do monorepo instaladas;
- PostgreSQL 17 de teste acessivel;
- `DATABASE_URL_TEST` apontando para o banco descartavel;
- a credencial de `DATABASE_URL_TEST` deve administrar apenas o ambiente de teste e conseguir
  criar roles; nenhuma assertion de RLS usa essa identidade;
- no ambiente local, `pnpm docker:up` disponibiliza `gym_platform_test` em `localhost:55432`.

O harness nao aceita `DATABASE_URL` como fallback e interrompe antes de qualquer DDL quando o
banco nao termina com `_test`.

Exemplo local, usando apenas a credencial de teste ja documentada em `.env.example`:

```powershell
$env:DATABASE_URL_TEST="postgresql://gym_platform:gym_platform_test_password@localhost:55432/gym_platform_test?schema=public"
pnpm test:rls-spike
```

O parametro `schema=public` da conexao nao hospeda os objetos do spike. Todas as tabelas, funcoes,
policies, indices e triggers criados pelo harness ficam qualificados em `rls_spike`.

## Execucao local e CI

```text
pnpm test:rls-spike
```

No CI, injete `DATABASE_URL_TEST` pelo cofre do ambiente. Nao grave a DSN em arquivo versionado.
O mesmo comando executa preflight, setup, seed, assertions, `EXPLAIN ANALYZE` e cleanup.

O setup usa a conexao administrativa somente para DDL e seed. Cada assertion abre uma transacao e
executa `SET LOCAL ROLE` para uma destas roles sem login:

- `wefit_api_spike_test`;
- `wefit_worker_spike_test`;
- `wefit_ops_read_spike_test`;
- `wefit_ops_write_spike_test`;
- `wefit_migrator_spike_test`, apenas no teste especifico de `FORCE RLS` sobre o owner.

`wefit_rls_owner_spike_test` e `NOLOGIN` e possui apenas as funcoes `SECURITY DEFINER` de escopo.
API e worker nao sao membros dela.

## Contexto

Cada transacao define valores locais, sempre com o terceiro parametro de `set_config` igual a
`true`:

```sql
SELECT set_config('app.organization_id', '<uuid>', true);
SELECT set_config('app.unit_id', '<uuid-ou-vazio>', true);
SELECT set_config('app.actor_user_id', '<uuid>', true);
SELECT set_config('app.correlation_id', '<correlation-id>', true);
```

Os helpers usam `current_setting(..., true)`, `NULLIF` e conversao segura para UUID. Contexto
ausente, parcial ou invalido retorna `NULL` e as policies falham fechado.

## Organizacao dos arquivos

- `sql/00-roles-and-schema.sql`: roles `NOLOGIN` e schema descartavel;
- `sql/01-tables.sql`: modelo minimo, constraints e indices;
- `sql/02-context-policies-and-triggers.sql`: helpers, grants, policies e trigger diferida;
- `sql/90-cleanup.sql`: remove apenas `rls_spike`;
- `src/seed.mjs`: dados deterministas de dois tenants;
- `src/database.mjs`: preflight, pool, transacoes e contexto;
- `test/rls-spike.cases.mjs`: matriz automatizada de assertions;
- `run.mjs`: orquestracao e cleanup em `finally`.

## Idempotencia e limpeza

Antes do setup, o harness executa somente:

```sql
DROP SCHEMA IF EXISTS rls_spike CASCADE;
```

O mesmo comando e executado no `finally`, inclusive quando um teste falha. Nao existe `DROP
DATABASE`, reset de `public` ou acesso a tabelas reais. Um snapshot das flags de RLS de todos os
schemas fora de `rls_spike` e comparado antes e depois.

As roles `*_spike_test` sao removidas pelo script de cleanup (`90-cleanup.sql`) para garantir que não deixem resíduos no cluster.

## Limitacao deliberadamente testada

Uma role PostgreSQL pode alterar custom GUCs concedidos a propria sessao. Portanto, SQL arbitrario
executado como `wefit_api` pode redefinir o contexto dentro da transacao. O harness demonstra esse
comportamento. RLS protege contra query esquecida sem filtro, mas nao protege contra SQL injection;
queries parametrizadas, menor privilegio e a fronteira transacional confiavel continuam
obrigatorios.
