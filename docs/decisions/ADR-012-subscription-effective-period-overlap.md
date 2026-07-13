# ADR-012: Sobreposicao de periodos efetivos de assinaturas

## Status

Aceita.

## Contexto

A fundacao impedia apenas duas assinaturas abertas efetivas (`TRIALING` ou `ACTIVE` com `endsAt` nulo) para a mesma organizacao. Isso deixava uma lacuna: duas assinaturas efetivas com `startsAt` e `endsAt` preenchidos ainda poderiam se sobrepor.

## Decisao

Assinaturas com status `TRIALING` ou `ACTIVE` nao podem ter periodos efetivos sobrepostos dentro da mesma `Organization`.

O periodo efetivo e interpretado como intervalo semiaberto:

```text
[startsAt, endsAt)
```

Consequencias dessa interpretacao:

- `endsAt` deve ser maior que `startsAt` quando preenchido;
- assinaturas adjacentes sao permitidas quando uma termina exatamente no instante em que a outra inicia;
- `endsAt = null` representa periodo aberto ate infinito;
- status nao efetivos, como `SUSPENDED`, `CANCELED` e `EXPIRED`, nao entram na constraint.

## Implementacao

Usar uma exclusion constraint PostgreSQL com `btree_gist`:

- igualdade por `organizationId`;
- overlap por `tsrange(startsAt, coalesce(endsAt, infinity), '[)')`;
- filtro parcial para `TRIALING` e `ACTIVE`.

## Alternativas consideradas

- Validar somente no service de assinaturas.
- Manter apenas indice unico para assinatura aberta.
- Usar trigger customizada.

## Consequencias positivas

- O banco passa a proteger tanto periodos abertos quanto fechados.
- Testes de integracao PostgreSQL cobrem a regra real.
- A semantica de adjacencia fica explicita.

## Riscos e mitigacoes

- Risco: `btree_gist` precisar estar disponivel no banco gerenciado.
  Mitigacao: migration cria a extensao com `CREATE EXTENSION IF NOT EXISTS btree_gist`; infraestrutura final deve validar suporte antes de producao.
