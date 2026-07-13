# ADR-004: Gateway local de catracas

## Status

Aceita.

## Contexto

Catracas ficam em redes locais de academias e podem depender de fabricantes diferentes. A nuvem não deve exigir acesso direto à rede interna do cliente.

## Decisão

Criar um Access Gateway local no futuro. O gateway fará conexão de saída segura com a nuvem, terá funcionamento parcialmente offline e usará adapters por fabricante.

## Alternativas consideradas

- API da nuvem conectando diretamente nas catracas.
- Integração específica por fabricante dentro da API principal.
- Operação manual sem gateway.

## Consequências positivas

- Menor exposição da rede local.
- Melhor tolerância a queda de internet.
- Isolamento de fornecedores.

## Riscos e consequências negativas

- Instalação e suporte local adicionam complexidade.
- Sincronização offline exige reconciliação e idempotência.
- Observabilidade precisa cobrir o ambiente local.
