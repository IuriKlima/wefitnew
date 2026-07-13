# Módulos

## API

- Health: status básico da API.
- Organizations: criação e consulta de organizações.
- Units: unidades lógicas ou físicas dentro de uma organização.
- Identity: contrato temporário de autenticação e identidade.
- Memberships: vínculo entre usuários e organizações.
- Authorization: permissões, papéis e escopos.
- Subscriptions: planos, features e entitlements.
- Audit: registro de operações sensíveis.

## Regras de separação

- Controllers validam entrada e chamam application services.
- Application services coordenam regra de negócio e transações.
- Domain concentra invariantes e tipos do módulo.
- Infrastructure concentra Prisma, filas e integrações.
- Um módulo não deve depender de detalhes internos de outro módulo.

## Evolução futura

Módulos podem ser extraídos futuramente apenas se houver necessidade comprovada de escala, isolamento operacional ou ciclo de entrega independente.
