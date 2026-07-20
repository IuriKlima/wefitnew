# ADR-015: Onboarding guiado e transacional da organizacao

- Status: Aceito
- Data: 2026-07-19
- Decisores: arquitetura e produto Wefit

## Contexto

O beta fechado adotou provisionamento operacional, mas o MVP precisa permitir que uma conta autenticada e elegivel configure a propria operacao. O fluxo deve criar um tenant provisoriamente sem aceitar `organizationId`, `unitId`, usuario, papel ou permissao enviados pelo frontend. Tambem deve sobreviver a recarregamentos, impedir saltos de etapa, tratar concorrencia e nunca liberar modulos de negocio antes da conclusao.

A criacao inicial apresenta um problema circular de RLS: antes do tenant existir, o ator ainda nao possui membership capaz de estabelecer `app.organization_id`. A excecao precisa ser menor que um bypass generico e precisa manter o ator derivado exclusivamente da autenticacao validada.

## Decisao

Adotamos um onboarding de sete etapas para um unico tenant provisiorio por ator. O estado persistente fica em `OrganizationOnboarding`, sempre associado a `organizationId` e `createdByUserId`, com `status`, `currentStep`, `payloadVersion`, `version`, `selectedPlanCode`, timestamps e exclusao logica.

O ciclo de vida da organizacao passa a ser:

1. `ONBOARDING`: tenant provisoriamente criado; somente o modulo de onboarding pode alterar sua configuracao.
2. `ACTIVE`: configuracao concluida; autorizacoes normais de negocio podem ser concedidas.
3. `SUSPENDED`: contexto ainda identificavel, mas operacoes de negocio sao negadas.

Organizacoes existentes recebem `ACTIVE`. Nenhuma assinatura, cobranca ou integracao financeira e criada pelo onboarding; o plano escolhido e apenas uma selecao persistida para ativacao comercial posterior.

### Bootstrap com autoridade estreita

A funcao `start_actor_onboarding` e `SECURITY DEFINER`, possui `search_path` fixo, nao recebe identificador de ator ou tenant e le `app.actor_user_id` da transacao autenticada. Seu owner tecnico e `NOLOGIN` e possui somente os privilegios necessarios para criar:

- usuario local quando ainda nao existir, usando apenas claims validadas do JWT;
- organizacao `ONBOARDING` e unidade principal provisoria;
- membership ativa, papel owner global e permissoes padrao;
- registro de onboarding e auditoria sanitizada.

O runtime herda apenas o papel consumidor da funcao, nunca o owner com `BYPASSRLS`. Uma segunda funcao estreita, `resolve_actor_onboarding`, descobre o onboarding do ator sem parametro de tenant. Depois dessa descoberta, as leituras e alteracoes comuns usam transacao com `app.organization_id`, politicas RLS e o owner global criado no bootstrap.

### Estado, passos e concorrencia

Os passos sao, nesta ordem: seu negocio, dados da empresa, unidade principal, responsavel, operacao, plano Wefit e revisao. A revisao conclui o fluxo; nao existe uma oitava etapa implicita. Uma etapa pode ser reeditada depois de salva, mas `currentStep` nunca diminui e nao pode saltar uma etapa ainda nao liberada.

Cada `PATCH` exige a `version` conhecida pelo cliente. A atualizacao usa comparacao otimista e incrementa a versao; divergencia retorna conflito sem sobrescrever dados. O payload JSON possui schema Zod versionado, inclusive horarios de funcionamento. Campos estruturais consolidados tambem sao gravados em `Organization` e `Unit` durante a conclusao transacional.

`POST /onboarding/start` e `POST /onboarding/current/complete` sao idempotentes. Indices parciais impedem dois onboardings ativos para a mesma organizacao ou o mesmo ator. `COMPLETED` e `CANCELED` sao estados terminais; uma repeticao de conclusao devolve o resultado ja concluido, enquanto cancelamento e logico e nao apaga o tenant provisiorio.

### Elegibilidade e roteamento

Self-service e `false` por padrao em todos os ambientes e nao pode ser habilitado em producao nesta entrega. Quando desligado, signup nao chama Supabase `signUp` e o bootstrap retorna `403`.

O backend e a autoridade do roteamento:

- sessao invalida: login;
- sem membership e self-service desligado: sem acesso;
- sem membership e self-service ligado: onboarding;
- organizacao `ONBOARDING`: onboarding;
- organizacao `ACTIVE`: dashboard;
- organizacao `SUSPENDED`: tela de suspensao.

O frontend nunca envia identidade, tenant, papel ou permissao como autoridade. Dados de responsavel informados no formulario sao contatos operacionais e nao substituem as claims autenticadas.

## Seguranca e dados

- CNPJ e normalizado para digitos e validado; e obrigatorio para `GYM` e `NETWORK` e opcional para `PERSONAL`.
- Nao coletamos CPF, biometria, senha, token, logo ou dados de integracoes externas.
- Senhas existem apenas entre navegador e Supabase Auth e nunca transitam pela API Wefit.
- Auditorias registram acao, etapa, versao e identificadores tecnicos, sem payload completo, senha, token, CNPJ, endereco ou contatos.
- Organizacoes `ONBOARDING` e `SUSPENDED` falham nas autorizacoes normais mesmo quando a membership e valida.
- Rate limits especificos protegem inicio e conclusao, alem do limite global da API.

## Falhas e recuperacao

- Falha no bootstrap reverte usuario local, tenant, unidade, acessos, onboarding e auditoria na mesma transacao.
- Falha ao salvar uma etapa nao avanca `currentStep` nem `version`.
- Falha na conclusao mantem a organizacao em `ONBOARDING`; o usuario pode recarregar e tentar novamente.
- Conflito de versao retorna `409` e orienta o cliente a recarregar o estado atual.
- Duplicidade de CNPJ ou identidade inconsistente retorna erro de dominio generico, sem revelar outra conta.
- Recuperacao operacional usa o `correlationId` e a trilha de auditoria, sem editar migrations aplicadas.

## Observabilidade

Sao auditados `onboarding.started`, `onboarding.step_saved`, `onboarding.completed` e `onboarding.canceled`. Logs de erro continuam sujeitos a redacao e nao incluem payload de formulario. Metricas recomendadas para o rollout: inicio, abandono por etapa, conflitos de versao, conclusao, cancelamento e latencia de bootstrap/conclusao.

## Rollout

1. Aplicar migration em banco controlado e provisionar o runtime como membro de `wefit_onboarding_consumer`.
2. Validar RLS e bootstrap com role de runtime sem superuser, sem ownership e sem `BYPASSRLS`.
3. Liberar self-service apenas em desenvolvimento/teste para validacao interna.
4. Executar testes de unidade, integracao, isolamento, build dos containers e validacao visual responsiva.
5. Uma decisao posterior deve aprovar a habilitacao em producao; esta ADR nao a autoriza.

## Consequencias

O MVP ganha configuracao guiada, recuperavel e tenant-aware sem abrir um endpoint de provisionamento generico. Em contrapartida, a operacao precisa conceder explicitamente o papel consumidor ao runtime e monitorar tenants cancelados para eventual politica de retencao. Uma futura integracao comercial consumira `selectedPlanCode`, mas permanece fora deste escopo.
