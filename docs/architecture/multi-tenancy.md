# Multi-tenancy

## Modelo

`Organization` e o tenant principal. Toda tabela de negocio deve conter `organizationId` quando o dado pertencer a uma organizacao. `Unit` sempre pertence a uma `Organization`.

```mermaid
erDiagram
  ORGANIZATION ||--o{ UNIT : owns
  ORGANIZATION ||--o{ MEMBERSHIP : has
  USER ||--o{ MEMBERSHIP : joins
  MEMBERSHIP ||--o{ MEMBERSHIP_ROLE : receives
  ROLE ||--o{ MEMBERSHIP_ROLE : grants
```

## Integridade no banco

O schema adiciona constraints para impedir combinacoes cross-tenant em pontos criticos:

- `MembershipRole.organizationId` deve bater com `Membership.organizationId`.
- `MembershipRole.organizationId` deve bater com `Role.organizationId`.
- `MembershipRole.unitId`, quando existir, deve apontar para `Unit` da mesma organizacao.
- `StudentUnit` deve bater `Student.organizationId` e `Unit.organizationId`.
- `AuditLog.unitId`, quando existir, deve apontar para `Unit` da mesma organizacao.
- Assinaturas efetivas (`TRIALING` ou `ACTIVE`) nao podem ter periodos sobrepostos por organizacao.

Essas constraints nao substituem autorizacao em codigo; elas reduzem o blast radius de bugs.

## Unidades

Dados por unidade devem conter `unitId` quando aplicavel. O acesso a uma unidade deve sempre validar se a unidade pertence a organizacao do contexto.

## Memberships

Usuarios podem participar de multiplas organizacoes por memberships. Uma membership pode ter papeis de organizacao e papeis com escopo de unidade.

## Alunos

`Student` pertence a `Organization`. Vinculos com unidades usam `StudentUnit`, com foreign keys compostas para impedir que um aluno de uma organizacao seja associado a uma unidade de outra organizacao.

## Onboarding

`OrganizationOnboarding` sempre contem `organizationId` e referencia o ator que iniciou a configuracao. Existe no maximo um onboarding ativo por organizacao e por ator. O bootstrap cria a organizacao com ciclo `ONBOARDING`, e os modulos de negocio exigem ciclo `ACTIVE`.

O payload persistido possui versao de schema, enquanto a coluna `version` implementa concorrencia otimista. Cada atualizacao filtra simultaneamente por onboarding, organizacao, status, exclusao logica e versao esperada. A conclusao ativa organizacao, atualiza a unidade e encerra o onboarding na mesma transacao.

## Protecao contra acesso cruzado

Consultas devem filtrar por `organizationId`. Identificadores globais como UUID nao sao suficientes para autorizar acesso. Testes de integracao devem cobrir isolamento entre organizacoes.

## RLS

Row Level Security esta ativa e forçada em `OrganizationOnboarding`. A descoberta inicial usa uma funcao privilegiada estreita; depois dela, a API opera com o contexto transacional do ator e da organizacao. A cobertura completa das demais tabelas continua sendo evoluida conforme ADR-009, sem tratar UUID como autorizacao.
