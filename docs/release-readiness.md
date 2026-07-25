# Prontidão do Gate da fundação e onboarding

- Data da revisão: 2026-07-25
- Escopo: fundação multi-tenant, autenticação, contexto, onboarding, rate limit, RLS e Supabase
- Status atual: **condicionado — infraestrutura de banco/Redis precisa ser revalidada**

## Resultado funcional

- Registros `CANCELED` podem ser retomados pelo mesmo ator e pelo mesmo tenant.
- “Continuar depois” preserva etapas salvas e permite retorno.
- Bootstrap e retomada são idempotentes e não criam organização duplicada.
- Plano e tipo de negócio obedecem matriz um-para-um no backend e no frontend.
- O responsável usa obrigatoriamente a identidade autenticada.
- `businessEmail` permanece como contato operacional separado.
- O onboarding possui sidebar própria e o shell administrativo é excluído por pathname.
- Conclusão repetida devolve o resultado concluído.
- Rate limit de produção usa Redis compartilhado com TTL; memória é somente local/teste.
- Logs 5xx não copiam mensagens internas de banco.

## Supabase e segredos

A API valida JWT pelo `SUPABASE_URL` e pelo endpoint JWKS configurado, sem usar
`SUPABASE_SERVICE_ROLE_KEY` no runtime. O admin-web usa somente a chave pública do projeto. Uma
service role, quando necessária para operação controlada, deve existir apenas em variável secreta
do ambiente e nunca no frontend, logs ou repositório.

Variáveis de banco e Supabase não tiveram seus valores impressos durante a validação. Não existe
credencial real nos arquivos alterados. A conexão real com Supabase não estava disponível nesta
estação; portanto, claims, grants e funções do provedor final ainda dependem de staging.

## Validações executadas

| Comando ou verificação                   | Resultado                                                       |
| ---------------------------------------- | --------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`         | Aprovado                                                        |
| `pnpm db:generate`                       | Aprovado                                                        |
| `pnpm db:validate`                       | Aprovado com URL sintética não secreta                          |
| `pnpm format:check`                      | Aprovado                                                        |
| `pnpm lint`                              | Aprovado, 19 tarefas                                            |
| `pnpm typecheck`                         | Aprovado, 19 tarefas                                            |
| `pnpm test:unit`                         | Aprovado, 19 tarefas                                            |
| `pnpm build`                             | Aprovado, 11 tarefas                                            |
| contracts                                | 12 testes unitários aprovados                                   |
| validation                               | 10 testes unitários aprovados                                   |
| config                                   | 12 testes unitários aprovados                                   |
| API                                      | 23 testes unitários aprovados                                   |
| admin-web                                | 20 testes unitários aprovados                                   |
| revisão visual em Chrome, `1440x1100`    | Aprovada, sem sidebar administrativa ou overflow horizontal     |
| revisão visual em Chrome, `390x844`      | Aprovada, sem sidebar administrativa ou overflow horizontal     |
| retomada visual de onboarding `CANCELED` | Aprovada, retornou à etapa 7 e preservou a organização          |
| `pnpm test:integration`                  | Bloqueado: PostgreSQL indisponível em `localhost:55432`         |
| `pnpm test:rls-spike`                    | Bloqueado: PostgreSQL indisponível em `127.0.0.1:55432`         |
| teste Redis real de concorrência e TTL   | Bloqueado: TCP abriu, mas `PING` expirou                        |
| Docker Desktop                           | Bloqueado: `Docker Desktop is unable to start`                  |
| presença de variáveis de banco/Supabase  | Ausentes; somente os nomes foram verificados, sem expor valores |

No navegador em modo de desenvolvimento, o Chrome injetou `caret-color` no checkbox e o React
reportou divergência de hidratação desse atributo. O aviso não apareceu na tela de retomada e não
tem origem no código do componente. A build de produção foi aprovada; a execução visual dela com
`temporary-header` foi corretamente recusada pelo guardrail que proíbe esse adapter em produção.

## Validações bloqueadas

- `pnpm db:test:deploy`;
- `pnpm test:integration`;
- `pnpm test:rls-spike`;
- migrations e grants em PostgreSQL/Supabase de staging;
- isolamento com DSNs reais de runtime/migrator;
- benchmark de policies RLS;
- teste distribuído Redis real.

## Riscos restantes

1. O runtime real ainda precisa provar ausência de superuser, ownership e `BYPASSRLS`.
2. As migrations precisam ser reaplicadas em banco `_test` limpo.
3. Redis precisa ser validado em serviço real e compartilhado entre réplicas.
4. O Supabase de staging precisa validar issuer, JWKS, claims e configuração de chaves.
5. A performance de RLS continua sem baseline representativa.
6. Termos e política de privacidade continuam preliminares; self-service permanece desligado em produção.

## Decisão do gate

O Gate da fundação **não está aprovado de forma incondicional** enquanto as validações bloqueadas
não passarem. Não iniciar financeiro, treinos, agenda, catracas, integrações ou plano Rede completo.

O próximo passo, depois de destravar Docker/staging e obter todos os testes verdes, é iniciar o
CRM de alunos conforme ADR-011.
