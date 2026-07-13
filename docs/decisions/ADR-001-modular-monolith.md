# ADR-001: Monólito modular

## Status

Aceita.

## Contexto

O produto nasce com três planos, mas todos compartilham domínio, autenticação, permissões, dados de alunos, unidades e integrações futuras.

## Decisão

Construir um monólito modular TypeScript. Módulos serão separados por fronteiras de domínio e aplicação, sem microsserviços nesta fase.

## Alternativas consideradas

- Três sistemas separados por plano.
- Microsserviços desde o início.
- Monólito sem fronteiras explícitas.

## Consequências positivas

- Menor complexidade operacional.
- Evolução rápida do produto.
- Reuso consistente de regras multi-tenant.
- Possibilidade de extração futura por módulo.

## Riscos e consequências negativas

- Fronteiras podem se degradar se módulos acessarem dados internos uns dos outros.
- O deploy é único.
- Exige disciplina em testes e arquitetura.
