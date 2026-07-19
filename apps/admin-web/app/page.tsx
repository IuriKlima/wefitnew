import Link from "next/link";

import { getAdminAccountState } from "./lib/admin-api";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { active } = await getAdminAccountState();

  if (!active) {
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
