# ADR-006: Autenticacao temporaria por header

## Status

Aceita como solucao temporaria.

## Contexto

A fundacao precisa exercitar fluxos autenticados antes da escolha do provedor definitivo de identidade. Ao mesmo tempo, nao e aceitavel simular roles, permissoes ou tenant por headers livres, porque isso mascararia falhas de autorizacao.

## Decisao

Usar um adapter temporario que le apenas `x-dev-user-id`, valida UUID e resolve o ator autenticado.

O adapter:

- nao aceita email por header;
- nao aceita roles por header;
- nao aceita permissoes por header;
- nao aceita tenant por header;
- e bloqueado quando `NODE_ENV=production`.

Autorizacao continua sendo resolvida pelo banco a partir de `User`, `Membership`, `Role`, `RolePermission` e `MembershipRole`.

## Alternativas consideradas

- Deixar endpoints sensiveis publicos durante a fundacao.
- Simular permissoes completas por headers.
- Implementar provedor definitivo antes de validar o dominio.

## Consequencias positivas

- Permite testes de fluxos autenticados sem decidir o provedor final.
- Mantem o backend como autoridade de autorizacao.
- Reduz risco de levar mecanismo temporario para producao.

## Riscos e mitigacoes

- Risco: uso acidental em producao.
  Mitigacao: validacao de ambiente rejeita `AUTH_ADAPTER=temporary-header` em producao.
- Risco: testes criarem usuarios inexistentes.
  Mitigacao: fluxos de criacao de organizacao validam existencia do `User`.
