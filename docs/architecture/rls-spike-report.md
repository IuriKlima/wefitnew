# Relatorio do spike isolado de Row Level Security

## Objetivo

Validar, sem tocar nas tabelas reais do Wefit, se PostgreSQL RLS pode adicionar uma camada de
defesa contra queries que esquecam filtros de `organizationId` ou `unitId`.

O spike existe somente no schema descartavel `rls_spike` de um banco terminado em `_test`. O
schema Prisma e as migrations reais permanecem inalterados.

## Estado da execucao

O harness foi implementado, mas os testes PostgreSQL ainda nao foram executados neste ambiente.
O banco de teste em `localhost:55432` nao estava disponivel durante a tarefa. Resultados abaixo
marcados como pendentes nao devem ser interpretados como sucesso.

## Desenho das roles

O spike usa roles de grupo `NOLOGIN` com sufixo `_spike_test`, assumidas por `SET LOCAL ROLE` a
partir da conexao administrativa do banco descartavel.

| Role do spike                | Papel modelado em producao | Responsabilidade                                  |
| ---------------------------- | -------------------------- | ------------------------------------------------- |
| `wefit_migrator_spike_test`  | `wefit_migrator`           | Dona das tabelas e executa somente DDL revisado.  |
| `wefit_api_spike_test`       | `wefit_api`                | DML da API, sem DDL ou atributos administrativos. |
| `wefit_worker_spike_test`    | `wefit_worker`             | Leitura tenant e insert de auditoria por job.     |
| `wefit_ops_read_spike_test`  | `wefit_ops_read`           | Operacao temporaria somente leitura.              |
| `wefit_ops_write_spike_test` | `wefit_ops_write`          | DML operacional ainda limitado pelas policies.    |
| `wefit_rls_owner_spike_test` | `wefit_rls_owner`          | Owner `NOLOGIN` das funcoes `SECURITY DEFINER`.   |

Todas sao configuradas como `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOBYPASSRLS` e
`NOLOGIN`. API e worker nao sao donos das tabelas nem membros do owner das funcoes.

## Matriz de privilegios

| Objeto ou capacidade | Migrator  | API               | Worker        | Ops read | Ops write         | RLS owner            |
| -------------------- | --------- | ----------------- | ------------- | -------- | ----------------- | -------------------- |
| Schema `rls_spike`   | owner     | `USAGE`           | `USAGE`       | `USAGE`  | `USAGE`           | `USAGE`              |
| Tabelas de negocio   | DDL/DML   | DML sujeito a RLS | SELECT        | SELECT   | DML sujeito a RLS | nenhum DML generico  |
| `audit_log`          | DDL/DML   | SELECT/INSERT     | SELECT/INSERT | SELECT   | SELECT/INSERT     | nenhum               |
| IAM                  | DDL/DML   | DML sujeito a RLS | SELECT        | SELECT   | SELECT            | SELECT minimo em IAM |
| Funcoes de contexto  | EXECUTE   | EXECUTE           | EXECUTE       | EXECUTE  | EXECUTE           | EXECUTE              |
| DDL/TRUNCATE         | permitido | negado            | negado        | negado   | negado            | negado               |

O acesso minimo do RLS owner a `membership` e `membership_role` usa policies limitadas ao
`app.organization_id`. Nao existe policy tenant `USING (true)` para essa role.

## Matriz de DSNs esperada

Nenhuma DSN abaixo deve ser versionada com valor real.

