# ADR-009: Row Level Security no PostgreSQL

## Status

Proposta detalhada aguardando aprovacao humana.

Este ADR nao autoriza criar migrations, alterar o schema Prisma ou modificar o acesso a dados.
A ativacao de RLS depende de aprovacao explicita deste desenho e de um plano de implementacao
revisado.

## Contexto

O backend aplica RBAC, escopo de `organizationId` e, quando aplicavel, `unitId` em guards,
services e queries Prisma. Constraints compostas reduzem combinacoes cross-tenant, mas nao
impedem uma query esquecida sem filtro.

O `PrismaService` atual expoe um `PrismaClient` global. Ha operacoes diretas fora de transacao e
transacoes internas em repositories. O worker atual usa apenas BullMQ e ainda nao acessa o
PostgreSQL. Os testes de integracao usam uma unica credencial para migration, reset e exercicio da
API. Esse modelo precisa mudar antes de RLS ser habilitada.

O PostgreSQL aplica politicas por papel e comando. Na ausencia de politica aplicavel, o resultado
e deny-by-default. Donos de tabela normalmente nao sao sujeitos a RLS; por isso as tabelas
protegidas devem usar `FORCE ROW LEVEL SECURITY`. Superusuarios e papeis com `BYPASSRLS` sempre
ignoram RLS e nao podem ser credenciais de runtime.

O Prisma usa pool de conexoes. Uma transacao interativa executa todas as queries no mesmo canal,
o que permite definir contexto local a transacao sem contaminar a proxima requisicao que reutilizar
a conexao.

## Objetivos

- impedir leitura e mutacao cross-tenant mesmo quando uma query de aplicacao esquecer filtros;
- preservar o escopo opcional por unidade;
- falhar fechado quando o contexto estiver ausente, invalido ou incompleto;
- manter RBAC no backend como primeira camada de autorizacao;
- separar credenciais e privilegios de migration, API, workers e operacao;
- funcionar com o pool do Prisma sem contexto residual entre requisicoes;
- permitir rollout e rollback controlados sem criar um runtime com bypass global.

## Fora de escopo

- substituir RBAC por RLS;
- usar um papel de banco por organizacao;
- permitir SQL operacional irrestrito;
- receber o contexto efetivo de tenant diretamente de headers, formularios ou payloads;
- implementar as politicas ou criar migrations nesta etapa.

## Decisao proposta

### 1. Papeis de banco

Todos os papeis devem ser `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE` e `NOBYPASSRLS`, salvo
capacidades DDL explicitamente descritas para o pipeline de migration.

