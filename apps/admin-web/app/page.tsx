import { redirect } from "next/navigation";

import { ActionCard, MetricCard, PageHeader, SectionCard, StatusBadge } from "@gym-platform/ui";

import {
  getAdminAccountState,
  getOnboardingAvailability,
  getStudentDashboardSummary
} from "./lib/admin-api";
import { resolveHomeDestination } from "./lib/home-routing";
import { adminModuleCatalog, resolveAdminModuleAccess } from "./lib/module-catalog";
import { canAccessStudents } from "./lib/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const [{ active }, onboardingAvailability, params] = await Promise.all([
    getAdminAccountState(),
    getOnboardingAvailability(),
    searchParams
  ]);

  const destination = resolveHomeDestination(
    active?.organization.lifecycle ?? null,
    onboardingAvailability
  );
  if (destination.startsWith("/")) {
    redirect(destination);
  }

  if (!active || destination === "no-access") {
    return (
      <main className="content">
        <section className="empty-state">
          <span className="eyebrow">Conta autenticada</span>
          <h1>Sem acesso a academias</h1>
          <p>
            Sua conta não possui uma membership ativa. Solicite acesso ao responsável pela
            organização.
          </p>
        </section>
      </main>
    );
  }

  const canReadStudents = canAccessStudents(active);
  const summary = canReadStudents ? await getStudentDashboardSummary(active) : null;
  const visibleModules = adminModuleCatalog
    .filter(({ id }) => id !== "dashboard")
    .map((definition) => resolveAdminModuleAccess(definition, active))
    .filter(({ visible }) => visible);

  return (
    <main className="content">
      {params.welcome === "1" ? (
        <section className="welcome-banner" role="status">
          <strong>Bem-vindo ao Wefit.</strong>
          <span>Sua organização foi ativada e está pronta para a configuração operacional.</span>
        </section>
      ) : null}

      <PageHeader
        eyebrow="Visão geral"
        title={active.organization.name}
        description={
          active.unit
            ? `Unidade ativa: ${active.unit.name}`
            : "Todas as unidades permitidas no seu escopo"
        }
        actions={<StatusBadge tone="success">Contexto ativo</StatusBadge>}
      />

      {summary ? (
        <SectionCard
          title="Indicadores de alunos"
          description="Dados reais do contexto selecionado, atualizados pela API administrativa."
        >
          <section className="dashboard-metrics" aria-label="Indicadores de alunos">
            <MetricCard
              label="Alunos ativos"
              value={summary.activeStudents}
              description="No contexto selecionado"
              tone="success"
            />
            <MetricCard
              label="Alunos inativos"
              value={summary.inactiveStudents}
              description="Mantidos no histórico"
              tone="warning"
            />
            <MetricCard
              label="Total de alunos"
              value={summary.totalStudents}
              description="Ativos e inativos"
              tone="brand"
            />
            <MetricCard
              label="Novos em 30 dias"
              value={summary.newStudentsLast30Days}
              description="Cadastros recentes"
            />
            <MetricCard
              label="Unidades disponíveis"
              value={summary.availableUnits}
              description="Dentro do seu escopo"
            />
          </section>
        </SectionCard>
      ) : (
        <SectionCard title="Indicadores operacionais">
          <p>Não há indicadores disponíveis para as permissões e o plano deste contexto.</p>
        </SectionCard>
      )}

      <SectionCard
        title="Módulos da operação"
        description="A disponibilidade considera plano, permissões, recursos contratados e unidade ativa."
      >
        <div className="dashboard-module-grid">
          {visibleModules.map(({ definition, state }) => (
            <ActionCard
              badge={
                state === "preview"
                  ? { label: "Preview", tone: "info" }
                  : state === "locked"
                    ? { label: "Bloqueado", tone: "warning" }
                    : { label: "Disponível", tone: "success" }
              }
              description={definition.description}
              disabled={state === "locked"}
              href={definition.route}
              icon={definition.icon}
              key={definition.id}
              title={definition.label}
            />
          ))}
        </div>
      </SectionCard>
    </main>
  );
}
