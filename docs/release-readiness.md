# Prontidão de release — fundação, Design System e CRM de alunos V1

- Data da revisão: 25 de julho de 2026
- Branch: `feat/foundation-design-students-v1`
- Base imutável da sprint: `bf01ca19`
- Escopo: fundação multi-tenant, onboarding, infraestrutura, Design System, shell administrativo e
  CRM de alunos V1
- Status: **aprovado para staging; beta fechado e produção externa condicionados ao ambiente**

## Resultado entregue

- Onboarding idempotente, retomável e com conclusão transacional revalidada.
- PostgreSQL, Redis, rate limit distribuído, trusted proxies, probes live/ready e RLS cobertos pelo
  gate automatizado.
- Design System Wefit reutilizável em `@gym-platform/ui`, shell responsivo e dashboard com dados
  reais.
- CRM de alunos com lista, busca, filtros, paginação, cadastro, edição, detalhe, unidades, ciclo de
  vida e histórico auditável.
- Escopo organizacional obrigatório para mutações; leituras contextuais por organização/unidade.
- Nenhum módulo de financeiro, treinos, agenda, catracas, Edge Agent, Wellhub ou TotalPass foi
  alterado.
- Nenhuma migration foi necessária para o CRM; o modelo existente aprovado no ADR-011 foi
  suficiente.

## Evidência de commits e CI

