# Autenticacao e autorizacao

## Autenticacao

O adapter principal valida JWTs emitidos pelo Supabase. O frontend envia o bearer token apenas pelo servidor, e a API deriva o ator exclusivamente do `sub` autenticado. E-mail e nome usados no bootstrap sao extraidos somente dos claims do JWT ja validado; valores enviados em formulario nao definem a identidade do ator no backend.

No onboarding, o e-mail do responsavel precisa coincidir com a identidade autenticada persistida e
o backend rejeita um e-mail de terceiro. O contato operacional separado e
`Organization.businessEmail`; ele nao modifica `User.email` nem concede acesso.

O cadastro usa o cliente publico do Supabase, exige senha forte e aceite dos textos legais, e devolve resposta generica mesmo quando o provedor rejeita a solicitacao. A rota de callback troca apenas codigos validos por sessao e bloqueia destinos externos.

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
- ciclo de vida `ACTIVE` da organizacao para acessar modulos de negocio.

## Contexto de tenant

`GET /me/context` devolve somente organizacoes, papeis e unidades acessiveis ao ator autenticado. A funcao de banco usada nessa descoberta deriva o usuario do contexto da transacao, sem receber `userId`, `organizationId` ou `unitId` como parametros.

O admin web guarda a selecao ativa em cookies de servidor `HttpOnly`, mas sempre a revalida contra `/me/context`. Uma organizacao ou unidade enviada pelo navegador e apenas uma candidata: o backend continua sendo a autoridade final e impede combinacoes cross-tenant.

Rotas de negocio recebem `organizationId` pela rota e, quando aplicavel, `unitId` no contexto da requisicao. Ambas as informacoes devem ser validadas contra membership, papeis e permissoes do ator.

No CRM de alunos, leituras aceitam o escopo contextual concedido. Criação, edição dos dados
globais, troca de vínculos e mudança de status exigem `student:manage` em escopo organizacional e o
entitlement `students.manage` quando há assinatura efetiva. Enviar um contexto de unidade nunca
promove um grant local para organizacional.

## Separacao de privilegios no banco

A leitura inicial de contexto usa uma funcao `SECURITY DEFINER` com `search_path` fixo. O papel proprietario da funcao tem `BYPASSRLS`, e o papel de runtime recebe somente `EXECUTE` por meio de um papel consumidor sem `BYPASSRLS`. O runtime da API nunca deve receber o papel proprietario nem privilegios amplos de leitura.

O bootstrap guiado segue o mesmo desenho: `start_actor_onboarding` e `resolve_actor_onboarding` pertencem a `wefit_onboarding_owner`, enquanto o runtime recebe somente a membership `wefit_onboarding_consumer`. Depois da descoberta estreita, todas as leituras e mutacoes da tabela de onboarding passam por RLS com `organizationId` definido na transacao.

## Backend como autoridade

O frontend pode esconder acoes indisponiveis, mas nunca deve ser a fonte final de autorizacao. Todas as operacoes sensiveis devem ser validadas no backend e devem receber `correlationId` para auditoria quando disponivel.

## Admin web

`apps/admin-web` usa apenas variaveis de servidor para chamar a API:

- `ADMIN_API_BASE_URL`;
- configuracao publica do Supabase exigida pelo adapter, lida no servidor para criar a sessao;
- `ADMIN_DEV_USER_ID` somente no desenvolvimento local com `ADMIN_AUTH_ADAPTER=temporary-header`.

Nenhum identificador fixo de organizacao ou unidade e aceito em staging ou producao. Tokens e o header temporario sao montados exclusivamente em Server Components e Server Actions; eles nao devem aparecer em variaveis `NEXT_PUBLIC`, em codigo cliente ou em logs.

`SUPABASE_SERVICE_ROLE_KEY` nao e consumida pelo admin-web nem pelo runtime comum da API.
`SUPABASE_ANON_KEY`, quando ainda usada por um projeto legado, deve ser tratada como chave publica;
esta base usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no cliente. Nenhuma das duas substitui o JWT do
usuario ou concede autoridade de tenant.

## Rate limit

O limite global do Fastify e os limites sensiveis do onboarding usam Redis quando
`RATE_LIMIT_STORE=redis`. Producao rejeita qualquer outra configuracao. Os contadores do onboarding
usam chaves separadas por ator e por IP, incremento atomico e TTL de um minuto, portanto multiplas
replicas compartilham o mesmo estado.

O endereço IP só é derivado de cabeçalhos encaminhados quando o proxy de origem está explicitamente
configurado em `TRUSTED_PROXIES`. A configuração aceita IPs e CIDRs, rejeita entradas inválidas e
proíbe wildcard em produção, evitando que o cliente escolha a identidade do bucket de rate limit.

`RATE_LIMIT_STORE=memory` existe somente para desenvolvimento local e testes. Essa implementacao
remove entradas expiradas e possui limite de chaves, mas nao e uma estrategia distribuida.

Falha do Redis nao libera a requisicao por fallback em memoria; a operacao falha fechada para nao
criar bypass entre replicas.

## Saúde e disponibilidade

- `GET /health` e `GET /health/live` são probes de liveness e não consultam dependências.
- `GET /health/ready` consulta PostgreSQL e Redis; retorna indisponível se qualquer dependência
  obrigatória falhar.
- Falhas de dependência não incluem DSN, credenciais ou mensagens internas no payload público.

## Status atual

- `GET /health` e `GET /health/live` sao publicos.
- `GET /health/ready` é público e valida PostgreSQL e Redis.
- `GET /me/context` exige autenticacao e limita o retorno ao ator atual.
- `GET /onboarding/current` e as mutacoes do onboarding derivam o ator do JWT e nao aceitam IDs de tenant como autoridade.
- O bootstrap cria usuario ausente, organizacao e unidade provisorias, membership owner, permissoes padrao e onboarding em uma unica transacao idempotente.
- Cadastro e bootstrap self-service ficam desabilitados por padrao e nao podem ser habilitados em producao nesta versao.
- Rotas de unidade exigem permissoes `unit:read` ou `unit:manage`.
- Leituras de alunos exigem `student:read`; mutações exigem `student:manage`, escopo
  organizacional e entitlement aplicável.
- Logs de auditoria recebem `correlationId` quando disponivel.
