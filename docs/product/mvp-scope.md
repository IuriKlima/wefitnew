# Escopo do MVP

## Entra no MVP

- Base multi-tenant com `Organization` e `Unit`.
- Identidade, memberships, papéis e permissões granulares.
- Cadastro de conta com Supabase para ambientes autorizados e confirmação segura de sessão.
- Onboarding persistente em sete etapas para negócio, unidade, responsável, funcionamento, plano
  de configuração, revisão e conclusão.
- Ciclo de vida da organização com bloqueio dos módulos até a conclusão transacional.
- Design System Wefit e shell administrativo responsivo.
- Dashboard inicial alimentado por dados reais do CRM de alunos.
- CRM de alunos V1 operacional: lista, busca, filtros, paginação, cadastro, edição, detalhe,
  vínculos de unidade, histórico auditável e ciclo ativo/inativo.
- Auditoria de operações sensíveis.
- Portal ou aplicativo inicial para alunos em fase futura.
- Preparação arquitetural para controle de acesso por gateway local, sem implementação neste sprint.

## Não entra nesta versão

- Financeiro completo.
- Contratos comerciais completos.
- Treinos completos.
- Avaliações físicas completas.
- Agenda operacional.
- Aplicativo final.
- Integração real com catracas ou Edge Agent.
- Integração com Wellhub.
- Integração com TotalPass.
- Inteligência artificial.
- Cobrança, cartão ou contratação de assinatura durante o onboarding.
- CPF, biometria, prontuário médico ou dados sensíveis de aluno.
- Exclusão física ou arquivamento de alunos pelo painel.

## Critério de corte

O MVP prioriza operação real com isolamento de tenant, autorização no backend, auditoria e estados
de interface acessíveis antes de ampliar automações e integrações. O lançamento é um beta fechado:
self-service permanece desligado em produção até aprovação explícita de segurança, produto,
operação, staging e textos legais.