| Variavel                     | Identidade esperada                           | Uso                                               |
| ---------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL_API`           | login membro de `wefit_api`                   | API em runtime.                                   |
| `DATABASE_URL_WORKER`        | login membro de `wefit_worker`                | Workers em runtime.                               |
| `DATABASE_URL_MIGRATOR`      | identidade curta do pipeline de migration     | DDL revisado; nunca carregada pela API.           |
| `DATABASE_URL_OPS_READ`      | identidade humana membro de `wefit_ops_read`  | Suporte temporario e tenant-scoped.               |
| `DATABASE_URL_OPS_WRITE`     | identidade humana membro de `wefit_ops_write` | Elevacao aprovada e auditada.                     |
| `DATABASE_URL_API_TEST`      | login de teste membro de `wefit_api_test`     | Assertions RLS futuras com DSN separada.          |
| `DATABASE_URL_WORKER_TEST`   | login de teste membro de `wefit_worker_test`  | Assertions de jobs.                               |
| `DATABASE_URL_MIGRATOR_TEST` | admin do banco efemero terminado em `_test`   | Setup e teardown, nunca assertions de isolamento. |

Nesta primeira automacao, `DATABASE_URL_TEST` e usada apenas para conectar ao banco descartavel e
o harness troca para roles `*_spike_test` com `SET LOCAL ROLE`. Antes de rollout real, o gate do
ADR exige DSNs de teste autenticando identidades distintas.

## Contexto GUC

O harness define, dentro da mesma transacao que executa a operacao:

- `app.organization_id`;
- `app.unit_id`, vazio para escopo organizacional;
- `app.actor_user_id`;
- `app.correlation_id`.

Todos usam `set_config(chave, valor, true)`. Helpers `STABLE` leem com
`current_setting(chave, true)`, convertem vazio para `NULL` e capturam UUID invalido. Sem contexto
valido as policies retornam falso.

O pool de uma conexao alterna cem operacoes entre tenants. Casos separados verificam COMMIT,
ROLLBACK, timeout e nova transacao na mesma conexao. Ha tambem concorrencia controlada com duas
conexoes.

### Limite de seguranca

`set_config(..., true)` protege contra contexto residual e contra uma query comum que esquece o
filtro de tenant. Ele nao protege contra SQL injection executada com `wefit_api`: SQL arbitrario
pode chamar `set_config` novamente dentro da transacao. O harness contem um caso negativo que
demonstra essa capacidade. A origem confiavel do contexto e queries parametrizadas continuam
obrigatorias.

## Tabelas e policies isoladas

O modelo reduzido inclui `organization`, `unit`, `app_user`, `membership`, `role`, `permission`,
`membership_role`, `role_permission`, `student`, `student_unit`, `audit_log` e uma tabela auxiliar
de constraints.

Todas as tabelas usam `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`. Cada tabela
protegida possui policies explicitas para SELECT, INSERT, UPDATE e DELETE, com `USING` e
`WITH CHECK` conforme o comando. `permission` e catalogo global somente leitura para runtimes.

| Grupo               | Predicado principal                                                             |
| ------------------- | ------------------------------------------------------------------------------- |
| Organization        | organizacao corrente e grant global ou grant da unidade corrente.               |
| Unit                | organizacao corrente; com unidade, somente o `unit_id` atual.                   |
| Membership          | apenas membership ativa do ator corrente.                                       |
| MembershipRole      | assignments alcancaveis pelo ator; global ou unidade corrente.                  |
| Role/RolePermission | apenas roles alcancaveis pelos assignments visiveis.                            |
| Student             | tenant atual; com unidade, exige `StudentUnit` ativo da unidade.                |
| StudentUnit         | tenant atual e, quando presente, unidade atual.                                 |
| AuditLog            | tenant atual; escopo de unidade nao recebe eventos globais ou de outra unidade. |

O grafo IAM e aciclico: `RolePermission -> Role -> MembershipRole -> Membership`. As policies de
`Membership` nao consultam tabelas acima na cadeia. Isso evita recursao direta; a prova efetiva
depende da execucao PostgreSQL pendente.

## SECURITY DEFINER

O spike usa duas funcoes `SECURITY DEFINER`, estritamente booleanas:

- `has_global_scope(organization_id)`;
- `can_access_unit(organization_id, unit_id)`.

Ambas possuem owner `wefit_rls_owner_spike_test` `NOLOGIN`, `search_path` fixo em
`pg_catalog, rls_spike`, objetos qualificados, nenhum SQL dinamico e `EXECUTE` revogado de PUBLIC.
Testes de catalogo, argumento cross-tenant, shadowing de `search_path`, membership de role e DDL
indevido estao automatizados.

## Invariante Student/StudentUnit

O schema descartavel implementa uma constraint trigger `DEFERRABLE INITIALLY DEFERRED` em
`student`. Em contexto de unidade, um Student ativo e nao removido deve possuir StudentUnit ativo
para a mesma organizacao e unidade no COMMIT.

Triggers `BEFORE UPDATE/DELETE` em StudentUnit tocam o Student enquanto o vinculo antigo ainda e
visivel, enfileirando a validacao diferida. Os casos incluem:

- Student sem vinculo falhando somente no COMMIT;
- Student e vinculo corretos no mesmo COMMIT;
- unidade errada;
- remocao do ultimo vinculo;
- rollback sem estado parcial;
- transacoes concorrentes;
- soft delete coordenado.

O fluxo coordenado atualiza o Student para inativo/removido antes de encerrar o StudentUnit. A
execucao pendente deve confirmar que essa ordem e suficiente sob concorrencia; falha bloqueia a
trigger como decisao para o schema real.

## Constraints e mensagens de erro

O harness compara FK composta para linha oculta e inexistente, unicidade ativa de StudentUnit,
unique global auxiliar e primary key. O PostgreSQL pode revelar internamente SQLSTATE, constraint
e valores mesmo quando RLS oculta a linha.

O filtro HTTP atual da API responde erro nao tratado como `INTERNAL_SERVER_ERROR`, o que evita
expor detalhes ao cliente. Entretanto, o log atual inclui `exception.message`; uma mensagem Prisma
de constraint pode carregar nomes ou valores e a sanitizacao por chave nao garante remocao desse
texto. Antes de RLS real, deve existir mapeamento explicito de erros Prisma/PostgreSQL e log sem
detalhes de constraint cross-tenant.

## Matriz de testes

| Grupo                | Evidencia automatizada                                                | Resultado atual |
| -------------------- | --------------------------------------------------------------------- | --------------- |
| Roles                | atributos, owner de tabela, grants e FORCE RLS sobre owner            | Pendente        |
| IAM                  | global, A1, suspenso, ator B em A e cadeia RolePermission             | Pendente        |
| Isolamento           | SELECT/INSERT/UPDATE/DELETE entre A e B e ausencia de contexto        | Pendente        |
| Unidade              | exclusivo A1, exclusivo A2, compartilhado e vinculo filtrado          | Pendente        |
| Pool/GUC             | 100 alternancias, commit, rollback, timeout e concorrencia            | Pendente        |
| Integridade          | FK composta, unique ativa, primary key e normalizacao externa         | Pendente        |
| SECURITY DEFINER     | owner, ACL, search_path, argumentos e tentativa de DDL                | Pendente        |
| Trigger diferida     | commit, unidade, ultimo vinculo, rollback, concorrencia e soft delete | Pendente        |
| Worker/operacao      | grants minimos, escrita de auditoria e isolamento tenant              | Pendente        |
| Performance          | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` e indice de StudentUnit     | Pendente        |
| Limite SQL injection | redefinicao deliberada de GUC como `wefit_api`                        | Pendente        |

