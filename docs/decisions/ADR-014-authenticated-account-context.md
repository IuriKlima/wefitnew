# ADR-014: Descoberta autenticada de contexto da conta

## Status

Aceita, pendente de validacao da migration em staging.

## Contexto

O painel precisa descobrir todas as organizacoes e unidades permitidas para o usuario autenticado. As policies atuais exigem `app.organization_id` para ler `Membership`, mas o backend ainda nao conhece esse identificador no inicio da sessao. Aceitar candidatos enviados pelo navegador criaria uma dependencia circular e uma superficie de enumeracao de tenants.

## Decisao

Criar `GET /me/context`, sem body, query ou parametros de tenant. O endpoint usa somente o `actor.userId` validado pelo adapter Supabase e abre uma transacao com `app.actor_user_id` local.

Uma nova migration aditiva cria:

- `wefit_context_reader`: role `NOLOGIN`, com `BYPASSRLS`, acesso de leitura apenas ao grafo minimo de conta e ownership exclusivo da funcao;
- `wefit_context_consumer`: role `NOLOGIN`, sem privilegios elevados, que recebe somente `EXECUTE`;
- `public.get_actor_context()`: funcao sem argumentos, `SECURITY DEFINER`, `search_path` fixo e resultado limitado ao ator presente na GUC da transacao.

A role real da API deve ser membro apenas de `wefit_context_consumer`. Nunca pode ser membro de `wefit_context_reader`. O runtime continua sem superuser, `BYPASSRLS` ou ownership de tabelas.

O painel guarda a selecao ativa em cookies HTTP-only, mas revalida organizacao e unidade contra `/me/context` antes de cada chamada. Cookies e formularios sao candidatos, nunca autoridade de autorizacao.

## Alternativas consideradas

- Enviar `organizationId` e `unitId` pelo navegador para descobrir o contexto.
- Colocar organizacoes em `app_metadata` do JWT e trata-las como fonte final.
- Usar uma credencial de runtime com `BYPASSRLS`.
- Manter um unico tenant configurado por variavel de ambiente.

## Consequencias

- Usuarios podem alternar entre academias e unidades sem ampliar o escopo concedido no banco.
- A funcao privilegiada aumenta a superficie critica e exige revisao da migration e teste com a role real em staging.
- O endpoint nao cria usuario, membership, organizacao ou unidade.
- Testes locais cobrem o mapeamento e a autenticacao, mas nao substituem a validacao da funcao e dos grants no provedor final.
