import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminAccountState, getOnboardingAvailability } from "./lib/admin-api";
import { resolveHomeDestination } from "./lib/home-routing";

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
            Sua conta nao possui uma membership ativa. Solicite acesso ao responsavel pela
            organizacao.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="content">
      {params.welcome === "1" ? (
        <section className="welcome-banner" role="status">
          <strong>Bem-vindo ao Wefit.</strong>
          <span>Sua organizacao foi ativada e ja esta pronta para a configuracao operacional.</span>
        </section>
      ) : null}
      <section className="dashboard-hero">
        <span className="eyebrow">Contexto ativo</span>
        <h1>{active.organization.name}</h1>
        <p>
          {active.unit
            ? `Unidade: ${active.unit.name}`
            : "Escopo organizacional: todas as unidades permitidas"}
        </p>
      </section>

      <section className="dashboard-shortcuts" aria-labelledby="shortcuts-title">
        <div>
          <span className="eyebrow">Operacao</span>
          <h2 id="shortcuts-title">Acessos rapidos</h2>
        </div>
        <Link className="shortcut-card" href="/students">
          <strong>Alunos</strong>
          <span>Consultar e gerenciar alunos dentro do contexto ativo.</span>
        </Link>
      </section>
    </main>
  );
}
