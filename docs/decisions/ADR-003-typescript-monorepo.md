# ADR-003: Monorepo TypeScript

## Status

Aceita.

## Contexto

A plataforma terá web, API, workers, pacotes compartilhados e documentação. A consistência de tipos, validação e permissões é crítica.

## Decisão

Usar pnpm workspaces com Turborepo, TypeScript e pacotes compartilhados.

## Alternativas consideradas

- Repositórios separados por aplicação.
- Monorepo sem orquestrador.
- JavaScript sem TypeScript.

## Consequências positivas

- Compartilhamento de tipos e validações.
- Scripts padronizados.
- Builds e testes por pacote.
- Menos divergência entre aplicações.

## Riscos e consequências negativas

- Exige disciplina em dependências entre pacotes.
- Configuração inicial é maior.
- Builds precisam respeitar ordem de dependências.
