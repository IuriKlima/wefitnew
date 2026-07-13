# ADR-007: Constraints de integridade multi-tenant

## Status

Aceita.

## Contexto

O modelo multi-tenant depende de `organizationId` como fronteira principal. Apenas filtrar em codigo nao e suficiente para impedir que bugs gravem combinacoes inconsistentes, especialmente em tabelas de relacao como `MembershipRole` e trilhas como `AuditLog`.

## Decisao

Adicionar constraints de banco para pontos criticos de isolamento:

- `Unit`, `Membership` e `Role` passam a ter indices unicos compostos por `organizationId` e `id`.
- `MembershipRole` armazena `organizationId` e usa foreign keys compostas para membership, role e unidade.
- `MembershipRole` impede duplicidade do mesmo papel no mesmo escopo.
- `AuditLog` valida que `unitId`, quando presente, pertence a mesma organizacao.
- `OrganizationSubscription` usa status tipado e indice parcial para evitar mais de uma assinatura aberta efetiva por organizacao.

As mudancas foram adicionadas em nova migration. A migration inicial nao deve ser editada.

## Alternativas consideradas

- Confiar apenas em guards e repositories.
- Adicionar RLS imediatamente.
- Separar bancos por tenant.

## Consequencias positivas

- Banco rejeita relacoes cross-tenant invalidas.
- Testes de integracao conseguem validar regras reais de PostgreSQL.
- Auditoria fica mais confiavel ao relacionar unidade e organizacao.

## Riscos e mitigacoes

- Risco: migrations mais complexas.
  Mitigacao: manter migration nova, explicita e testada contra PostgreSQL.
- Risco: dados legados inconsistentes bloquearem deploy futuro.
  Mitigacao: backfills e validacoes devem ser planejados antes de producao.
