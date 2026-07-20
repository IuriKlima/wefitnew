# Escopo do MVP

## Entra no MVP

- Base multi-tenant com `Organization` e `Unit`.
- Identidade, memberships, papeis e permissoes granulares.
- Cadastro de conta com Supabase para ambientes autorizados e confirmacao segura de sessao.
- Onboarding persistente em sete etapas para negocio, unidade, responsavel, funcionamento, plano
  de configuracao, revisao e conclusao.
- Ciclo de vida da organizacao com bloqueio dos modulos ate a conclusao transacional.
- Gestao inicial de alunos conforme ADR-011.
- Estrutura para treinos e avaliacoes, sem fluxo final completo nesta fundacao.
- Estrutura para contratos, planos e pagamentos, sem financeiro completo nesta fundacao.
- Agenda operacional inicial.
- Auditoria de operacoes sensiveis.
- Portal ou aplicativo inicial para alunos em fase futura.
- Preparacao para controle de acesso por gateway local.

## Nao entra nesta fundacao

- Financeiro completo.
- Contratos comerciais completos.
- Treinos completos.
- Aplicativo final.
- Integracao real com catracas.
- Integracao com Wellhub.
- Integracao com TotalPass.
- Inteligencia artificial.
- Telas finais do produto.
- Cobranca, cartao ou contratacao de assinatura durante o onboarding.
- CPF, biometria, prontuario medico ou dados sensiveis de aluno.

## Criterio de corte

O MVP deve priorizar fluxos que validem operacao real com seguranca multi-tenant e permissoes corretas antes de ampliar automacoes e integracoes. Nesta versao, o lancamento e um beta fechado: a flag de self-service permanece desligada em producao ate aprovacao explicita de seguranca, produto, operacao e textos legais.
