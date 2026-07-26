import {
  ActionCard,
  Button,
  FilterBar,
  LockedModuleState,
  ModuleUnavailableState,
  PageHeader,
  SearchField,
  SectionCard,
  Select,
  StatusBadge
} from "@gym-platform/ui";

import { getAdminAccountState } from "../lib/admin-api";
import {
  getAdminModule,
  resolveAdminModuleAccess,
  resolveAdminPlan,
  type AdminModuleId
} from "../lib/module-catalog";

export async function ModulePreviewPage({ moduleId }: { moduleId: AdminModuleId }) {
  const { active } = await getAdminAccountState();
  const definition = getAdminModule(moduleId);

  if (!active) {
    return (
      <main className="content">
        <PageHeader
          eyebrow="Módulo administrativo"
          title={definition.label}
          description={definition.description}
        />
        <LockedModuleState description="Sua conta não possui uma organização ativa para abrir este módulo." />
      </main>
    );
  }

  const access = resolveAdminModuleAccess(definition, active);
  const scopeLabel =
    definition.scope === "unit"
      ? (active.unit?.name ?? "Nenhuma unidade selecionada")
      : active.organization.name;

  return (
    <main className="content module-preview-page">
      <PageHeader
        breadcrumb={[{ label: "Visão geral", href: "/" }, { label: definition.label }]}
        eyebrow="Arquitetura de módulo"
        title={definition.label}
        description={definition.description}
        actions={
          <>
            <StatusBadge tone={access.state === "locked" ? "warning" : "info"}>
              {access.state === "locked" ? "Bloqueado" : "Preview seguro"}
            </StatusBadge>
            {definition.primaryAction ? (
              <Button disabled tone="primary">
                {definition.primaryAction}
              </Button>
            ) : null}
          </>
        }
      />

      <section className="module-context-grid" aria-label="Contexto do módulo">
        <article>
          <span>Organização</span>
          <strong>{active.organization.name}</strong>
        </article>
        <article>
          <span>Escopo</span>
          <strong>{scopeLabel}</strong>
        </article>
        <article>
          <span>Plano efetivo</span>
          <strong>{resolveAdminPlan(active)}</strong>
        </article>
      </section>

      {access.state === "locked" ? (
        <LockedModuleState
          description={access.reason ?? "O módulo está bloqueado neste contexto."}
        />
      ) : (
        <>
          <FilterBar aria-label={`Filtros de ${definition.label}`}>
            <SearchField
              aria-label={`Pesquisar em ${definition.label}`}
              disabled
              placeholder="Pesquisa disponível após a integração"
            />
            <Select aria-label="Filtro de status" disabled defaultValue="all">
              <option value="all">Todos os status</option>
            </Select>
            <Button disabled>Aplicar filtros</Button>
          </FilterBar>

          <SectionCard
            title="Estrutura prevista"
            description="Esta composição valida navegação, hierarquia e responsividade sem inventar registros."
          >
            <div className="module-preview-grid">
              {(definition.previewSections ?? []).map((section) => (
                <ActionCard
                  description="Área reservada para a integração funcional deste módulo."
                  disabled
                  icon={definition.icon}
                  key={section}
                  title={section}
                />
              ))}
            </div>
          </SectionCard>

          <ModuleUnavailableState description="A interface está preparada para receber dados reais. Nesta versão, nenhuma leitura, escrita ou confirmação simulada é executada." />
        </>
      )}
    </main>
  );
}
