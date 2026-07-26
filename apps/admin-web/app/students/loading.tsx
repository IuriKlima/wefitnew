import { Skeleton } from "@gym-platform/ui";

export default function StudentsLoading() {
  return (
    <main className="content" aria-busy="true">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CRM operacional</span>
          <h1>Alunos</h1>
        </div>
      </div>
      <section className="toolbar">
        <Skeleton lines={2} label="Carregando filtros" />
      </section>
      <section className="table-surface">
        <Skeleton lines={7} label="Carregando lista de alunos" />
      </section>
    </main>
  );
}
