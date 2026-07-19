# Entrega e operacao do MVP

## Objetivo

Esta trilha produz imagens imutaveis para API, painel administrativo e workers sem assumir provedor de nuvem. A plataforma de execucao deve fornecer rede privada, TLS no ingress, banco PostgreSQL e Redis gerenciados ou equivalentes, observabilidade e gerenciamento de segredos.

As imagens nao aplicam migrations ao iniciar. A aplicacao de schema e uma etapa controlada, com identidade de migracao separada do runtime.

## Imagens

Os Dockerfiles devem ser construidos a partir da raiz do monorepo:

```bash
docker build -f apps/api/Dockerfile -t gym-platform-api:<versao> .
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<CHAVE_PUBLICA> \
  -f apps/admin-web/Dockerfile \
  -t gym-platform-admin-web:<versao> .
docker build -f apps/workers/Dockerfile -t gym-platform-workers:<versao> .
```

Cada imagem executa como usuario nao-root e usa dependencias travadas pelo `pnpm-lock.yaml`. Nao inclua `.env`, credenciais, cache local, artefatos de testes ou o diretorio `.git` no contexto de build.

`docker-compose.release.yml` e somente uma referencia de topologia. Ele nao sobe banco ou Redis e nao deve ser tratado como configuracao de alta disponibilidade.

## Segredos e configuracao obrigatoria

Forneca as variaveis por um gerenciador de segredos ou injecao protegida da plataforma. Nunca use imagens, argumentos de build, repositorio, logs ou CI para transportar valores secretos. As duas variaveis `NEXT_PUBLIC_*` sao publicas e precisam ser fornecidas tambem no build, pois o Next.js as incorpora ao bundle do navegador.

