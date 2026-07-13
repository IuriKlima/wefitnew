# Plano de spike isolado para RLS

## Status

Proposto. Aguardando aprovacao humana para execucao.

Este plano nao autoriza alterar tabelas reais, schema Prisma ou migrations. Todos os objetos do
spike devem existir somente em banco PostgreSQL descartavel terminado em `_test`, dentro de schema
dedicado.

## Objetivo

Produzir evidencia executavel para as decisoes pendentes do ADR-009:

- contexto transaction-local com Prisma e pool;
- policies IAM sem recursao, acesso indevido ou canal lateral;
- seguranca de eventual `SECURITY DEFINER`;
- vazamentos por integridade referencial e mensagens de erro;
- invariante `Student`/`StudentUnit` no commit;
- separacao efetiva das credenciais de API, worker, migrator e operacao.

O spike nao valida regras de produto nem substitui os testes futuros das tabelas reais.

## Isolamento obrigatorio

- banco exclusivo sugerido: `wefit_rls_spike_test`;
- schema exclusivo: `rls_spike`;
- tabelas reduzidas com nomes proprios do spike, sem apontar para tabelas do schema da aplicacao;
- roles temporarias com sufixo `_spike_test`;
- `application_name=wefit-rls-spike` em todas as conexoes;
- proibido usar `DATABASE_URL`, banco de desenvolvimento ou qualquer DSN de producao;
- setup e rollback abortam se o banco nao terminar em `_test` ou o schema nao for exatamente
  `rls_spike`.

## Matriz de conexoes do spike

