# ADR-008: Testes de integracao com PostgreSQL real

## Status

Aceita.

## Contexto

Regras como foreign keys compostas, indices parciais e comportamento transacional nao sao validadas com mocks. A fundacao precisa de testes que provem isolamento de tenant no banco real.

## Decisao

Manter testes unitarios separados de testes de integracao.

Testes de integracao da API usam:

- PostgreSQL real em `DATABASE_URL_TEST`;
- banco com nome terminando em `_test`;
- `ALLOW_TEST_DATABASE_RESET=true` para permitir reset;
- `pnpm db:test:deploy` antes de executar a suite;
- `postgres-test` no Docker Compose local, exposto em `localhost:55432`.

## Alternativas consideradas

- Usar SQLite para testes da API.
- Mockar Prisma em todos os testes.
- Rodar testes de integracao contra o banco de desenvolvimento.

## Consequencias positivas

- Constraints reais sao exercitadas.
- Reset destrutivo fica limitado a banco de teste.
- CI pode reproduzir o ambiente local com service container.

## Riscos e mitigacoes

- Risco: testes de integracao exigem infraestrutura local.
  Mitigacao: `pnpm test` roda unitarios; integracao fica em `pnpm test:integration`.
- Risco: reset em banco errado.
  Mitigacao: checagem de `_test` e `ALLOW_TEST_DATABASE_RESET=true`.
