# Planos e funcionalidades

## Modelo

Os planos são registros configuráveis, representados por `SubscriptionPlan`, `Feature`, `PlanFeature` e `OrganizationSubscription`. Limites comerciais não devem ser codificados em enums ou constantes fixas.

## Personal

Indicado para um profissional responsável.

Funcionalidades previstas:

- Um acesso administrativo.
- Gestão de alunos.
- Prescrição e acompanhamento de treinos.
- Avaliações físicas.
- Agenda.
- Portal ou aplicativo para alunos.
- Uma unidade lógica vinculada à organização.

Limites numéricos: pendentes.

## Academia

Indicado para uma organização com uma unidade física.

Funcionalidades previstas:

- Acessos para proprietário, gestor, recepção, professores e alunos.
- Gestão de alunos, contratos, planos, pagamentos, aulas, treinos e avaliações.
- Controle de acesso.
- Integração futura com catracas físicas.
- Integração futura com Wellhub e TotalPass.

Limites numéricos: pendentes.

## Redes

Indicado para uma organização com múltiplas unidades.

Funcionalidades previstas:

- Gestão centralizada.
- Permissões por unidade.
- Indicadores consolidados.
- Alunos com acesso a diferentes unidades conforme contrato.
- Integrações padronizadas por unidade e por organização.

Limites numéricos: pendentes.

## Entitlements

Cada funcionalidade deve possuir uma chave estável, um estado habilitado/desabilitado e, quando necessário, uma configuração JSON. Limites como quantidade de alunos, colaboradores, unidades ou dispositivos devem ser dados configuráveis.

Decisões pendentes:

- Preços.
- Limites de alunos.
- Limites de colaboradores.
- Limites de unidades.
- Regras comerciais de upgrade e downgrade.
