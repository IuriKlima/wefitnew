# ADR-013: Bootstrap de tenant para beta fechado

## Status

Aceita.

## Contexto

As policies atuais usam `FORCE ROW LEVEL SECURITY` e exigem membership global para inserir uma organizacao. O primeiro tenant ainda nao possui essa membership, criando uma dependencia circular. Abrir o endpoint de onboarding ou relaxar as policies aumentaria a superficie de ataque antes de existir um fluxo de produto completo.

## Decisao

O beta fechado usara um comando operacional local ao monolito para criar, em uma unica transacao:

- usuario de dominio vinculado ao UUID ja criado no Supabase, quando explicitamente solicitado;
- organizacao e unidade principal;
- catalogo minimo de permissoes, papel `owner` e seus grants;
- membership organizacional global;
- evento de auditoria `organization.provisioned`.

O comando exige confirmacao textual, correspondencia exata entre ambiente e nome do banco, TLS e uma credencial administrativa efemera capaz de atravessar `FORCE RLS`. Essa credencial nao e uma identidade de runtime, nao e versionada e deve ser descartada apos cada execucao. O endpoint self-service permanece desabilitado.

## Alternativas consideradas

- Habilitar temporariamente o onboarding HTTP.
- Relaxar a policy de insercao de `Organization`.
- Criar manualmente registros independentes pelo console do banco.
- Adiar o beta ate o fluxo definitivo de onboarding.

## Consequencias

- O bootstrap fica atomico, auditavel, repetivel sob verificacao estrita e restrito a operadores autorizados.
- Existe uma operacao excepcional com credencial elevada; sua curta duracao, destino exato, confirmacao e descarte sao controles obrigatorios.
- O comando nao e solucao de onboarding em producao aberta. Um fluxo definitivo exigira nova decisao, policy RLS e testes proprios, sem distribuir `BYPASSRLS` aos runtimes.
