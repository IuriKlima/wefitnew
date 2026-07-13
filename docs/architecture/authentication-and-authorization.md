# Autenticacao e autorizacao

## Autenticacao

A fundacao contem um adapter temporario de autenticacao para desenvolvimento e testes. Ele le apenas o header `x-dev-user-id`, valida UUID e retorna o ator autenticado.

O adapter temporario nao aceita identidade por email, roles, permissoes ou escopo por header. Permissoes sempre devem vir do banco por `Membership`, `Role`, `RolePermission` e `MembershipRole`.

`AUTH_ADAPTER=temporary-header` e bloqueado quando `NODE_ENV=production`. O provedor definitivo de autenticacao deve ser decidido por ADR antes da implementacao real.

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

Rotas sensiveis devem receber `organizationId` pela rota ou por header explicito validado. Quando houver `unitId`, a autorizacao deve validar o escopo de unidade e o banco deve impedir combinacoes cross-tenant.

## Backend como autoridade

O frontend pode esconder acoes indisponiveis, mas nunca deve ser a fonte final de autorizacao. Todas as operacoes sensiveis devem ser validadas no backend.

## Admin web temporario

Enquanto a autenticacao final nao existe, `apps/admin-web` usa apenas variaveis de servidor para chamar a API:

- `ADMIN_API_BASE_URL`;
- `ADMIN_ORGANIZATION_ID`;
- `ADMIN_DEV_USER_ID`;
- `ADMIN_AUTH_ADAPTER=temporary-header`.

O header `x-dev-user-id` e montado exclusivamente em Server Components/Server Actions. Ele nao deve aparecer no browser, em variaveis `NEXT_PUBLIC` ou em codigo cliente. O adapter temporario tambem e bloqueado em producao.

## Status atual

- `GET /health` e `GET /health/live` sao publicos.
- `GET /health/ready` e publico, mas valida PostgreSQL.
- Criacao de organizacao exige usuario autenticado existente e cria papel owner padrao.
- Rotas de unidade exigem permissoes `unit:read` ou `unit:manage`.
- Rotas de alunos exigem permissoes `student:read` ou `student:manage`.
- Logs de auditoria recebem `correlationId` quando disponivel.
