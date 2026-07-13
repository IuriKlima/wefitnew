# Observabilidade

## Objetivo

Permitir diagnostico seguro sem expor dados sensiveis.

## Correlation ID

Toda requisicao recebe `x-correlation-id`. Valores recebidos sao aceitos apenas quando passam por allowlist de caracteres e tamanho; caso contrario, a API gera um UUID novo.

O `correlationId` deve ser propagado para logs tecnicos, auditoria e chamadas futuras para filas ou integracoes.

## Logs

Logs devem incluir correlation ID, servico, operacao e resultado. Nao devem incluir senhas, tokens, documentos, payloads completos ou dados biometricos.

## Metricas futuras

Metricas tecnicas esperadas:

- latencia por endpoint;
- taxa de erro;
- filas pendentes;
- falhas de integracao;
- eventos de gateway offline;
- uso de banco e Redis.

## Auditoria

`AuditLog` registra organizacao, unidade opcional, ator, acao, entidade, identificador da entidade, metadados, correlation ID e data. Auditoria e trilha de negocio, nao substitui logs tecnicos.