| Etapa                | Commit                                     | Evidência                                                                         |
| -------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Fundação             | `d7e884e6395ade07cc402c8edca0eb492d2956df` | gate de CI aprovado                                                               |
| Design System        | `a0347e062eeef5421994d30ee67da8b0755312c9` | gate de CI aprovado                                                               |
| CRM de alunos        | `c5fdf35b558ac853cad5e18a04514dbffa4d8b53` | [CI #13 aprovado](https://github.com/IuriKlima/wefitnew/actions/runs/30176760253) |
| Documentação do gate | `5b21ef413843ebeab8b78cc1b0476ab445da3eef` | [CI #14 aprovado](https://github.com/IuriKlima/wefitnew/actions/runs/30177283670) |

No CI #14, os três jobs concluíram com `success`:

- `Quality and build`: install, Prisma generate/validate, format, lint, typecheck, build e testes
  unitários;
- `PostgreSQL, Redis and RLS`: containers, migrations, integração e spike de isolamento RLS;
- `Production images`: imagens da API, admin web e workers.

## Validações executadas

| Comando ou verificação           | Resultado                                                      |
| -------------------------------- | -------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | aprovado                                                       |
| `pnpm db:generate`               | aprovado                                                       |
| `pnpm db:validate`               | aprovado                                                       |
| `pnpm db:test:deploy`            | aprovado em banco separado terminado em `_test`                |
| `pnpm format:check`              | aprovado                                                       |
| `pnpm lint`                      | aprovado, 19 tarefas                                           |
| `pnpm typecheck`                 | aprovado, 19 tarefas                                           |
| `pnpm test:unit`                 | aprovado, 127 testes Vitest e 6 casos `node:test`              |
| `pnpm build`                     | aprovado, 11 tarefas                                           |
| `pnpm test:integration`          | aprovado, 63 testes em 5 arquivos com PostgreSQL e Redis reais |
| `pnpm test:rls-spike`            | aprovado, 50/50 casos e cleanup confirmado                     |
| Redis concorrente e TTL          | aprovado com serviço real                                      |
| imagens de produção              | API, admin web e workers aprovadas localmente e no CI          |
| `pnpm validate:release` local    | bloqueio seguro esperado sem variáveis de staging/produção     |

Os testes unitários relevantes cobrem validação, permissões, entitlements, contexto, rate limit,
proxies, readiness, Design System, navegação, transporte server-side, formulário e consultas do
CRM. Os testes de integração cobrem onboarding, autorização, isolamento cross-tenant, vínculos,
ciclo de vida, auditoria e RLS.

Na revalidação formal de 25 de julho de 2026, o PostgreSQL de teste permaneceu saudável na porta
prevista `55432`. Como a porta `6379` estava ocupada por outro projeto da estação compartilhada,
o Redis exclusivo do Wefit foi publicado em `16379`, sem interromper serviços alheios. A primeira
execução isolada não alcançou esse endpoint por restrição do sandbox. Duas tentativas do spike
também atingiram o `maxWait` fixo do Prisma enquanto watchers antigos de `pnpm dev` consumiam
recursos. Depois de encerrar somente a árvore de desenvolvimento do Wefit, a execução final
passou 50/50, e o catálogo confirmou zero schemas e zero roles descartáveis remanescentes.

## Revisão visual e acessibilidade

| Fluxo                   | Viewport         | Resultado                                              |
| ----------------------- | ---------------- | ------------------------------------------------------ |
| login e onboarding      | desktop e mobile | aprovado no gate da fundação                           |
| dashboard e shell       | `1440x1100`      | aprovado, sem overflow horizontal                      |
| CRM completo            | `1440x1100`      | aprovado                                               |
| dashboard, drawer e CRM | `390x844`        | aprovado, sem overflow no documento                    |
| tabela mobile           | `390x844`        | rolagem contida no componente                          |
| drawer mobile           | `390x844`        | foco inicial, `Escape` e restauração de foco aprovados |

Foram exercitados no Chrome: redirecionamento de login, dashboard, lista, busca/filtros, cadastro,
detalhe, edição, vínculos, histórico, inativação e reativação. Os fluxos finais ficaram sem erros no
console. O adapter `temporary-header` foi usado apenas em desenvolvimento local, como permitido
pelo guardrail, e continua bloqueado em produção.

## Segurança e dados

- O JWT validado ou o adapter local permitido define o ator; IDs enviados pelo cliente não
  concedem autoridade.
- `TRUSTED_PROXIES` usa allowlist de IP/CIDR e proíbe wildcard em produção.
- Readiness falha fechada quando PostgreSQL ou Redis está indisponível.
- Produção exige Redis; não existe fallback silencioso para memória.
- Mutações do CRM exigem `student:manage` em escopo organizacional e entitlement aplicável.
- RLS, constraints compostas e filtros de aplicação reduzem o risco de acesso cross-tenant.
- Auditoria do CRM persiste apenas ações e metadados seguros, nunca contatos, observações ou
  payloads completos.
- CPF, documentos, biometria e dados médicos não são coletados.
- Nenhuma credencial real foi adicionada; `.env.example` documenta somente nomes e exemplos
  inofensivos.

## Riscos e condicionantes restantes

1. Validar em staging o Supabase real: issuer, JWKS, callback, claims e chaves públicas.
2. Provar com os papéis finais que o runtime não é superuser, owner de tabelas/policies nem possui
   `BYPASSRLS`; o migrator deve permanecer separado.
3. Executar `pnpm validate:release` com os segredos injetados pelo ambiente, sem imprimi-los.
4. Executar smoke test com Redis gerenciado e pelo menos duas réplicas da API.
5. Criar baseline de performance das policies RLS e das buscas do CRM com volume representativo.
6. Aprovar termos, política de privacidade e operação de suporte antes de habilitar self-service.
7. Casos de uso futuros que dependam de aluno ativo devem validar `Student.status` no próprio
   módulo.

## Decisão do gate

O gate de código e infraestrutura da sprint está aprovado. O branch está apto para deploy em
staging. A preparação do beta fechado pode continuar, mas sua liberação depende das validações
reais de identidade, banco, Redis, observabilidade e operação no ambiente.

Não liberar tráfego externo de produção nem habilitar self-service até concluir os itens 1 a 6
acima. Também não ampliar o escopo para financeiro, treinos, agenda, catracas ou integrações antes
da observação do CRM em staging e da revisão do pull request.
