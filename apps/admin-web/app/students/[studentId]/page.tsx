import Link from "next/link";
import { notFound } from "next/navigation";

import type { StudentAuditEvent } from "@gym-platform/contracts";
import { Breadcrumb, Card, EmptyState, ErrorState, StatusBadge, Tabs } from "@gym-platform/ui";

import {
  AdminApiError,
  getAdminAccountState,
  getStudent,
  getStudentHistory,
  listUnits
} from "../../lib/admin-api";
import { canManageStudents } from "../../lib/navigation";
import {
  inactivateStudentAction,
  reactivateStudentAction,
  replaceStudentUnitsAction
} from "../actions";
import { displayStudentName } from "../student-format";
import { StudentLifecycleActions } from "../student-lifecycle-actions";
import { UnitSelector } from "../unit-selector";

export const dynamic = "force-dynamic";

type StudentProfilePageProps = {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StudentProfilePage({
  params,
  searchParams
}: StudentProfilePageProps) {
  const { studentId } = await params;
  const activeTab = readTab((await searchParams).tab);

  try {
    const { active } = await getAdminAccountState();
    if (!active) {
      throw new AdminApiError("Sua conta não possui acesso ativo a uma organização.", 403);
    }

    const canManage = canManageStudents(active);
    const [student, history, units] = await Promise.all([
      getStudent(studentId, active),
      activeTab === "history" ? getStudentHistory(studentId, active) : Promise.resolve([]),
      activeTab === "units" && canManage ? listUnits(active) : Promise.resolve([])
    ]);
    const inactivateAction = inactivateStudentAction.bind(null, student.id);
    const reactivateAction = reactivateStudentAction.bind(null, student.id);
    const replaceUnitsAction = replaceStudentUnitsAction.bind(null, student.id);
    const name = displayStudentName(student);

    return (
      <main className="content">
        <Breadcrumb items={[{ label: "Alunos", href: "/students" }, { label: name }]} />
        <header className="student-profile-header">
          <div>
            <span className="eyebrow">Perfil do aluno</span>
            <div className="student-profile-title">
              <h1>{name}</h1>
              <StatusBadge tone={student.status === "ACTIVE" ? "success" : "warning"}>
                {student.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </StatusBadge>
            </div>
            {student.socialName ? <p>Nome civil: {student.name}</p> : null}
          </div>
          {canManage ? (
            <div className="student-header-actions">
              <Link className="button" href={`/students/${student.id}/edit`}>
                Editar cadastro
              </Link>
              <StudentLifecycleActions
                status={student.status}
                inactivateAction={inactivateAction}
                reactivateAction={reactivateAction}
              />
            </div>
          ) : null}
        </header>

        <Tabs
          activeId={activeTab}
          items={[
            { id: "summary", label: "Resumo", href: `/students/${student.id}?tab=summary` },
            { id: "units", label: "Unidades", href: `/students/${student.id}?tab=units` },
            { id: "history", label: "Histórico", href: `/students/${student.id}?tab=history` }
          ]}
        />

        {activeTab === "summary" ? (
          <div className="student-detail-grid">
            <Card>
              <h2>Contato</h2>
              <dl className="student-definition-list">
                <div>
                  <dt>E-mail</dt>
                  <dd>{student.email ?? "Não informado"}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{student.phone ?? "Não informado"}</dd>
                </div>
                <div>
                  <dt>Nascimento</dt>
                  <dd>{student.birthDate ? formatDate(student.birthDate) : "Não informado"}</dd>
                </div>
              </dl>
            </Card>
            <Card>
              <h2>Operação</h2>
              <dl className="student-definition-list">
                <div>
                  <dt>Unidades</dt>
                  <dd>{student.units.map(({ name: unitName }) => unitName).join(", ")}</dd>
                </div>
                <div>
                  <dt>Cadastrado em</dt>
                  <dd>{formatDateTime(student.createdAt)}</dd>
                </div>
                <div>
                  <dt>Atualizado em</dt>
                  <dd>{formatDateTime(student.updatedAt)}</dd>
                </div>
              </dl>
            </Card>
            <Card className="student-note-card">
              <h2>Observação operacional</h2>
              <p>{student.operationalNote ?? "Nenhuma observação operacional registrada."}</p>
            </Card>
          </div>
        ) : null}

        {activeTab === "units" ? (
          <Card className="student-units-card">
            <div>
              <h2>Unidades vinculadas</h2>
              <p>Os vínculos seguem a política do tipo de organização e o escopo autorizado.</p>
            </div>
            {canManage ? (
              <form className="student-form" action={replaceUnitsAction}>
                <UnitSelector
                  organizationType={active.organization.type}
                  units={units}
                  selectedUnitIds={student.units.map(({ id }) => id)}
                />
                <div className="form-actions">
                  <button className="button button-primary" type="submit">
                    Salvar vínculos
                  </button>
                </div>
              </form>
            ) : (
              <ul className="student-unit-list">
                {student.units.map((unit) => (
                  <li key={unit.id}>{unit.name}</li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {activeTab === "history" ? <StudentHistory events={history} /> : null}
      </main>
    );
  } catch (error) {
    if (error instanceof AdminApiError && error.statusCode === 404) {
      notFound();
    }

    return (
      <main className="content">
        <ErrorState
          title="Aluno indisponível"
          description={
            error instanceof Error ? error.message : "Não foi possível carregar o aluno."
          }
          action={
            <Link className="button" href="/students">
              Voltar para alunos
            </Link>
          }
        />
      </main>
    );
  }
}

function StudentHistory({ events }: { events: StudentAuditEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="Nenhum evento registrado"
        description="O histórico seguro deste aluno ainda não possui eventos visíveis no seu escopo."
      />
    );
  }

  return (
    <Card className="student-history-card">
      <h2>Histórico seguro</h2>
      <ol className="student-history">
        {events.map((event) => (
          <li key={event.id}>
            <span className="student-history-marker" aria-hidden="true" />
            <div>
              <strong>{auditActionLabel[event.action]}</strong>
              <span>{formatDateTime(event.occurredAt)}</span>
              <small>{describeAuditMetadata(event)}</small>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const auditActionLabel: Record<StudentAuditEvent["action"], string> = {
  "student.created": "Aluno cadastrado",
  "student.updated": "Cadastro atualizado",
  "student.inactivated": "Aluno inativado",
  "student.reactivated": "Aluno reativado",
  "student.unit_linked": "Unidade vinculada",
  "student.unit_unlinked": "Unidade desvinculada"
};

function describeAuditMetadata(event: StudentAuditEvent): string {
  if (event.metadata.changedFields) {
    return `Campos alterados: ${event.metadata.changedFields.join(", ")}`;
  }
  if (event.metadata.statusBefore && event.metadata.statusAfter) {
    return `Status: ${event.metadata.statusBefore} → ${event.metadata.statusAfter}`;
  }
  if (event.metadata.unitId) {
    return `Unidade: ${event.metadata.unitId}`;
  }
  if (event.metadata.unitIds) {
    return `${event.metadata.unitIds.length} unidade(s) vinculada(s) no cadastro`;
  }
  return "Evento operacional sem dados pessoais.";
}

function readTab(value: string | string[] | undefined): "summary" | "units" | "history" {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "units" || tab === "history" ? tab : "summary";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}
