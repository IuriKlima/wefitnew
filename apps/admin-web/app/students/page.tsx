import Link from "next/link";

import type { Student } from "@gym-platform/contracts";

import { AdminApiError, listStudents } from "../lib/admin-api";
import { displayStudentName } from "./student-format";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type StudentsPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const params = await searchParams;
  const search = readParam(params.search);
  const status = readStatusParam(params.status);
  const page = readParam(params.page) ?? "1";

  try {
    const students = await listStudents({
      page,
      search,
      status
    });

    return (
      <main className="content">
        <div className="page-heading">
          <div>
            <span className="eyebrow">Fase 1A</span>
            <h1>Alunos</h1>
          </div>
          <Link className="button button-primary" href="/students/new">
            Novo aluno
          </Link>
        </div>

        <section className="toolbar" aria-label="Filtros de alunos">
          <form className="filters" action="/students">
            <label>
              <span>Busca</span>
              <input
                type="search"
                name="search"
                placeholder="Nome, e-mail ou telefone"
                defaultValue={search}
              />
            </label>
            <label>
              <span>Status</span>
              <select name="status" defaultValue={status ?? ""}>
                <option value="">Todos</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
              </select>
            </label>
            <button className="button" type="submit">
              Filtrar
            </button>
          </form>
        </section>

        {students.data.length === 0 ? (
          <EmptyStudentsState hasFilters={Boolean(search || status)} />
        ) : (
          <StudentsTable students={students.data} />
        )}

        <footer className="pagination-summary">
          Pagina {students.pagination.page} de {students.pagination.totalPages} -{" "}
          {students.pagination.total} aluno(s)
        </footer>
      </main>
    );
  } catch (error) {
    return <AdminErrorState error={error} />;
  }
}

function StudentsTable({ students }: { students: Student[] }) {
  return (
    <section className="table-surface" aria-label="Lista de alunos">
      <table>
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Contato</th>
            <th>Unidades</th>
            <th>Status</th>
            <th aria-label="Acoes" />
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>
                <strong>{displayStudentName(student)}</strong>
                {student.socialName ? <span className="muted">{student.name}</span> : null}
              </td>
              <td>
                <span>{student.email ?? "Sem e-mail"}</span>
                <span className="muted">{student.phone ?? "Sem telefone"}</span>
              </td>
              <td>
                {student.units.length > 0
                  ? student.units.map((unit) => unit.name).join(", ")
                  : "Sem vinculo"}
              </td>
              <td>
                <span className={`status-pill status-pill-${student.status.toLowerCase()}`}>
                  {student.status === "ACTIVE" ? "Ativo" : "Inativo"}
                </span>
              </td>
              <td className="actions-cell">
                <Link className="button button-small" href={`/students/${student.id}`}>
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EmptyStudentsState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <section className="empty-state">
      <h2>{hasFilters ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}</h2>
      <p>
        {hasFilters
          ? "Ajuste a busca ou o status para ampliar os resultados."
          : "Cadastre o primeiro aluno para iniciar a operacao da unidade."}
      </p>
      <Link className="button button-primary" href="/students/new">
        Novo aluno
      </Link>
    </section>
  );
}

function AdminErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof AdminApiError || error instanceof Error
      ? error.message
      : "Nao foi possivel carregar os alunos.";

  return (
    <main className="content">
      <section className="empty-state">
        <h1>Alunos indisponiveis</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readStatusParam(value: string | string[] | undefined): "ACTIVE" | "INACTIVE" | undefined {
  const status = readParam(value);

  return status === "ACTIVE" || status === "INACTIVE" ? status : undefined;
}
