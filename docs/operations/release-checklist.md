# Checklist de release do MVP

## Antes da mudanca

- [ ] Escopo do release, risco, responsavel e janela de reversao registrados.
- [ ] Pull request aprovado e CI verde: formatacao, lint, typecheck, build, testes unitarios, integracao e RLS spike.
- [ ] Imagens construidas do commit exato, escaneadas conforme politica da organizacao e publicadas com tag imutavel.
- [ ] `RELEASE_ENV=staging node scripts/validate-release-config.mjs` passou com as variaveis injetadas pela plataforma, sem expor valores em log.
- [ ] Staging executou smoke e a jornada autenticada de aluno/unidade sem vazamento entre tenants.
- [ ] Credenciais de runtime, migration e operacao sao distintas, com menor privilegio e sem `BYPASSRLS` para runtime.
- [ ] `temporary-header` e onboarding self-service nao estao habilitados; Swagger esta desligado; CORS contem somente origens HTTPS esperadas.
- [ ] Backup recente confirmado e restore testado dentro do RTO acordado.
- [ ] Dashboard e alertas de API, banco, Redis, workers e filas ativos; responsavel de incidente de plantao definido.

## Execucao

- [ ] Registrar versao, commit, inicio, responsavel e resultado da migration.
- [ ] Executar `pnpm db:deploy` com credencial de migracao controlada.
- [ ] Subir API e confirmar `GET /health/ready` com HTTP 200.
- [ ] Subir painel e workers; verificar healthchecks dos tres containers.
- [ ] Executar `pnpm smoke:release` contra URLs externas de API e painel.
- [ ] Executar `pnpm smoke:authenticated` com token curto; incluir um tenant proibido quando houver um segundo tenant de teste.
- [ ] Validar login real, autorizacao por organizacao/unidade, criacao/edicao/inativacao de aluno e registro de auditoria.

## Depois da mudanca

- [ ] Observar por toda a janela de estabilizacao: erros 5xx, latencia, logs, conexoes do banco, Redis e filas.
- [ ] Confirmar que nao houve erro de autorizacao inesperado, negacao RLS ou vazamento cross-tenant.
- [ ] Comunicar versao, resultado e pendencias; anexar evidencias ao registro de release.

## Interromper ou reverter se

- [ ] Qualquer smoke ou healthcheck falhar.
- [ ] Login real, permissao, tenant ou auditoria falhar.
- [ ] Erros 5xx, latencia ou falhas de fila ultrapassarem o limite acordado.
- [ ] A migration falhar ou produzir degradacao. Reversao deve usar plano aprovado e nova migration; nunca editar uma ja aplicada.
