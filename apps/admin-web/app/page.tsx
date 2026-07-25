import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, MetricCard, StatusBadge } from "@gym-platform/ui";

import {
  getAdminAccountState,
  getOnboardingAvailability,
  getStudentDashboardSummary
} from "./lib/admin-api";
import { resolveHomeDestination } from "./lib/home-routing";
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

  return (
    <main className="content">
      {params.welcome === "1" ? (
        <section className="welcome-banner" role="status">
          <strong>Bem-vindo ao Wefit.</strong>
          <span>Sua organização foi ativada e já está pronta para a configuração operacional.</span>
        </section>
      ) : null}

      <header className="dashboard-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>{active.organization.name}</h1>
          <p>
            {active.unit
              ? `Unidade ativa: ${active.unit.name}`
              : "Todas as unidades permitidas no seu escopo"}
          </p>
        </div>
        <StatusBadge tone="success">Contexto ativo</StatusBadge>
      </header>

      {summary ? (
        <>
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

          <Card className="dashboard-operation" aria-labelledby="operation-title">
            <div>
              <span className="eyebrow">Operação</span>
              <h2 id="operation-title">Gestão de alunos</h2>
              <p>Consulte cadastros e acompanhe o ciclo de vida dos alunos.</p>
            </div>
            <Link className="button button-primary" href="/students">
              Ver alunos
            </Link>
          </Card>
        </>
      ) : (
        <Card className="dashboard-operation">
          <div>
            <span className="eyebrow">Acesso atual</span>
            <h2>Visão operacional</h2>
            <p>Não há indicadores disponíveis para as permissões e o plano deste contexto.</p>
          </div>
        </Card>
      )}
    </main>
  );
}
