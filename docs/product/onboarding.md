# Onboarding da organização

## Objetivo

O onboarding configura um único tenant provisório para o ator autenticado sem aceitar
`organizationId`, `unitId`, usuário, papel ou permissão enviados pelo navegador como autoridade.
O fluxo permanece fora dos módulos de negócio até a conclusão transacional.

## Etapas

1. Seu negócio.
2. Dados da empresa.
3. Unidade principal.
4. Responsável da conta.
5. Operação.
6. Plano Wefit.
7. Revisão e conclusão.

Cada avanço persiste o payload e incrementa `version`. Recarregar a página, sair da sessão ou
voltar posteriormente recupera a última etapa salva. Alterações concorrentes com versão antiga
retornam conflito e não sobrescrevem dados.

## Estados e transições

| Estado        | Significado                                      | Transições permitidas                       |
| ------------- | ------------------------------------------------ | ------------------------------------------- |
| `IN_PROGRESS` | Configuração editável e organização isolada.     | salvar, concluir ou cancelar;               |
| `CANCELED`    | Configuração pausada por cancelamento explícito. | somente retomada autenticada e auditada;    |
| `COMPLETED`   | Organização ativada e onboarding imutável.       | repetição idempotente da leitura/conclusão. |

“Continuar depois” encerra a sessão sem cancelar e mantém o registro `IN_PROGRESS`. Registros
antigos em `CANCELED` exibem “Retomar configuração”. A retomada usa o onboarding e a organização
provisória existentes, muda o estado para `IN_PROGRESS` com concorrência otimista e registra
`onboarding.resumed`.

`POST /onboarding/start` é idempotente. Uma trava transacional por ator, índices parciais e a
reutilização de qualquer onboarding existente impedem a criação duplicada do tenant.

## Tipo de negócio e plano

A matriz válida do MVP é deliberadamente um-para-um:

| Tipo de negócio | Plano de configuração permitido |
| --------------- | ------------------------------- |
| `PERSONAL`      | `PERSONAL`                      |
| `GYM`           | `GYM`                           |
| `NETWORK`       | `NETWORK`                       |

A matriz vive em `@gym-platform/contracts` e é consumida pela UI e pela validação. O repository
repete a regra dentro da transação antes de persistir o plano, e a validação do payload completo
repete a invariante antes de ativar a organização. Manipular a API diretamente não amplia as
combinações permitidas.

Se o tipo de negócio for alterado depois da escolha do plano, plano e revisão incompatíveis são
invalidados e o fluxo retorna à etapa 6.

## Identidade e contatos

O responsável da conta é obrigatoriamente a identidade autenticada persistida em `User`. O
backend compara o e-mail enviado na etapa com o e-mail dessa identidade e rejeita qualquer
terceiro; o onboarding nunca altera `User.email`.

O contato operacional separado é `Organization.businessEmail`, informado na etapa de dados do
negócio. Ele pode ser diferente da identidade autenticada e não concede login, membership, papel
ou permissão.

## Segurança e disponibilidade

- O backend deriva o ator do JWT validado ou do adapter temporário permitido somente localmente.
- A organização fica em `ONBOARDING` e não acessa módulos de negócio.
- Leituras e mutações comuns usam `organizationId` resolvido pelo backend e RLS forçada.
- Início e conclusão possuem buckets por ator e por IP.
- Produção exige Redis; memória é aceita apenas de forma explícita em desenvolvimento/teste.
- O contador Redis usa operação atômica com TTL e funciona entre réplicas.
- Nenhum payload completo, endereço, CNPJ, contato, token ou segredo entra na auditoria.

## Critérios para liberar CRM de alunos

O CRM pode iniciar somente depois de:

- lint, typecheck, build e testes unitários aprovados;
- migrations aplicadas em PostgreSQL de teste terminado em `_test`;
- integrações de onboarding, contexto restrito e isolamento aprovadas;
- teste Redis real de concorrência e expiração aprovado;
- `test:rls-spike` aprovado no ambiente atual;
- validação de staging com runtime sem superuser, ownership ou `BYPASSRLS`;
- revisão visual responsiva do onboarding;
- ausência de segredo versionado.
