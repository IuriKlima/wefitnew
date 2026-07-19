# Autenticacao e autorizacao

## Autenticacao

O adapter principal valida JWTs emitidos pelo Supabase. O frontend envia o bearer token apenas pelo servidor, e a API deriva o ator exclusivamente do `sub` autenticado.

O adapter `temporary-header` existe somente para desenvolvimento e testes locais. Ele le `x-dev-user-id`, valida UUID e e bloqueado quando `NODE_ENV=production`. Identidade, papeis, permissoes e escopo nunca podem ser aceitos por headers controlados pelo cliente.

## Autorizacao

Permissoes devem ser granulares. Papeis sao agrupadores administraveis de permissoes, nao a regra final.

Uma decisao de autorizacao deve considerar:

- usuario autenticado;
- organizacao do contexto;
- membership ativa;
- papeis vinculados;
- permissoes vinculadas;
- escopo de unidade quando aplicavel;
- entitlements do plano quando a acao depender de funcionalidade contratada.

## Contexto de tenant

`GET /me/context` devolve somente organizacoes, papeis e unidades acessiveis ao ator autenticado. A funcao de banco usada nessa descoberta deriva o usuario do contexto da transacao, sem receber `userId`, `organizationId` ou `unitId` como parametros.

O admin web guarda a selecao ativa em cookies de servidor `HttpOnly`, mas sempre a revalida contra `/me/context`. Uma organizacao ou unidade enviada pelo navegador e apenas uma candidata: o backend continua sendo a autoridade final e impede combinacoes cross-tenant.

Rotas de negocio recebem `organizationId` pela rota e, quando aplicavel, `unitId` no contexto da requisicao. Ambas as informacoes devem ser validadas contra membership, papeis e permissoes do ator.

## Separacao de privilegios no banco

A leitura inicial de contexto usa uma funcao `SECURITY DEFINER` com `search_path` fixo. O papel proprietario da funcao tem `BYPASSRLS`, e o papel de runtime recebe somente `EXECUTE` por meio de um papel consumidor sem `BYPASSRLS`. O runtime da API nunca deve receber o papel proprietario nem privilegios amplos de leitura.

## Backend como autoridade

O frontend pode esconder acoes indisponiveis, mas nunca deve ser a fonte final de autorizacao. Todas as operacoes sensiveis devem ser validadas no backend e devem receber `correlationId` para auditoria quando disponivel.

## Admin web

`apps/admin-web` usa apenas variaveis de servidor para chamar a API:

- `ADMIN_API_BASE_URL`;
- configuracao publica e secreta do Supabase exigida pelo adapter;
- `ADMIN_DEV_USER_ID` somente no desenvolvimento local com `ADMIN_AUTH_ADAPTER=temporary-header`.

Nenhum identificador fixo de organizacao ou unidade e aceito em staging ou producao. Tokens e o header temporario sao montados exclusivamente em Server Components e Server Actions; eles nao devem aparecer em variaveis `NEXT_PUBLIC`, em codigo cliente ou em logs.

## Status atual

- `GET /health` e `GET /health/live` sao publicos.
- `GET /health/ready` e publico, mas valida PostgreSQL.
- `GET /me/context` exige autenticacao e limita o retorno ao ator atual.
- Criacao de organizacao exige usuario autenticado existente e cria papel owner padrao.
- Rotas de unidade exigem permissoes `unit:read` ou `unit:manage`.
- Rotas de alunos exigem permissoes `student:read` ou `student:manage`.
- Logs de auditoria recebem `correlationId` quando disponivel.
