# Diretrizes do Design System Wefit

## Princípios

O Design System Wefit prioriza clareza operacional, consistência, acessibilidade e confiança. Uma
tela deve comunicar o que é funcional, o que está bloqueado e o que ainda é apenas uma estrutura
visual. O visual não pode sugerir que uma escrita ocorreu quando nenhuma integração foi executada.

Os componentes ficam em `packages/ui` e são consumidos pelo Admin sem duplicar regras visuais.
Tokens são definidos em `tokens.css`; estilos dos componentes ficam em `components.css`.

## Fundamentos visuais

- Fundo geral cinza muito claro e superfícies brancas.
- Texto principal quase preto e texto secundário com contraste legível.
- Verde Wefit reservado para marca, ação primária, foco e sucesso.
- Amarelo para atenção/bloqueio, vermelho para erro/perigo e azul para informação/preview.
- Espaçamento baseado na escala `--wf-space-*`.
- Bordas arredondadas discretas e sombras leves; elevação forte apenas em overlays.
- Controles com altura mínima de 44 px.

As cores semânticas devem ser usadas por significado, não por decoração.

## Componentes de aplicação

| Componente                                   | Uso                                                      |
| -------------------------------------------- | -------------------------------------------------------- |
| `AppShell`                                   | Estrutura persistente com sidebar, topbar e workspace    |
| `Sidebar` / `SidebarSection` / `SidebarItem` | Navegação agrupada com estado ativo e badges             |
| `MobileNavigation`                           | Drawer de navegação para tablet e mobile                 |
| `Topbar`                                     | Contexto, busca global e conta                           |
| `PageHeader`                                 | Breadcrumb, eyebrow, título, descrição e ações           |
| `SectionCard`                                | Agrupamento de conteúdo com cabeçalho opcional           |
| `ActionCard`                                 | Entrada para módulo ou ação contextual                   |
| `OrganizationSwitcher` / `UnitSwitcher`      | Identificação explícita do escopo                        |
| `Avatar` / `DropdownMenu`                    | Identidade e ações da conta                              |
| `FormSection`                                | Seção longa de formulário com explicação lateral         |
| `PermissionBoundary`                         | Composição visual condicional; nunca substitui o backend |

## Dados e formulários

| Componente                        | Uso                                                    |
| --------------------------------- | ------------------------------------------------------ |
| `MetricCard`                      | Métrica real com fonte conhecida                       |
| `DataTable`                       | Dados tabulares em desktop                             |
| `MobileDataCards`                 | Representação equivalente da tabela em telas estreitas |
| `FilterBar`                       | Busca, filtros, ordenação e ação de aplicação          |
| `SearchField` / `SearchInput`     | Entrada de pesquisa                                    |
| `Input`, `Select`, `FormField`    | Controles com label, hint e erro                       |
| `Pagination`                      | Navegação entre páginas com links reais                |
| `StatusBadge`                     | Estado curto e semântico                               |
| `Tabs` / `Breadcrumb` / `Stepper` | Navegação local, estrutural e sequencial               |

Labels não devem depender apenas de placeholder. Erros devem estar associados ao campo e anunciados
quando impedirem continuidade.

## Estados

- `LoadingState` ou `Skeleton`: preservar estrutura e informar carregamento.
- `EmptyState`: explicar por que não há dados e oferecer somente uma ação real permitida.
- `ErrorState`: explicar falha e oferecer recuperação segura.
- `LockedModuleState`: explicar plano, entitlement ou unidade ausente.
- `ModuleUnavailableState`: declarar que a integração funcional ainda não existe.

O estado vazio não pode ser usado para mascarar erro. Preview não pode usar toast de sucesso, dados
mockados, totais fictícios ou botões aparentemente ativos.

## Navegação e autorização

O catálogo de módulos transforma o contexto autorizado em seções de navegação. A UI pode ocultar ou
bloquear entradas para reduzir confusão, mas cada endpoint continua validando identidade,
`organizationId`, `unitId`, membership, grant e entitlement aplicáveis.

`PermissionBoundary` serve apenas para composição visual. Nunca é uma barreira de segurança isolada.

## Padrão de página

Uma página administrativa deve seguir esta ordem quando aplicável:

1. `PageHeader` com localização e ação principal;
2. resumo de contexto ou indicadores reais;
3. `FilterBar` antes do conjunto de dados;
4. conteúdo principal em `SectionCard`, `DataTable` ou cards;
5. estado vazio, erro, bloqueio ou preview claramente identificado;
6. paginação ou ações secundárias após o conteúdo.

Evite misturar formulário longo, tabela e confirmação destrutiva na mesma hierarquia sem seções
claras.

## Responsividade

- Acima de 1120 px, priorizar grids de três ou mais colunas somente quando o conteúdo suportar.
- Entre 860 px e 1120 px, usar duas colunas e navegação em sidebar quando houver largura.
- Até 860 px, trocar sidebar por drawer e reduzir a densidade da topbar.
- Até 700 px, substituir tabelas operacionais por `MobileDataCards`.
- Até 560 px, empilhar títulos, ações, cards e formulários.

Não remover dados essenciais no mobile. A representação pode mudar, mas conteúdo e ações permitidas
devem permanecer equivalentes.

## Acessibilidade

- Toda ação interativa deve ser alcançável por teclado.
- Usar `:focus-visible` com `--wf-focus-ring`.
- Ícones decorativos devem usar `aria-hidden`; botões de ícone precisam de nome acessível.
- Status não deve depender só de cor: sempre incluir texto.
- Drawers, modais, estados de erro e carregamento precisam de labels/roles adequados.
- Respeitar `prefers-reduced-motion`.
- Manter ordem de leitura coerente ao reorganizar grids.

## Evolução de componentes

Antes de criar um componente local:

1. verificar se o padrão já existe em `packages/ui`;
2. confirmar que há pelo menos um caso real de uso;
3. definir API pequena e tipada, sem `any`;
4. cobrir o comportamento de maior risco por teste;
5. validar desktop, tablet e mobile;
6. registrar mudança relevante nesta diretriz ou no documento de arquitetura de informação.

Componentes compartilhados não devem carregar regra de negócio, chamar APIs ou conhecer papéis do
produto.
