# ADR-005: Entitlements por plano

## Status

Aceita.

## Contexto

Os planos Personal, Academia e Redes compartilham a mesma plataforma, mas liberam funcionalidades e limites diferentes.

## Decisão

Representar planos e funcionalidades por dados configuráveis: `SubscriptionPlan`, `Feature`, `PlanFeature` e `OrganizationSubscription`.

Para a configuração inicial do onboarding, os códigos técnicos `PERSONAL`, `GYM` e `NETWORK` não
criam assinatura nem cobrança. No MVP, a compatibilidade entre tipo de negócio e código de
configuração é:

| Tipo de organização | Código permitido |
| ------------------- | ---------------- |
| `PERSONAL`          | `PERSONAL`       |
| `GYM`               | `GYM`            |
| `NETWORK`           | `NETWORK`        |

A matriz é um contrato compartilhado, mas o backend continua sendo a autoridade e valida a
combinação ao salvar e ao concluir. A UI não é uma fronteira de segurança.

Uma mudança futura que permita combinações adicionais, upgrade ou downgrade exige regra comercial
aprovada e dados de entitlement; não deve ser liberada apenas alterando a tela.

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
- A matriz inicial é intencionalmente restritiva até a definição comercial dos planos.