## Performance

Foram criados indices alinhados aos predicates mais frequentes:

- `student_unit_scope_idx (organization_id, unit_id, student_id)` parcial para vinculos ativos;
- `student_scope_idx (organization_id, status, id)` parcial para alunos nao removidos;
- `audit_log_scope_idx (organization_id, unit_id, created_at)`.

O teste usa `EXPLAIN ANALYZE` e verifica que `student_unit_scope_idx` permanece elegivel. O volume
reduzido nao permite concluir impacto em p95/p99, espera de pool ou tenants desbalanceados. Um
benchmark representativo continua sendo gate de staging.

## Observabilidade proposta

Traces e metricas devem registrar, sem payloads pessoais:

- tipo de processo e role PostgreSQL;
- `organizationId`, `unitId` autorizado e `correlationId`;
- espera do pool, duracao da transacao, commit, rollback e timeout;
- falhas de contexto e SQLSTATE normalizado;
- planos e buffer reads via `pg_stat_statements` em staging.

Um controle de configuracao deve alertar quando:

```sql
SELECT rolname
FROM pg_catalog.pg_roles
WHERE rolname IN ('wefit_api', 'wefit_worker')
  AND (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole);
```

Tambem deve comparar `relrowsecurity` e `relforcerowsecurity` com a lista de tabelas protegidas.

