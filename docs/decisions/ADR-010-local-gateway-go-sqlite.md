# ADR-010: Gateway local em Go com SQLite

## Status

Proposta.

## Contexto

ADR-004 decidiu que catracas devem ser integradas por um gateway local futuro. A etapa atual ainda nao implementa controle de acesso, mas precisa registrar uma direcao tecnica para funcionamento offline e suporte em ambiente de academia.

## Proposta

Implementar o gateway local futuro como binario em Go, com SQLite para fila/cache local.

O gateway deve:

- conectar de saida com a nuvem;
- manter fila local idempotente;
- operar parcialmente offline;
- usar adapters por fabricante;
- expor health local;
- sincronizar eventos quando a internet voltar.

## Alternativas consideradas

- Node.js local.
- Servico Windows/.NET por fabricante.
- Aplicacao desktop com banco embutido.
- API cloud acessando diretamente a rede local.

## Consequencias esperadas

- Distribuicao simples como binario.
- Baixa dependencia de runtime no cliente.
- SQLite atende cache/fila local sem servidor de banco.
- Exige pipeline proprio, instalador e observabilidade especifica.

## Decisao pendente

Nada do gateway deve ser implementado nesta fase. A proposta precisa de validacao com o primeiro fabricante de catraca e requisitos de suporte local.
