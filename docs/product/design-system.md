# Design System Wefit

## Objetivo e princípios

O Design System Wefit fornece linguagem visual e componentes reutilizáveis para o admin web. A
interface prioriza clareza, densidade moderada, hierarquia tipográfica, superfícies discretas e
feedback previsível. A referência de qualidade é uma experiência limpa e familiar, sem copiar
componentes, marcas ou assets proprietários de outras empresas.

O pacote técnico é `@gym-platform/ui`. Telas devem consumir seus componentes e tokens antes de
criar estilos locais equivalentes.

## Tokens

Os tokens CSS usam o prefixo `--wf-` e estão agrupados por:

- cores: fundo `#f5f5f7`, superfície branca, texto `#1d1d1f`, verde de marca `#22b573`,
  controle acessível `#107247`, além de estados success, warning, danger e info;
- tipografia: stack aberta com Inter, Geist Sans e fallbacks de sistema; escala de `0.75rem` a
  `clamp(1.85rem, 3vw, 2.5rem)`;
- espaçamento: escala de `0.25rem` a `4rem`;
- raios: `0.625rem`, `0.875rem`, `1.25rem` e pill;
- sombras: níveis small, medium e large;
- movimento: 140 ms e 220 ms, zerados quando o usuário prefere movimento reduzido;
- layout: controle mínimo de 44 px, conteúdo máximo de 1440 px, sidebar de 264/84 px e
  breakpoints de 560, 860 e 1120 px.

Aliases temporários mantêm telas legadas compatíveis durante a migração. Novos componentes devem
usar os tokens `--wf-` diretamente.

## Componentes disponíveis

| Grupo             | Componentes                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Ações e entrada   | `Button`, `IconButton`, `Input`, `Select`, `SearchInput`, `FormField`                       |
| Estrutura         | `AppShell`, `Sidebar`, `Topbar`, `Card`, `MetricCard`                                       |
| Dados e navegação | `DataTable`, `Pagination`, `FilterBar`, `Tabs`, `Breadcrumb`, `StepProgress`, `StatusBadge` |
| Feedback          | `EmptyState`, `ErrorState`, `Skeleton`, `Toast`                                             |
| Overlays          | `Modal`, `ConfirmDialog`, `Drawer`                                                          |
| Apoio visual      | `WefitIcon`                                                                                 |

O `DataTable` preserva a largura do documento e usa rolagem interna em telas estreitas. Sidebar e
topbar formam o shell autenticado; no mobile, a navegação vira drawer.

## Acessibilidade

- contraste dos controles e textos segue alvo WCAG AA;
- controles interativos têm altura mínima de 44 px;
- foco visível usa anel compartilhado;
- ícones sem texto recebem nome acessível;
- tabela recebe caption oculto, paginação e navegações recebem labels;
- modal e drawer prendem o foco, fecham com `Escape`, bloqueiam o scroll de fundo e restauram o
  foco no acionador;
- estados de carregamento, erro e confirmação usam semântica apropriada;
- animações respeitam `prefers-reduced-motion`.

## Autorização e conteúdo

O shell monta a navegação a partir do contexto efetivo de permissões e entitlements. Esconder uma
entrada não autoriza nem bloqueia a API: toda decisão final continua no backend. A busca global
atual direciona ao CRM de alunos.

## Limitações atuais

- notificações estão visíveis apenas como controle desabilitado “em breve”;
- o dashboard possui métricas reais de alunos, mas não apresenta financeiro, treinos ou agenda;
- o conjunto de ícones cobre somente os fluxos entregues nesta versão;
- temas escuro e de alto contraste customizado ainda não fazem parte do MVP.
