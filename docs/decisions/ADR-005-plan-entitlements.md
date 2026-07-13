# ADR-005: Entitlements por plano

## Status

Aceita.

## Contexto

Os planos Personal, Academia e Redes compartilham a mesma plataforma, mas liberam funcionalidades e limites diferentes.

## Decisão

Representar planos e funcionalidades por dados configuráveis: `SubscriptionPlan`, `Feature`, `PlanFeature` e `OrganizationSubscription`.

## Alternativas consideradas

- Hardcode de limites no código.
- Enums comerciais fixos.
- Sistemas separados por plano.

## Consequências positivas

- Alterações comerciais sem deploy para mudanças simples.
- Auditoria e histórico de assinaturas por organização.
- Menor risco de divergência entre planos.

## Riscos e consequências negativas

- Regras comerciais precisam de validação cuidadosa.
- Cache de entitlements pode causar inconsistência se não for invalidado corretamente.
- Exige telas administrativas futuras para gestão dos planos.