| Variavel                                                           | Consumidor    | Regra                                                                                                            |
| ------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                     | API           | Credencial de runtime com privilegios minimos; nao pode ser a credencial de migration.                           |
| `DIRECT_URL`                                                       | API, opcional | Conexao direta somente se o provedor exigir.                                                                     |
| `REDIS_URL`                                                        | API e workers | Endpoint privado `rediss://` com usuario e senha; o worker suporta TLS, autenticacao e database numerico na URL. |
| `CORS_ORIGINS`                                                     | API           | Lista explicita de origens HTTPS do painel; nao usar `*`.                                                        |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL`                                | API           | Obrigatorias com `AUTH_ADAPTER=supabase-jwt`; JWKS deve ser acessivel pela rede de runtime.                      |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Painel        | Valores publicos do cliente Supabase, revisados para o ambiente correto.                                         |

Use ainda `SWAGGER_ENABLED=false`, `NODE_ENV=production`, `AUTH_ADAPTER=supabase-jwt`, `ORGANIZATION_SELF_SERVICE_ENABLED=false` e um `RATE_LIMIT_MAX` dimensionado. Nao disponibilize `x-dev-user-id` nem `temporary-header` em producao. O onboarding permanece fechado ate o fluxo de bootstrap possuir policy RLS e testes proprios.

## Sequencia de release

1. Antes de construir ou aplicar migrations, validar as variaveis injetadas em staging sem expor valores:

```bash
$env:RELEASE_ENV = "staging"
node scripts/validate-release-config.mjs
```

O validador falha para adaptadores temporarios, Swagger, onboarding self-service, origem CORS insegura, URLs locais, PostgreSQL sem TLS, Redis sem TLS/credenciais, Supabase/JWKS inconsistentes, tenant administrativo invalido e configuracao incompleta. A saida cita somente nomes de variaveis e regras, nunca valores.

2. Executar todos os gates de CI e publicar imagens com tag imutavel, preferencialmente o SHA do commit.
3. Validar em staging a configuracao de secrets, CORS, login real, RLS/credenciais de runtime e migrations.
4. Executar `pnpm db:deploy` com a identidade de migracao separada e registrar versao, horario e responsavel. Nunca execute `prisma migrate dev` em staging ou producao.
5. Criar o usuario no Supabase e provisionar o primeiro tenant conforme [Provisionamento do beta fechado](./closed-beta-provisioning.md).
6. Subir API e esperar `GET /health/ready` retornar 200; depois subir painel e workers.
7. Executar o smoke externo:

```bash
$env:RELEASE_API_URL = "https://api.exemplo.com"
$env:RELEASE_ADMIN_WEB_URL = "https://admin.exemplo.com"
pnpm smoke:release
```

8. Injetar um token curto do usuario de smoke e executar as leituras autenticadas:

```bash
$env:RELEASE_SMOKE_ACCESS_TOKEN = "<TOKEN_CURTO>"
$env:RELEASE_SMOKE_ORGANIZATION_ID = "<UUID_DO_TENANT>"
$env:RELEASE_SMOKE_FORBIDDEN_ORGANIZATION_ID = "<UUID_DE_OUTRO_TENANT>" # opcional
pnpm smoke:authenticated
```

O smoke autenticado executa somente `GET`, nao imprime o token nem corpos de resposta e bloqueia redirects. Quando o tenant proibido e fornecido, exige HTTP 403 para a leitura cross-tenant. Remova o token do ambiente logo apos a execucao.

9. Validar manualmente as mutacoes de aluno e observar erros, latencia, filas e auditoria durante a janela de estabilizacao.

## Health e observabilidade minima

- API: `GET /health/live` verifica processo; `GET /health/ready` verifica PostgreSQL.
- Painel: `GET /api/health` e o healthcheck publico minimo do painel; o smoke externo o consulta pela rota real.
- Worker: o healthcheck atual confirma conectividade TCP com Redis, enquanto o processo valida TLS e autenticacao ao abrir a fila. A plataforma deve tambem alertar reinicios do container e profundidade/falhas das filas.
- Smoke externo valida API e painel pelo caminho de rede real. O smoke autenticado valida leituras de unidades e alunos, e opcionalmente a negacao cross-tenant, sem modificar dados.

Antes do beta, configure alertas para indisponibilidade, erro 5xx, latencia, saturacao/conexoes do PostgreSQL, indisponibilidade do Redis, reinicios e filas sem consumo. Centralize logs com `correlationId`, removendo segredos e dados pessoais.

## Banco, backups e recuperacao

- Habilite backups automaticos com retencao definida e criptografia em repouso.
- Restrinja restauracoes a operadores autorizados e mantenha evidencias de teste de restore pelo menos antes de cada beta e periodicamente depois dele.
- Defina RPO, RTO, responsaveis e procedimento de incidente antes de cadastrar dados reais.
- Migrations devem ser aditivas e reversiveis por nova migration; nao existe rollback automatico por container.

## Lacunas que impedem producao aberta

- A jornada Bearer esta implementada, mas ainda precisa ser validada em staging contra um projeto Supabase real e usuarios previamente provisionados.
- A fronteira transacional tenant-aware cobre unidades e alunos; onboarding self-service permanece fechado, e papeis/grants ainda precisam de validacao com a credencial real de runtime sem bypass.
- Faltam metricas/tracing exportaveis, alertas e um runbook de incidente completo.
- A decisao de provedor, dominio, TLS, WAF, backup, retencao e suporte operacional continua externa e obrigatoria antes de producao aberta.

## Runbook de falha de configuracao

1. Interromper o deploy antes da migration ou da troca de trafego.
2. Corrigir o secret ou a variavel na plataforma de execucao; nunca copiar o valor para ticket, chat, log ou repositorio.
3. Executar novamente `node scripts/validate-release-config.mjs` e guardar apenas o resultado de sucesso/falha e a versao do release.
4. Se a falha exigir mudanca em RLS/grants ou autenticacao, abrir uma tarefa de implementacao e manter o release bloqueado; nao relaxar o validador.
