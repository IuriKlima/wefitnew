# Integrações

## Diretrizes

Integrações externas devem ficar isoladas por adapters. O domínio não deve depender diretamente de SDKs ou formatos específicos de fornecedores.

## Wellhub e TotalPass

Wellhub e TotalPass serão integrações externas isoladas por adapters. Webhooks devem ser idempotentes, com armazenamento de identificadores externos e proteção contra processamento duplicado.

## Eventos externos

Eventos externos devem possuir:

- validação de assinatura quando o fornecedor oferecer;
- idempotência;
- retentativas;
- fila para processamento assíncrono;
- reconciliação periódica;
- auditoria de alterações relevantes.

## Falhas

Falha temporária de fornecedor não deve corromper o estado interno. Use estados intermediários, retentativas e reconciliação.