| Variavel                      | Papel temporario             | Uso permitido                                               |
| ----------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL_MIGRATOR_TEST`  | `wefit_migrator_spike_test`  | Criar/remover schema, tabelas, roles auxiliares e policies. |
| `DATABASE_URL_API_TEST`       | `wefit_api_spike_test`       | Executar todos os testes de RLS da API.                     |
| `DATABASE_URL_WORKER_TEST`    | `wefit_worker_spike_test`    | Executar cenarios tenant de worker.                         |
| `DATABASE_URL_OPS_READ_TEST`  | `wefit_ops_read_spike_test`  | Testar suporte somente leitura por tenant.                  |
| `DATABASE_URL_OPS_WRITE_TEST` | `wefit_ops_write_spike_test` | Testar escrita operacional limitada ao tenant.              |

As cinco DSNs devem apontar para o mesmo banco descartavel, mas autenticar papeis diferentes.
Nenhuma assertion pode usar superuser, owner de tabela, membro do owner ou `BYPASSRLS`.

## Artefatos previstos

Os scripts abaixo sao parte do plano e ainda nao devem ser criados:

| Ordem | Script previsto                            | Responsabilidade                                                                                       |
| ----- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 00    | `spike/rls/00-assert-environment.mjs`      | Validar nomes de banco/schema, DSNs distintas, `current_user`, memberships e `rolbypassrls=false`.     |
| 01    | `spike/rls/01-setup.sql`                   | Criar schema, roles `NOLOGIN` auxiliares e copias minimas das tabelas IAM, Student e StudentUnit.      |
| 02    | `spike/rls/02-context-and-policies.sql`    | Criar helpers, grants, policies, `ENABLE` e `FORCE RLS` somente nos objetos do spike.                  |
| 03    | `spike/rls/03-seed.sql`                    | Semear dois atores, duas organizacoes, duas unidades e grants globais/restritos com IDs deterministas. |
| 04    | `spike/rls/04-iam-policy-tests.mjs`        | Exercitar Membership, MembershipRole, Role e RolePermission como `wefit_api_spike_test`.               |
| 05    | `spike/rls/05-pool-isolation-tests.mjs`    | Alternar tenants em pool minimo, concorrencia, commit, rollback, timeout e cancelamento.               |
| 06    | `spike/rls/06-security-definer-tests.sql`  | Auditar owner, `search_path`, ACL, ausencia de SQL dinamico e tentativas de escalonamento.             |
| 07    | `spike/rls/07-constraint-leak-tests.mjs`   | Comparar FK, unique, PK, SQLSTATE, mensagens e tempo para linhas ocultas e inexistentes.               |
| 08    | `spike/rls/08-student-invariant-tests.sql` | Provar a constraint trigger diferida no commit e os casos de soft delete/rollback.                     |
| 09    | `spike/rls/09-worker-ops-tests.mjs`        | Validar papeis de worker e operacao em transacoes tenant separadas.                                    |
| 90    | `spike/rls/90-rollback.sql`                | Remover exclusivamente objetos e roles do spike.                                                       |
| 99    | `spike/rls/99-run-all.mjs`                 | Orquestrar setup, testes e rollback, preservando logs e sempre tentando cleanup.                       |

Scripts JavaScript usarao Prisma apenas por queries parametrizadas. Concatenacao de SQL e
`$queryRawUnsafe` ficam proibidas, inclusive no spike, exceto DDL estatico executado pelo script
SQL de migrator.

## Etapas

### 1. Preflight

1. Confirmar que o banco termina em `_test` e nao e o banco usado por desenvolvimento.
2. Confirmar que cada DSN autentica exatamente o papel esperado.
3. Consultar atributos e memberships dos papeis.
4. Falhar se qualquer papel de assertion for superuser, owner, membro do owner ou tiver
   `BYPASSRLS`.
5. Registrar versoes de PostgreSQL, Prisma e configuracao de pool.

### 2. Modelo descartavel

Criar copias minimas de:

- `User`, `Organization`, `Unit`;
- `Membership`, `Role`, `Permission`, `MembershipRole`, `RolePermission`;
- `Student`, `StudentUnit`;
- tabelas auxiliares exclusivas para testes de FK, unique e PK.

Constraints compostas e indices relevantes devem reproduzir o formato atual, mas nenhum objeto
pode referenciar o schema real da aplicacao.

### 3. IAM e recursao

Executar selects isolados e joins usados pela autorizacao para:

- ator global na organizacao;
- ator restrito a uma unidade;
- ator com membership suspensa;
- ator sem membership;
- role global combinada com role por unidade;
- tentativa de usar IDs da segunda organizacao;
- queries sem contexto e com contexto parcial/invalido.

Capturar erros PostgreSQL, planos e resultados. Erro de recursao, consulta que nao termina ou linha
de outro ator/tenant reprova o spike.

### 4. Pool e contexto

Usar transacoes interativas Prisma com pool de tamanho um e depois com concorrencia controlada.
Alternar pelo menos cem operacoes entre duas organizacoes. Cobrir commit, rollback, timeout e
cancelamento. Depois de cada transacao, a proxima deve falhar fechada ate definir seu proprio
contexto.

O teste deve demonstrar que `set_config(..., true)` evita contexto residual, mas nao deve declarar
protecao contra SQL injection. Um caso negativo documentara que SQL executado como `wefit_api`
continua limitado apenas por grants, policies e seguranca da propria query.

### 5. `SECURITY DEFINER`

Se nenhuma funcao `SECURITY DEFINER` for necessaria, registrar a evidencia e pular os testes de
execucao privilegiada. Se for usada, verificar automaticamente:

- owner `NOLOGIN`;
- `search_path` fixo sem `public`;
- `PUBLIC` sem `EXECUTE`;
- grants somente para os papeis previstos;
- ausencia de SQL dinamico no corpo;
- objetos totalmente qualificados;
- falha de shadowing, chamada direta, role switching e argumentos manipulados.

Qualquer escalonamento ou funcao generica reprova o spike.

### 6. Canais laterais de constraints

Para FK, unique e PK, executar pares equivalentes:

- referencia/chave que existe, mas esta oculta por RLS;
- referencia/chave que realmente nao existe;
- referencia/chave valida no tenant atual.

Comparar SQLSTATE, nome de constraint, texto, detalhes, resposta HTTP normalizada e distribuicao de
tempo. O PostgreSQL pode consultar integridade referencial fora da visibilidade RLS; portanto, o
criterio nao e exigir erros internos identicos, mas impedir que a API exponha existencia, valores,
tabela ou constraint de outro tenant. Diferencas inevitaveis devem gerar mitigacao documentada e
teste de regressao antes de aprovar o ADR.

### 7. Invariante `Student`/`StudentUnit`

Implementar apenas nas tabelas descartaveis uma constraint trigger `DEFERRABLE INITIALLY DEFERRED`.
Ela deve verificar no commit que um aluno ativo e nao removido, manipulado com `app.unit_id`, possui
vinculo ativo com essa unidade e organizacao.

Testar sucesso e falha somente no commit, unidade incorreta, organizacao incorreta, remocao do
ultimo vinculo, soft delete coordenado, rollback e duas transacoes concorrentes. Caso a trigger
falhe em seguranca ou consistencia, parar e propor emenda ao ADR para uma operacao atomica revisada;
nao implementar fallback automaticamente.

### 8. Worker e operacao

Executar o mesmo acesso tenant com `wefit_worker_spike_test`, `wefit_ops_read_spike_test` e
`wefit_ops_write_spike_test`. Confirmar que:

- worker nao consegue mudar de tenant dentro da mesma transacao;
- operacao read nao escreve;
- operacao write nao acessa tenant diferente;
- nenhum papel enumera dados de todas as organizacoes;
- cada tentativa negada e correlacionavel nos logs do spike.

## Criterios de sucesso

O spike e aprovado somente se todos os itens forem verdadeiros:

1. Zero linha cross-tenant ou cross-unit retornada ou modificada.
2. Zero recursao, deadlock de policy ou canal lateral IAM nao mitigado.
3. Contexto ausente/invalido falha fechado em todos os papeis runtime.
4. Cem alternancias em pool de uma conexao e os cenarios concorrentes nao vazam contexto.
5. Nenhuma assertion usa superuser, owner ou `BYPASSRLS`.
6. Toda funcao `SECURITY DEFINER`, se existir, cumpre integralmente as regras do ADR.
7. Erros externos de FK, unique e PK nao revelam existencia ou metadados de outro tenant.
8. A trigger diferida aplica o invariante Student/StudentUnit no commit em todos os casos.
9. Worker e operacao permanecem tenant-scoped.
10. Rollback remove todos os objetos do spike e nenhum objeto real aparece no diff de catalogo.
11. Relatorio inclui comandos, versoes, resultados, planos de execucao e riscos residuais.

Qualquer falha reprova o spike e mantem bloqueada a criacao de migrations RLS reais.

## Rollback do spike

O rollback previsto deve:

1. validar novamente banco terminado em `_test` e schema exato `rls_spike`;
2. impedir novas conexoes apenas dos papeis `_spike_test`;
3. encerrar somente sessoes com esses papeis e `application_name=wefit-rls-spike`;
4. remover o schema `rls_spike` e seus objetos;
5. remover grants, objetos possuidos e roles `_spike_test` na ordem segura;
6. confirmar ausencia do schema, policies, funcoes, triggers e roles do spike;
7. falhar sem executar se qualquer objeto alvo nao tiver o prefixo/sufixo esperado.

O rollback nao usa `DROP DATABASE`, nao toca no schema da aplicacao e nao executa limpeza
recursiva fora do banco descartavel explicitamente validado.

## Evidencias de entrega

- log integral de preflight, setup, testes e rollback;
- matriz de casos com resultado esperado/obtido;
- consultas de catalogo comprovando owner, ACL, RLS forced e `rolbypassrls=false`;
- relatorio de constraints e normalizacao de erros;
- resultado da trigger diferida;
- metricas de pool e duracao;
- lista de riscos residuais e recomendacao: aprovar, corrigir e repetir, ou rejeitar.

## Gate posterior

Concluir o spike nao autoriza migration nas tabelas reais. O relatorio deve ser revisado por uma
pessoa responsavel por arquitetura e seguranca. Somente uma aprovacao explicita posterior pode
autorizar o plano de implementacao RLS.