| Papel                | Uso                  | Privilegios propostos                                                                                                                            |
| -------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wefit_schema_owner` | Proprietario tecnico | `NOLOGIN`; possui tabelas, funcoes e politicas. Nunca e usado por API, worker ou pessoa.                                                         |
| `wefit_migrator`     | Pipeline controlado  | Credencial curta do CI; pode assumir `wefit_schema_owner` somente durante DDL revisado. Nao e distribuida aos runtimes e nao recebe `BYPASSRLS`. |
| `wefit_api`          | NestJS API           | DML minimo por tabela e execucao das funcoes auxiliares de contexto; sem DDL, `TRUNCATE` ou troca para papeis privilegiados.                     |
| `wefit_worker`       | BullMQ workers       | Papel separado, com grants apenas para tabelas necessarias aos jobs implementados. Cada job opera em um unico tenant por transacao.              |
| `wefit_ops_read`     | Suporte operacional  | Papel de grupo `NOLOGIN`; identidades humanas individuais recebem acesso temporario e somente leitura, sempre com tenant explicito e auditado.   |
| `wefit_ops_write`    | Correcao operacional | Papel de grupo `NOLOGIN`, elevacao temporaria e aprovada, com DML limitado e politicas tenant iguais as da aplicacao.                            |

Nao havera credencial compartilhada com `BYPASSRLS`, papel de runtime dono de tabela ou politica
tenant `USING (true)`. Operacoes cross-tenant serao decompostas em uma transacao auditada por
organizacao.

Backups, restore e disaster recovery ficam sob a infraestrutura gerenciada, fora das credenciais
de runtime. A verificacao de completude do backup deve usar os controles nativos do PostgreSQL e
do provedor, nao uma credencial da API.

### 2. Contexto confiavel e ciclo da transacao

O contexto efetivo sera representado por valores locais a transacao:

- `app.actor_user_id`: identidade autenticada e verificada pelo adapter de autenticacao;
- `app.organization_id`: organizacao autorizada pelo backend;
- `app.unit_id`: unidade autorizada, ou ausente para escopo organizacional global;
- `app.correlation_id`: identificador tecnico para auditoria e tracing.

Os nomes sao parte da proposta; a implementacao ainda deve definir funcoes SQL auxiliares que
leiam os valores com `current_setting(..., true)`, validem UUID e retornem `NULL` em caso ausente
ou invalido. As politicas devem comparar com esses helpers e, portanto, negar acesso quando o
contexto nao estiver completo.

O fluxo por request sera:

1. O adapter autentica o ator. Em producao, nenhum header temporario participa deste fluxo.
2. `organizationId` e `unitId` vindos da rota ou request sao apenas candidatos nao confiaveis.
3. Uma transacao interativa Prisma e aberta com `wefit_api`.
4. O backend define somente `app.actor_user_id` e `app.correlation_id` como valores locais.
5. A autorizacao consulta apenas memberships e grants pertencentes ao ator autenticado e valida os
   candidatos de organizacao/unidade e a permissao exigida.
6. Somente o resultado autorizado e usado para definir `app.organization_id` e `app.unit_id` com
   escopo local a mesma transacao.
7. O use case e todos os repositories executam com o `TransactionClient` recebido.
8. Commit ou rollback remove automaticamente os valores locais antes de a conexao voltar ao pool.

O contexto sera definido conceitualmente com `set_config(..., true)`, nunca com estado de sessao.
Nao sera permitido executar o setter em uma query e o negocio em outra transacao. Tambem nao sera
permitido usar o client raiz para tabelas protegidas.

Esse mecanismo protege contra uma query esquecida sem filtro de `organizationId` ou `unitId`, pois
a policy continua sendo aplicada pelo PostgreSQL. Ele nao protege contra SQL injection executada
com a credencial `wefit_api`: codigo injetado executa com os grants desse papel e pode tentar ler o
contexto, alterar configuracoes permitidas ou emitir outras queries autorizadas. RLS e defesa em
profundidade, nao substitui queries parametrizadas, validacao de entrada, proibicao de concatenacao
SQL, menor privilegio e correcao de SQL injection.

A implementacao deve introduzir uma fronteira explicita, por exemplo
`withAuthorizedTenantTransaction`, que:

- abre a transacao interativa;
- resolve RBAC e escopo dentro dela;
- define o contexto transaction-local;
- entrega apenas o `TransactionClient` ao callback;
- aplica `maxWait`, `timeout` e isolation level definidos por operacao;
- rejeita transacao aninhada e acesso tenant pelo client raiz.

Repositories que hoje abrem `$transaction` internamente deverao receber a unidade de trabalho ja
aberta. Chamadas de rede, Redis ou APIs externas nao podem ocorrer dentro da transacao.

Um pooler externo deve operar em modo compativel com transacoes e manter a conexao durante toda a
transacao. Statement pooling nao e compativel com este desenho. O projeto deve manter uma unica
instancia de `PrismaClient` por processo.

### 3. Autorizacao antes do contexto tenant

Como a autorizacao precisa consultar IAM antes de `app.organization_id` existir, as politicas de
descoberta devem expor somente dados do proprio ator:

- `Membership`: somente linhas cujo `userId` seja `app.actor_user_id`;
- `MembershipRole`, `Role` e `RolePermission`: somente registros alcancaveis pelos memberships do
  ator;
- `Permission`: leitura do catalogo global;
- `User`: somente a linha do proprio ator.

Depois da autorizacao, as politicas tenant normais passam a restringir todas as queries ao contexto
resolvido. O grafo de politicas de IAM deve ser implementado sem recursao entre policies e validado
com testes PostgreSQL especificos antes do rollout.

E requisito bloqueante executar um spike PostgreSQL com copias descartaveis de `Membership`,
`MembershipRole`, `Role` e `RolePermission`. O spike deve provar que todas as combinacoes de select,
join e subquery usadas pela autorizacao:

- nao produzem recursao de policy;
- nao retornam grants ou memberships de outro ator ou organizacao;
- nao permitem ampliar escopo por `unitId NULL` ou por relacoes indiretas;
- nao criam canal lateral observavel por resultado, erro ou diferenca de comportamento.

Falha em qualquer item impede criar policies nas tabelas reais. O plano do spike fica documentado
em `docs/decisions/ADR-009-rls-spike-plan.md`.

#### Uso de `SECURITY DEFINER`

Helpers e triggers devem ser `SECURITY INVOKER` por padrao. Se o spike demonstrar necessidade de
`SECURITY DEFINER`, todas as regras abaixo sao obrigatorias:

- `search_path` fixo na definicao da funcao, contendo apenas `pg_catalog` e um schema tecnico
  controlado; o schema `public` e proibido;
- owner dedicado `NOLOGIN`, sem uso por API, worker ou pessoas;
- `EXECUTE` revogado de `PUBLIC` e concedido somente aos papeis estritamente necessarios;
- nomes de schema, tabela e coluna qualificados explicitamente;
- SQL dinamico, `EXECUTE` montado por texto e interpolacao de identificadores sao proibidos;
- argumentos e contexto devem ser validados antes de qualquer acesso;
- testes devem tentar sequestro de `search_path`, shadowing de objetos, chamada direta, troca de
  role e escalonamento de privilegio.

Uma funcao `SECURITY DEFINER` nao pode oferecer consulta generica, receber SQL ou funcionar como
bypass global de tenant.

O `AuthorizationGuard` atual nao pode continuar fazendo uma query independente e liberar outra
conexao para o use case. A etapa futura deve mover a resolucao de permissao para a mesma fronteira
transacional do negocio. Metadados de permissao dos decorators podem ser preservados.

### 4. Provisionamento de uma organizacao

O onboarding e uma excecao de bootstrap, nao um bypass:

- o ator deve estar autenticado;
- o backend gera o UUID da nova organizacao, sem aceita-lo do frontend;
- esse UUID e definido como contexto apenas na transacao de provisionamento;
- `Organization.id` e todos os `organizationId` filhos devem coincidir com o UUID gerado;
- a membership inicial deve apontar para `app.actor_user_id`;
- a unidade, role de owner e audit log sao criados na mesma transacao;
- o catalogo `Permission` deve ser populado por migration/catalog operation, e nao por `upsert` no
  onboarding.

O fluxo atual que deixa o PostgreSQL gerar `Organization.id` e faz `Permission.upsert` no
repository tera de ser adaptado antes de RLS.

### 5. Politicas por tabela atual

Todas as policies usam `USING` para visibilidade e alvo de `UPDATE`/`DELETE`, e `WITH CHECK` para
`INSERT`/novo estado de `UPDATE`. Grants continuam limitando quais comandos cada papel pode usar.
As tabelas protegidas devem ter `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`.

| Tabela                     | Escopo e politica proposta                                                                                                                                                                                                                     | Grants de runtime                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Organization`             | `id = app.organization_id`. Insert somente no provisionamento com UUID gerado pelo backend; update apenas da propria organizacao.                                                                                                              | API: select/insert/update; sem delete fisico.                               |
| `Unit`                     | `organizationId = app.organization_id`; com unidade definida, select/update/delete somente quando `id = app.unit_id`. Criacao de unidade exige contexto organizacional, sem `app.unit_id`.                                                     | API: CRUD conforme use cases.                                               |
| `User`                     | Na descoberta, somente o ator. No contexto tenant, somente usuarios ligados a membership da organizacao ou o proprio ator. Escrita de identidade fica negada ate existir fluxo/ADR especifico.                                                 | API: select.                                                                |
| `Membership`               | Descoberta somente do ator; depois, `organizationId = app.organization_id`.                                                                                                                                                                    | API: select e DML somente para fluxos de membership autorizados.            |
| `Role`                     | Descoberta apenas por assignments do ator; depois, `organizationId = app.organization_id`.                                                                                                                                                     | API: select e DML de IAM autorizado.                                        |
| `Permission`               | Catalogo global sem dados tenant. API/worker podem ler todas as chaves; nao ha policy de escrita para runtime. Uma policy global aqui nao constitui bypass tenant porque a tabela nao contem tenant.                                           | API/worker: select. Catalog operation: escrita auditada.                    |
| `MembershipRole`           | `organizationId = app.organization_id`. Em escopo de unidade, leitura permite assignment global (`unitId IS NULL`) e da unidade atual; escrita em contexto de unidade exige `unitId = app.unit_id` e nao pode criar/remover assignment global. | API: select e DML de IAM autorizado.                                        |
| `RolePermission`           | Escopo indireto pelo `Role.organizationId`. Na descoberta, somente roles alcancaveis pelo ator.                                                                                                                                                | API: select e DML de IAM autorizado.                                        |
| `SubscriptionPlan`         | Catalogo global. Leitura para API/worker; escrita somente por catalog operation.                                                                                                                                                               | API/worker: select.                                                         |
| `Feature`                  | Catalogo global. Leitura para API/worker; escrita somente por catalog operation.                                                                                                                                                               | API/worker: select.                                                         |
| `PlanFeature`              | Catalogo global ligado a plano e feature. Leitura para API/worker; escrita somente por catalog operation.                                                                                                                                      | API/worker: select.                                                         |
| `OrganizationSubscription` | `organizationId = app.organization_id`. API de produto e leitura; criacao/alteracao por fluxo de billing ou operacao tenant-scoped.                                                                                                            | API: select. Worker/billing: DML tenant.                                    |
| `Student`                  | `organizationId = app.organization_id`. Com unidade definida, select/update/delete exigem `EXISTS` de `StudentUnit` ativo para `app.unit_id`.                                                                                                  | API: CRUD.                                                                  |
| `StudentUnit`              | `organizationId = app.organization_id`; com unidade definida, `unitId = app.unit_id` para leitura e escrita.                                                                                                                                   | API: CRUD.                                                                  |
| `AuditLog`                 | `organizationId = app.organization_id`; com unidade definida, somente eventos com `unitId = app.unit_id`. Inserts devem coincidir com o contexto; eventos organizacionais podem usar `unitId NULL` apenas em contexto global.                  | API/worker: insert/select; sem update/delete. Retencao por operacao tenant. |

