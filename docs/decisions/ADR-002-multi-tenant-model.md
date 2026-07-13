# ADR-002: Modelo multi-tenant

## Status

Aceita.

## Contexto

Personal, Academia e Redes precisam compartilhar a mesma plataforma, mas com isolamento de dados e permissões.

## Decisão

`Organization` é o tenant principal. `Unit` pertence a `Organization`. Usuários participam de organizações por `Membership`, com papéis e escopos.

## Alternativas consideradas

- Banco separado por cliente.
- Schema separado por cliente.
- Tenant por unidade.

## Consequências positivas

- Consultas e relatórios consolidados por organização.
- Modelo simples para Personal, Academia e Redes.
- Permissões por unidade continuam representáveis.

## Riscos e consequências negativas

- Toda consulta de negócio deve respeitar `organizationId`.
- Bugs de isolamento podem ser graves.
- Testes de acesso cruzado entre tenants são obrigatórios.
