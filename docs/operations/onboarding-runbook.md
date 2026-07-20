# Runbook do onboarding guiado

## Escopo

Este runbook cobre cadastro e configuracao inicial de uma organizacao Wefit. O fluxo cria uma
organizacao provisoria, unidade principal, membership owner e progresso tenant-aware. Ele nao cria
assinatura, cobranca, cartao, gateway de acesso ou integracao externa.

## Estado seguro

As duas flags devem permanecer ausentes ou com valor `false`:

- `ORGANIZATION_SELF_SERVICE_ENABLED`, na API;
- `NEXT_PUBLIC_ORGANIZATION_SELF_SERVICE_ENABLED`, no painel.

O backend e o painel rejeitam self-service ativo quando `NODE_ENV=production`. Staging continua
obrigatorio antes de qualquer decisao futura de abertura, e nao deve ser usado para contornar essa
protecao.

## Roles e grants

A migration cria:

- `wefit_onboarding_owner`: `NOLOGIN`, proprietaria das funcoes estreitas e com `BYPASSRLS`;
- `wefit_onboarding_consumer`: `NOLOGIN`, `NOBYPASSRLS`, recebe `USAGE` no schema e somente
  `EXECUTE` nas funcoes de bootstrap e descoberta.

A role de runtime da API pode ser membro de `wefit_onboarding_consumer`. Ela nunca pode receber
`wefit_onboarding_owner`, ownership de tabela, superuser ou `BYPASSRLS`. O ator e derivado de
`app.actor_user_id`, preenchido pela API a partir do JWT validado.

## Teste local controlado

1. Confirme que a URL aponta para um banco cujo nome termina em `_test`.
2. Suba o PostgreSQL 17 local e aplique migrations com `pnpm db:test:deploy`.
3. Configure explicitamente as duas flags como `true` somente no processo local/teste.
4. Execute `pnpm test:integration`.
5. Valide cadastro mock/local, retomada, versao concorrente, cancelamento, conclusao e redirecionamento.
6. Execute `pnpm test:rls-spike` e confirme que a role consumer continua sem privilegios elevados.

Nao use credenciais, tokens ou URLs de ambientes reais. Nao execute reset se o nome do banco nao
terminar em `_test`.

## Desativacao imediata

1. Defina as duas flags como `false` ou remova-as.
2. Reinicie API e painel usando o processo normal da plataforma.
3. Confirme que `POST /onboarding/start` retorna 403 e que `/signup` nao chama o Supabase.
4. Preserve onboardings existentes; nao exclua registros nem reverta migration.
5. Investigue por `correlationId` sem copiar payload, e-mail, telefone, CNPJ ou endereco para logs.

Desativar o self-service impede novos bootstraps e conclusoes, mas `GET /onboarding/current` continua
permitindo diagnostico seguro do estado autenticado. Uma recuperacao que exija mudanca de dados deve
usar procedimento aprovado e auditavel.

## Falhas e recuperacao

- Conflito de versao: recarregar o onboarding atual antes de reenviar.
- Sessao expirada: autenticar novamente; nunca aceitar identidade do formulario.
- Estado cancelado ou concluido: nao regredir; encaminhar para suporte ou dashboard.
- Bootstrap incompleto: tratar como incidente, pois a funcao e transacional; nao criar artefatos
  manualmente antes de verificar banco e auditoria.
- Conclusao parcial: interromper rollout e investigar a transacao; nao ativar modulos manualmente.

## Pendencias antes de abertura publica

- validar JWT e callback com projeto Supabase real em staging;
- validar as roles consumer com a credencial real de runtime;
- aprovar termos de uso e politica de privacidade com o juridico;
- definir suporte, monitoramento, alertas e resposta a abuso;
- decidir nomes, limites e precos dos planos;
- definir politica de logo e upload em Storage, que permanece fora do escopo;
- executar os smokes e o checklist de release completo.
