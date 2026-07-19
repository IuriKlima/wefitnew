# Provisionamento do beta fechado

## Objetivo

Criar o primeiro tenant, a unidade principal, o usuario de dominio, a membership global, o papel `owner`, suas permissoes e o evento de auditoria em uma unica transacao. O onboarding HTTP permanece desabilitado.

## Guardas obrigatorias

- Crie primeiro o usuario no Supabase e use o UUID de `auth.users` como `BETA_PROVISION_ACTOR_USER_ID`.
- Injete `BETA_PROVISION_DATABASE_URL` por gerenciador de segredos. Essa credencial administrativa e efemera, exclusiva da operacao e nunca pode ser reutilizada pela API ou pelo worker.
- A URL deve usar TLS e apontar exatamente para `BETA_PROVISION_EXPECTED_DATABASE`; o nome do banco deve terminar em `_beta`, `_staging` ou `_production`, de acordo com `BETA_PROVISION_ENV`.
- O script exige superuser ou `BYPASSRLS` porque as policies com `FORCE ROW LEVEL SECURITY` negam o bootstrap circular do primeiro tenant. Revogue ou descarte a credencial imediatamente depois.
- Nunca grave a DSN, senha, token ou payload em ticket, chat, log ou historico de shell.

## Execucao

Preencha as variaveis `BETA_PROVISION_*` documentadas em `.env.example`. Use `BETA_PROVISION_CREATE_USER=true` somente quando o registro correspondente ainda nao existir em `User`; nesse caso, nome e e-mail tornam-se obrigatorios.

Primeiro valide ambiente, identidade administrativa e destino sem escrever:

```bash
pnpm db:provision:beta -- --dry-run
```

Para a escrita, defina `BETA_PROVISION_CONFIRM` exatamente igual ao slug e execute:

```bash
pnpm db:provision:beta
```

A saida contem somente ambiente, nome do banco, slug/UUID e indicadores de criacao. A DSN e os dados do usuario nao sao impressos. Uma repeticao so retorna sucesso se o tenant existente corresponder integralmente aos dados declarados e mantiver unidade, owner, permissoes e auditoria; inconsistencias falham sem reparo automatico.

## Evidencias e encerramento

Registre versao do release, operador, horario, ambiente, UUID da organizacao e resultado. Em seguida:

1. Remova a credencial administrativa do job e do ambiente.
2. Confirme que a API usa outra role, sem superuser, `BYPASSRLS`, heranca de role elevada ou propriedade de tabela.
3. Execute os smokes externo e autenticado.
4. Verifique o evento `organization.provisioned` na auditoria.

O mecanismo e deliberadamente limitado ao beta fechado. Antes de onboarding aberto, substitua-o por um fluxo de bootstrap aprovado, com politica RLS e testes de integracao dedicados.
