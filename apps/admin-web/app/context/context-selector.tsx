"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

import type { AdminAccountState } from "../lib/admin-api";
import { selectActiveOrganizationAction, selectActiveUnitAction } from "./actions";

export function ContextSelector({ state }: { state: AdminAccountState }) {
  const pathname = usePathname();
  const { context, active } = state;

  if (!active) {
    return (
      <div className="context-empty" role="status">
        <strong>Sem acesso</strong>
        <span>Nenhuma organizacao ativa foi encontrada para esta conta.</span>
      </div>
    );
  }

  return (
    <div className="context-controls" aria-label="Contexto ativo">
      <form action={selectActiveOrganizationAction}>
        <input type="hidden" name="returnTo" value={pathname} />
        <label>
          <span>Organizacao</span>
          <select name="organizationId" defaultValue={active.organization.id}>
            {context.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        <ContextSubmitButton label="Trocar" />
      </form>

      <form action={selectActiveUnitAction}>
        <input type="hidden" name="returnTo" value={pathname} />
        <input type="hidden" name="organizationId" value={active.organization.id} />
        <label>
          <span>Unidade</span>
          <select name="unitId" defaultValue={active.unit?.id ?? ""}>
            {active.organization.isGlobalMember ? (
              <option value="">Todas as unidades</option>
            ) : null}
            {active.organization.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
        <ContextSubmitButton label="Aplicar" />
      </form>
    </div>
  );
}

function ContextSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button button-small" type="submit" disabled={pending}>
      {pending ? "Carregando..." : label}
    </button>
  );
}
