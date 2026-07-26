# Arquitetura de informação do Admin Wefit

## Objetivo

O Admin Wefit organiza a operação de personal trainers, academias e redes em uma única aplicação
multi-tenant. A navegação apresentada ao usuário é derivada do contexto retornado pelo backend:
organização, unidade ativa, plano efetivo, entitlements e permissões. Nome de papel não concede
acesso por si só.

O catálogo técnico está centralizado em
`apps/admin-web/app/lib/module-catalog.ts`. Ele é a fonte de verdade visual para rótulo, rota,
ícone, grupo, planos compatíveis, permissões, entitlement, escopo e estado de cada módulo.

## Hierarquia de contexto

1. A identidade autenticada seleciona uma organização permitida.
2. O contexto da organização informa lifecycle, membership, grants e assinatura.
3. Quando a operação depende de uma unidade, uma unidade permitida precisa estar selecionada.
4. O backend continua sendo a autoridade final. A navegação apenas evita apresentar caminhos que
   o contexto já informa como inacessíveis.

O escopo organizacional é usado para cadastros e configurações compartilhados. O escopo de unidade
é usado quando a regra depende da operação física, como agenda e controle de acesso.

## Grupos de navegação

| Grupo           | Módulos                               |
| --------------- | ------------------------------------- |
| Visão geral     | Visão geral                           |
| Operação        | Alunos, Agenda                        |
| Comercial       | CRM, Planos, Financeiro               |
| Treinos e saúde | Exercícios, Treinos, Avaliações       |
| Gestão          | Equipe, Unidades                      |
| Acesso          | Controle de acesso                    |
| Administração   | Integrações, Configurações, Auditoria |

Grupos vazios são removidos. Módulos incompatíveis com o plano ou sem a permissão mínima também não
são exibidos. Um módulo compatível e permitido pode aparecer bloqueado quando falta um entitlement
ou a seleção de unidade.

## Rotas e estados do MVP

| Rota              | Escopo              | Planos        | Permissão mínima      | Estado nesta versão                    |
| ----------------- | ------------------- | ------------- | --------------------- | -------------------------------------- |
| `/`               | Organização         | Todos         | Contexto ativo        | Funcional, indicadores reais de alunos |
| `/students`       | Organização/unidade | Todos         | `student:read`        | Funcional                              |
| `/team`           | Organização         | Gym e Network | `membership:manage`   | Preview seguro                         |
| `/units`          | Organização         | Gym e Network | `unit:read`           | Preview seguro                         |
| `/crm`            | Organização         | Gym e Network | `student:read`        | Preview seguro                         |
| `/plans`          | Organização         | Gym e Network | `subscription:read`   | Preview seguro                         |
| `/finance`        | Organização         | Gym e Network | `subscription:read`   | Preview seguro                         |
| `/schedule`       | Unidade             | Todos         | `student:read`        | Preview seguro; exige unidade          |
| `/exercises`      | Organização         | Todos         | `student:read`        | Preview seguro                         |
| `/workouts`       | Organização         | Todos         | `student:read`        | Preview seguro                         |
| `/assessments`    | Organização         | Todos         | `student:read`        | Preview seguro                         |
| `/access-control` | Unidade             | Gym e Network | `student:read`        | Preview seguro; exige unidade          |
| `/integrations`   | Organização         | Gym e Network | `organization:manage` | Preview seguro                         |
| `/settings`       | Organização         | Todos         | `organization:manage` | Preview seguro                         |
| `/audit`          | Organização         | Gym e Network | `audit:read`          | Preview seguro                         |

“Preview seguro” significa que a rota, a hierarquia, os filtros e o comportamento responsivo estão
prontos, mas não executam integração funcional. Botões, busca e filtros ficam desabilitados e a tela
explica essa condição. Não são mostrados registros, métricas, valores financeiros ou confirmações
simulados.

## Regras de plano

- A assinatura ativa define o plano efetivo quando o código é `PERSONAL`, `GYM` ou `NETWORK`.
- Na ausência de assinatura, o tipo da organização é usado como fallback de apresentação.
- Personal mantém a operação individual: alunos, agenda, exercícios, treinos, avaliações e
  configurações compatíveis com as permissões.
- Gym e Network recebem os módulos comerciais, gestão de equipe/unidades, acesso, integrações e
  auditoria quando também possuem os grants necessários.
- Entitlements continuam primários quando presentes. `students.manage`, `units.manage` e
  `access.devices` podem bloquear seus módulos sem depender apenas do plano.

## Estados visuais

- **Disponível:** há backend funcional e o contexto permite o acesso.
- **Preview seguro:** existe estrutura visual, mas a integração será entregue depois.
- **Bloqueado:** o plano/entitlement não habilita o recurso ou falta uma unidade selecionada.
- **Oculto:** plano incompatível ou ausência da permissão mínima.
- **Carregando, vazio e erro:** usam componentes compartilhados e linguagem direta.

O acesso direto a uma rota visualmente bloqueada não expõe dados: a página renderiza apenas a razão
do bloqueio e o contexto mínimo já autorizado.

## Dashboard

O dashboard possui duas camadas:

1. indicadores obtidos pelo endpoint real de resumo de alunos, somente quando `students` está
   disponível;
2. cards dos módulos visíveis no contexto, com badge explícito de Disponível, Preview ou Bloqueado.

Financeiro, CRM e demais módulos futuros não produzem números no dashboard.

## CRM de alunos

O módulo de alunos permanece a referência funcional do MVP. Ele oferece busca, filtros, ordenação,
paginação, cadastro, edição, vínculo com unidades, mudança de status e histórico. Desktop usa tabela;
mobile usa cartões sem remover informação ou ação. Todas as operações continuam passando pelos
endpoints existentes e pela autorização do backend.

## Onboarding

O fluxo mantém a ordem persistida pelo contrato atual:

1. tipo de negócio;
2. dados da empresa;
3. unidade principal;
4. responsável da conta;
5. operação;
6. plano Wefit;
7. revisão.

A evolução visual não reordena etapas porque isso alteraria versões salvas e o contrato da API. O
Stepper compartilhado melhora a leitura no desktop e vira uma faixa horizontal no tablet/mobile.

## Responsividade

- Desktop: sidebar agrupada e recolhível, topbar com contexto e conteúdo em grids.
- Tablet: sidebar em drawer, busca global oculta, grids com duas colunas quando houver espaço.
- Mobile: cabeçalho e ações empilhados, cards em coluna, lista de alunos em cartões e Stepper com
  rolagem horizontal.

O alvo mínimo de controles é 44 px, o foco é visível e animações respeitam
`prefers-reduced-motion`.

## Limites da entrega

Esta expansão não cria migrations, tabelas, RLS, chamadas Supabase diretas, endpoints ou credenciais.
O inventário completo das telas de referência e das decisões de migração está em
`docs/product/ui-migration-map.md`.
