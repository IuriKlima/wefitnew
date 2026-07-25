# ADR: Identidade do Edge Agent

## Contexto
O agente não deve usar o `service_role` do Wefit ou senhas em texto puro. A identidade deve assegurar a qual Tenant e Unidade o acesso se destina.

## Decisão
O processo de Enrollment via Código de Uso Único irá trocar um token por uma Identidade criptográfica (AgentID, Chave de Integridade e Tokens de refresh). 
Esses segredos serão armazenados no Windows via DPAPI (SecretStore), acessíveis apenas pelo usuário que roda o serviço.

## Consequências
- Não confiaremos nos parâmetros de organizationId enviados pela catraca. O escopo é definido pela própria identidade da máquina.
- É possível revogar a identidade no Wefit Cloud instantaneamente.
