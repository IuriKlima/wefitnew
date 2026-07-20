# Roadmap

## Fase 0: Hardening da fundacao

- Namespace tecnico `@gym-platform/*`.
- Autenticacao Supabase JWT, com adapter temporario restrito ao desenvolvimento local.
- Descoberta autenticada de contexto multi-academia.
- Contexto autenticado validado com role PostgreSQL restrita e ciclo de vida da organizacao.
- Cadastro Supabase e onboarding guiado persistente, disponiveis apenas em desenvolvimento e testes
  enquanto o rollout publico nao for aprovado.
- Guards globais de autenticacao e autorizacao.
- Health live/ready.
- Constraints multi-tenant criticas.
- Testes unitarios e suite de integracao PostgreSQL.
- CI com lint, typecheck, build e testes.
- Documentacao de ADRs e comandos operacionais.

## Fase 1: Operacao essencial

- Beta fechado com provisionamento controlado e onboarding assistido.
- Gestao de alunos conforme ADR-011.
- Agenda.
- Treinos e avaliacoes em versao inicial.
- Perfis, memberships e permissoes administraveis.
- Auditoria consultavel.

## Fase 2: Comercial e acesso

- Contratos, planos comerciais e pagamentos.
- Controle de acesso com gateway local.
- Adapters para fabricantes de catraca.
- Regras de acesso por contrato e unidade.

## Fase 3: Integracoes

- Wellhub por adapter.
- TotalPass por adapter.
- Webhooks idempotentes.
- Reconciliacao e retentativas de eventos externos.

## Fase 4: Experiencia avancada

- Aplicativo mobile final.
- Indicadores consolidados para redes.
- Automacoes e inteligencia artificial, se houver decisao de produto.

## Fora do escopo atual

Prontuario medico, biometria, CPF, cobranca no onboarding e portal/app final de alunos continuam fora da Fase 1A.