#### Invariante especial de `Student`

Uma policy de insert em `Student` nao consegue verificar um `StudentUnit` que ainda sera criado na
mesma transacao. A decisao proposta e usar uma constraint trigger diferida, executada no commit,
para exigir que todo `Student` ativo e nao removido criado ou mantido em contexto de unidade tenha
um `StudentUnit` ativo para `app.unit_id` na mesma organizacao.

O spike deve provar, de forma testavel, que:

- commit de `Student` sem o vinculo exigido falha;
- commit com vinculo da unidade correta passa;
- vinculo de outra organizacao ou unidade falha;
- remocao do ultimo vinculo exigido falha enquanto o aluno permanecer ativo;
- soft delete coordenado de aluno e vinculos passa;
- rollback nao deixa estado parcial.

Se a trigger diferida nao for viavel ou segura, a unica alternativa aceita e uma operacao atomica
revisada que crie `Student` e `StudentUnit` como uma unica primitiva PostgreSQL. A troca exige
emenda deste ADR e nova aprovacao humana. Somente confiar na ordem do repository nao e suficiente.

### 6. Workers e jobs administrativos

O worker atual nao acessa PostgreSQL; a ativacao inicial nao deve adicionar acesso implicitamente.
Quando um job precisar do banco:

- usara `wefit_worker`, nunca a credencial da API ou migration;
- o job sera criado por backend confiavel depois da autorizacao;
- payload de frontend nao sera transformado diretamente em contexto RLS;
- cada execucao resolvera e validara novamente `organizationId` e `unitId`;
- cada tenant sera processado em transacao separada e curta;
- retries serao idempotentes e preservarao `correlationId`;
- falha de contexto sera terminal ou enviada para dead-letter, sem tentar contexto global.

