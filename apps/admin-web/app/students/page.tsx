import Link from "next/link";

import type { Student } from "@gym-platform/contracts";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  MobileDataCards,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  type DataTableColumn,
  type MobileDataCardField
} from "@gym-platform/ui";

import { AdminApiError, getAdminAccountState, listStudents } from "../lib/admin-api";
import { canManageStudents } from "../lib/navigation";
import { displayStudentName } from "./student-format";
import {
  buildStudentsHref,
  parseStudentListQuery,
  type StudentSearchParams
} from "./student-list-query";

export const dynamic = "force-dynamic";

type StudentsPageProps = {
  searchParams: Promise<StudentSearchParams>;
};

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const query = parseStudentListQuery(await searchParams);

  try {
    const { active } = await getAdminAccountState();
    if (!active) {
      throw new AdminApiError("Sua conta não possui acesso ativo a uma organização.", 403);
    }

    const students = await listStudents(query, active);
    const canManage = canManageStudents(active);
    const hasFilters = Boolean(query.search || query.status || query.unitId);

    return (
      <main className="content">
        <PageHeader
          breadcrumb={[{ label: "Visão geral", href: "/" }, { label: "Alunos" }]}
          eyebrow="CRM operacional"
          title="Alunos"
          description="Consulte e mantenha os cadastros autorizados da organização."
          actions={
            canManage ? (
              <Link className="button button-primary" href="/students/new">
                Novo aluno
              </Link>
            ) : null
          }
        />

        <FilterBar action="/students" method="get" aria-label="Filtros de alunos">
          <SearchInput
            name="search"
            aria-label="Buscar alunos"
            placeholder="Nome, nome social, e-mail ou telefone"
            defaultValue={query.search}
          />
          <Select name="status" aria-label="Filtrar por status" defaultValue={query.status ?? ""}>
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Inativos</option>
          </Select>
          <Select name="unitId" aria-label="Filtrar por unidade" defaultValue={query.unitId ?? ""}>
            <option value="">Todas as unidades</option>
            {active.organization.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </Select>
          <Select name="sortBy" aria-label="Ordenar por" defaultValue={query.sortBy}>
            <option value="name">Nome</option>
            <option value="status">Status</option>
            <option value="createdAt">Cadastro</option>
            <option value="updatedAt">Atualização</option>
          </Select>
          <Select
            name="sortDirection"
            aria-label="Direção da ordenação"
            defaultValue={query.sortDirection}
          >
            <option value="asc">Crescente</option>
            <option value="desc">Decrescente</option>
          </Select>
          <Select name="pageSize" aria-label="Itens por página" defaultValue={query.pageSize}>
            <option value="10">10 por página</option>
            <option value="20">20 por página</option>
            <option value="50">50 por página</option>
            <option value="100">100 por página</option>
          </Select>
          <button className="button button-primary" type="submit">
            Aplicar
          </button>
          {hasFilters ? (
            <Link className="button" href="/students">
              Limpar
            </Link>
          ) : null}
        </FilterBar>

        {students.data.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nenhum aluno encontrado" : "Nenhum aluno cadastrado"}
            description={
              hasFilters
                ? "Limpe ou ajuste os filtros para ampliar os resultados."
                : "Cadastre o primeiro aluno para iniciar a operação."
            }
            action={
              canManage ? (
                <Link className="button button-primary" href="/students/new">
                  Novo aluno
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="student-desktop-table">
              <DataTable
                caption="Lista de alunos"
                columns={studentColumns}
                getRowKey={({ id }) => id}
                rows={students.data}
              />
            </div>
            <MobileDataCards
              fields={studentMobileFields}
              getRowKey={({ id }) => id}
              label="Lista de alunos em cartões"
              rows={students.data}
            />
          </>
        )}

        <div className="student-list-footer">
          <p>
            {students.pagination.total} aluno(s) · página {students.pagination.page} de{" "}
            {students.pagination.totalPages}
          </p>
          <Pagination
            currentPage={students.pagination.page}
            totalPages={students.pagination.totalPages}
            buildHref={(page) => buildStudentsHref(query, page)}
          />
        </div>
      </main>
    );
  } catch (error) {
    const message =
      error instanceof AdminApiError || error instanceof Error
        ? error.message
        : "Não foi possível carregar os alunos.";

    return (
      <main className="content">
        <ErrorState
          title="Alunos indisponíveis"
          description={message}
          action={
            <Link className="button" href="/students">
              Tentar novamente
            </Link>
          }
        />
      </main>
    );
  }
}

const studentColumns: Array<DataTableColumn<Student>> = [
  {
    key: "student",
    header: "Aluno",
    cell: (student) => (
      <span className="table-primary-cell">
        <strong>{displayStudentName(student)}</strong>
        {student.socialName ? <small>{student.name}</small> : null}
      </span>
    )
  },
  {
    key: "contact",
    header: "Contato",
    cell: (student) => (
      <span className="table-primary-cell">
        <span>{student.email ?? "Sem e-mail"}</span>
        <small>{student.phone ?? "Sem telefone"}</small>
      </span>
    )
  },
  {
    key: "units",
    header: "Unidades",
    cell: (student) => student.units.map(({ name }) => name).join(", ")
  },
  {
    key: "status",
    header: "Status",
    cell: (student) => (
      <StatusBadge tone={student.status === "ACTIVE" ? "success" : "warning"}>
        {student.status === "ACTIVE" ? "Ativo" : "Inativo"}
      </StatusBadge>
    )
  },
  {
    key: "actions",
    header: <span className="wf-visually-hidden">Ações</span>,
    align: "right",
    cell: (student) => (
      <Link className="button button-small" href={`/students/${student.id}`}>
        Abrir
      </Link>
    )
  }
];

const studentMobileFields: Array<MobileDataCardField<Student>> = [
  {
    key: "student",
    label: "Aluno",
    value: (student) => (
      <span className="table-primary-cell">
        <strong>{displayStudentName(student)}</strong>
        {student.socialName ? <small>{student.name}</small> : null}
      </span>
    )
  },
  {
    key: "contact",
    label: "Contato",
    value: (student) => (
      <span className="table-primary-cell">
        <span>{student.email ?? "Sem e-mail"}</span>
        <small>{student.phone ?? "Sem telefone"}</small>
      </span>
    )
  },
  {
    key: "units",
    label: "Unidades",
    value: (student) => student.units.map(({ name }) => name).join(", ") || "Sem unidade"
  },
  {
    key: "status",
    label: "Status",
    value: (student) => (
      <StatusBadge tone={student.status === "ACTIVE" ? "success" : "warning"}>
        {student.status === "ACTIVE" ? "Ativo" : "Inativo"}
      </StatusBadge>
    )
  },
  {
    key: "actions",
    label: "Ações",
    value: (student) => (
      <Link className="button button-small" href={`/students/${student.id}`}>
        Abrir cadastro
      </Link>
    )
  }
];
