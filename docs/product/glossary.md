# Glossario

- Organization: tenant principal da plataforma.
- Unit: unidade logica ou fisica pertencente a uma organizacao.
- User: identidade que pode autenticar e acessar o sistema.
- Student: pessoa de dominio cadastrada como aluno, com login opcional por `userId`.
- StudentUnit: vinculo entre aluno e unidade dentro da mesma organizacao.
- Membership: vinculo entre usuario e organizacao.
- Role: agrupamento de permissoes.
- Permission: autorizacao granular para executar uma acao.
- MembershipRole: associacao entre membership, papel e escopo opcional de unidade.
- SubscriptionPlan: plano comercial configuravel.
- Feature: funcionalidade liberavel por plano.
- PlanFeature: configuracao de uma funcionalidade em um plano.
- OrganizationSubscription: assinatura ativa ou historica de uma organizacao.
- AuditLog: registro de operacao sensivel ou relevante.
- Access Gateway: componente local que conecta dispositivos fisicos a nuvem.
- Adapter: implementacao isolada para fornecedor externo ou fabricante.
- Entitlement: autorizacao comercial derivada do plano contratado.
- Tenant: fronteira logica de dados e autorizacao, representada por `Organization`.