Jobs periodicos devem ser materializados por tenant quando a configuracao for criada, evitando um
scan global de dados de negocio. Operacoes em varias organizacoes serao fan-out de jobs tenant,
rate-limited e agregados fora das transacoes.

Jobs administrativos exigem identidade humana ou de servico, ticket/motivo, escopo aprovado e
audit log. `wefit_ops_write` nao acessa todas as linhas de uma vez; ele continua sujeito as mesmas
policies de organizacao e unidade.

Backfills de dados nao devem executar DML cross-tenant pelo papel de migration. Serao jobs
idempotentes por organizacao, com checkpoint, metricas e possibilidade de pausa.

### 7. Rollout

1. Aprovar este ADR e o modelo de ameacas.
2. Criar um spike isolado para validar Prisma, pool, `set_config(..., true)`, policy de IAM e
   invariante de criacao de aluno.
3. Separar DSNs e papeis nos ambientes de desenvolvimento/teste, sem habilitar RLS.
4. Introduzir a fronteira transacional e remover acessos tenant pelo client raiz. Manter os filtros
   atuais de `organizationId` e `unitId` como defesa adicional.
5. Criar uma nova migration, apos nova aprovacao, contendo owner, grants, helpers e policies ainda
   sem ativacao nas tabelas.
6. Executar testes com o papel real `wefit_api` e dados de multiplos tenants.
7. Habilitar e forcar RLS em staging por grupos:
   - `Student`, `StudentUnit` e `AuditLog`;
   - `Unit` e `OrganizationSubscription`;
   - IAM (`Membership`, `Role`, `MembershipRole`, `RolePermission`, `User`);
   - `Organization` e catalogos globais.