## Rollback

O runner sempre tenta, em `finally`:

```sql
DROP SCHEMA IF EXISTS rls_spike CASCADE;
```

Nao existe `DROP DATABASE`, reset de `public` ou alteracao de migration. Um snapshot das flags de
RLS fora do schema e comparado antes e depois. As roles `*_spike_test` ficam `NOLOGIN` e sem grants
em schemas reais, pois a limpeza autorizada para esta tarefa remove somente o schema dedicado.

## Validacoes do monorepo

| Comando                          | Resultado                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Bloqueado: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` e `ERR_PNPM_META_FETCH_FAIL` ao consultar `registry.npmjs.org`; nenhuma politica foi contornada. |
| `pnpm db:generate`               | Passou com a DSN local de teste apenas para satisfazer a leitura de ambiente do Prisma; nao conectou nem alterou schema.                                 |
| `pnpm db:validate`               | Passou; schema Prisma valido.                                                                                                                            |
| `pnpm lint`                      | Passou em todos os packages.                                                                                                                             |
| `pnpm typecheck`                 | Passou em todos os packages.                                                                                                                             |
| `pnpm test:unit`                 | Passou.                                                                                                                                                  |
| `pnpm test:integration`          | Bloqueado: `PostgreSQL test database is unavailable at localhost:55432`.                                                                                 |
| `pnpm test:rls-spike`            | Fail-safe passou sem variavel; execucao PostgreSQL bloqueada: `PostgreSQL de teste indisponivel em localhost:55432`.                                     |
| `pnpm build`                     | Passou em todos os packages e aplicativos.                                                                                                               |

## Limitacoes e riscos residuais

1. O harness ainda precisa ser executado em PostgreSQL 17 para validar sintaxe e semantica reais.
2. Custom GUC nao e uma fronteira contra SQL injection; SQL arbitrario pode trocar o contexto.
3. Constraints podem revelar existencia internamente, especialmente unique e primary key.
4. Logs da API ainda precisam de normalizacao explicita para erros Prisma/PostgreSQL.
5. A trigger diferida precisa ser provada sob concorrencia e ordem de soft delete.
6. O dataset reduzido nao representa custo de policy em producao.
7. O spike com `SET LOCAL ROLE` nao substitui o futuro teste com DSNs autenticando roles distintas.

## Recomendacao final

**REVISAR.** Nao ativar RLS no schema real ainda.

O desenho e o harness sao suficientes para produzir evidencia, mas nao existe resultado
PostgreSQL executado neste ambiente e permanecem gates de erro de constraint, logs, DSNs separadas
e trigger concorrente. RLS real continua bloqueada ate o comando `pnpm test:rls-spike` passar em
PostgreSQL 17 e o relatorio ser revisado por arquitetura e seguranca.

## Proximo passo recomendado

Executar o harness em CI com PostgreSQL 17 efemero e `DATABASE_URL_TEST` administrativa apenas para
setup. Anexar o log integral, atualizar a matriz com resultados obtidos e submeter a revisao humana.
Nao criar migration RLS real nesse passo.