8. Fazer canary em producao com uma instancia da API, comparar erros, latencia e pool.
9. Expandir a API e, por ultimo, habilitar workers que usam PostgreSQL.

Cada grupo exige gate humano, teste de rollback e observacao antes do proximo.

### 8. Rollback

O caminho preferencial e roll-forward de uma policy defeituosa. Antes da ativacao, a fronteira
transacional pode ser desligada por feature flag porque os filtros atuais permanecem.

Depois de `FORCE ROW LEVEL SECURITY`, rollback exige migration nova e revisada; migrations
aplicadas nunca serao editadas. A migration de contingencia pode desabilitar RLS somente no grupo
afetado enquanto a versao anterior da aplicacao, ainda com filtros explicitos, e restaurada.

Esse rollback e uma reducao temporaria de defesa e exige incidente, auditoria e prazo para
reativacao. Nao sera criado papel alternativo com bypass, DSN privilegiada de fallback ou policy
tenant permissiva global.

### 9. Estrategia de testes

Os testes atuais usam uma unica credencial com acesso de reset e nao comprovam RLS. O ambiente de
teste e os ambientes de runtime devem adotar a matriz abaixo:

| Variavel                      | Papel                                       | Finalidade                                            |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL_API`            | `wefit_api`                                 | API em runtime; DML minimo e RLS obrigatoria.         |
| `DATABASE_URL_WORKER`         | `wefit_worker`                              | Workers em runtime; grants por job e RLS obrigatoria. |
| `DATABASE_URL_MIGRATOR`       | `wefit_migrator`                            | Pipeline de DDL; nunca carregada por API ou worker.   |
| `DATABASE_URL_OPS_READ`       | identidade individual com `wefit_ops_read`  | Operacao temporaria somente leitura e tenant-scoped.  |
| `DATABASE_URL_OPS_WRITE`      | identidade individual com `wefit_ops_write` | Elevacao temporaria de escrita, aprovada e auditada.  |
| `DATABASE_URL_API_TEST`       | `wefit_api_test`                            | Assertions RLS da API em banco terminado em `_test`.  |
| `DATABASE_URL_WORKER_TEST`    | `wefit_worker_test`                         | Assertions RLS de jobs em banco terminado em `_test`. |
| `DATABASE_URL_MIGRATOR_TEST`  | `wefit_migrator_test`                       | Somente setup e teardown DDL do banco efemero.        |
| `DATABASE_URL_OPS_READ_TEST`  | `wefit_ops_read_test`                       | Assertions de operacao somente leitura.               |
| `DATABASE_URL_OPS_WRITE_TEST` | `wefit_ops_write_test`                      | Assertions de operacao de escrita por tenant.         |

As DSNs devem ser distintas e validadas por papel, banco e ambiente antes dos testes. Nenhuma
assertion de RLS pode executar como superuser, owner de tabela, membro de role owner ou papel com
`BYPASSRLS`. `DATABASE_URL_MIGRATOR_TEST` serve apenas para preparar e remover os objetos
descartaveis; resultados de seguranca obtidos por ela nao contam como teste RLS.

Casos obrigatorios:

- metadados: todos os papeis runtime com `rolbypassrls = false`; todas as tabelas previstas com RLS
  enabled e forced;
- fail-closed sem contexto, com UUID invalido e com apenas parte do contexto;
- select, insert, update, delete, upsert, `createMany`, nested include e raw SQL entre duas
  organizacoes;
- isolamento de unidade em `Unit`, `Student`, `StudentUnit` e `AuditLog`;
- descoberta IAM retornando somente memberships e grants do ator;
- ator sem membership, membership suspensa e role revogada durante a operacao;
- provisionamento de organizacao com UUID gerado pelo backend;
- escrita negada nos catalogos globais para API e worker;
- reutilizacao de uma unica conexao do pool alternando tenants e depois de commit/rollback;
- duas requisicoes concorrentes com tenants diferentes e pool pequeno;
- timeout/cancelamento de transacao sem contexto residual;
- worker com payload adulterado, retry e dead-letter;
- operacao humana limitada ao tenant aprovado;
- tentativas de inferencia por foreign key, unique constraint, primary key e mensagens de erro;
- comparacao entre referencia a linha oculta existente e referencia inexistente, incluindo SQLSTATE,
  constraint exposta, corpo HTTP e comportamento temporal;
- normalizacao de erros na API para nao revelar chave, constraint, tabela ou existencia de linha de
  outro tenant;
- `EXPLAIN (ANALYZE, BUFFERS)` das queries criticas com policies ativas.

Os testes de API continuam validando RBAC. Novos testes SQL/Prisma conectados como papeis reais
validam a camada RLS independentemente do frontend e dos filtros dos repositories.

### 10. Desempenho

Impactos esperados:

- um `BEGIN`, definicao de contexto e `COMMIT` para toda operacao tenant, inclusive leitura;
- conexao presa durante a transacao interativa;
- predicates adicionais e subqueries de policy, especialmente em `Student` e IAM;
- menor paralelismo dentro de uma mesma transacao;
- aumento potencial de espera no pool e de timeouts.

Mitigacoes:

- transacoes curtas, sem rede e com timeout explicito;
- dimensionamento de pool por processo e limite global de conexoes;
- helpers de contexto simples e `STABLE`, sem marcar funcoes como `LEAKPROOF`;
- manter predicates alinhados aos indices existentes;
- avaliar um indice parcial ativo em `StudentUnit(organizationId, unitId, studentId)` para a policy
  de alunos;
- revisar indices de IAM com planos reais antes da ativacao;
- benchmark antes/depois com volume representativo e tenants de tamanhos diferentes.

Gates sugeridos para canary: nenhuma regressao de isolamento, erro de pool dentro do SLO e aumento
de p95/p99 aprovado pela equipe. Os valores numericos serao definidos com a baseline do ambiente.

### 11. Observabilidade e auditoria

Metricas e traces devem incluir, sem payloads sensiveis:

- papel de banco e tipo de processo (`api`, `worker`, `ops`);
- `organizationId`, `unitId` quando autorizado e `correlationId`;
- tempo de espera pelo pool, duracao da transacao, commit, rollback e timeout;
- falhas ao resolver contexto e erros PostgreSQL de permissao;
- tamanho de fila, retries e dead-letter por tipo de job;
- latencia e buffer reads das queries criticas via `pg_stat_statements`;
- contagem de operacoes administrativas por tenant e operador.

Alertas de configuracao devem verificar continuamente:

- runtime com `rolsuper` ou `rolbypassrls`;
- tabela prevista sem `relrowsecurity` ou `relforcerowsecurity`;
- grants DDL ou `TRUNCATE` para API/worker;
- transacoes longas e saturacao do pool;
- uso de client raiz em modulo tenant detectado por teste arquitetural.

Health checks podem continuar executando `SELECT 1` sem contexto, pois nao leem tabela de negocio.
Logs nunca devem registrar tokens, credenciais, payloads completos ou valores de metadata de
auditoria.

## Alternativas consideradas

- manter apenas guards, constraints e filtros de repository;
- banco separado por tenant;
- schema separado por tenant;
- papel PostgreSQL por tenant;
- contexto em nivel de sessao;
- credencial de runtime com `BYPASSRLS`;
- um job administrativo global que varre todas as tabelas.

As quatro ultimas alternativas foram rejeitadas por risco de vazamento no pool, complexidade
operacional ou criacao de um caminho de bypass global.

## Consequencias

### Positivas

- defesa adicional contra query sem filtro;
- isolamento uniforme para API, workers e operacao;
- falha fechada por padrao;
- auditoria mais clara de contexto e papel de banco.

### Negativas

- refatoracao transversal do acesso Prisma;
- toda operacao tenant passa a exigir transacao;
- maior complexidade em onboarding, IAM, testes e jobs;
- custo de pool e latencia que precisa ser medido;
- policies passam a ser parte critica da autorizacao e do processo de migration.

## Riscos em aberto para aprovacao

1. Provar a constraint trigger diferida de `Student`/`StudentUnit`; eventual troca pela operacao
   atomica exige emenda e aprovacao.
2. Validar que as policies de descoberta IAM nao possuem recursao ou canal lateral relevante.
3. Definir isolamento e timeouts padrao por tipo de operacao Prisma.
4. Definir SLO e limite aceitavel de regressao no pool e na latencia.
5. Definir o mecanismo de identidade individual e elevacao temporaria para operacao.
6. Definir como o provedor de backup comprova completude com RLS ativa.

## Gate de aprovacao

Nenhuma migration de RLS deve ser criada antes de aprovacao humana deste ADR e dos seis riscos em
aberto. A aprovacao deste documento ainda nao autoriza rollout em producao; cada grupo de tabelas
tera gate separado.

## Referencias

- PostgreSQL, Row Security Policies: https://www.postgresql.org/docs/17/ddl-rowsecurity.html
- PostgreSQL, `ALTER TABLE ... FORCE ROW LEVEL SECURITY`:
  https://www.postgresql.org/docs/current/sql-altertable.html
- PostgreSQL, `set_config` e `current_setting`:
  https://www.postgresql.org/docs/17/functions-admin.html
- Prisma ORM v6, transacoes:
  https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions
- Prisma ORM v6, connection pool:
  https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool
