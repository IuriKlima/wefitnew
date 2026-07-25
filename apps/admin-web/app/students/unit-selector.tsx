import type { AccountOrganizationType, UnitSummary } from "@gym-platform/contracts";

type UnitSelectorProps = {
  organizationType: AccountOrganizationType;
  units: UnitSummary[];
  selectedUnitIds?: string[];
};

export type UnitSelectionMode = "main" | "single" | "multiple";

export function resolveUnitSelectionMode(
  organizationType: AccountOrganizationType
): UnitSelectionMode {
  if (organizationType === "PERSONAL") {
    return "main";
  }

  return organizationType === "GYM" ? "single" : "multiple";
}

export function UnitSelector({ organizationType, units, selectedUnitIds = [] }: UnitSelectorProps) {
  const selectedIds = new Set(selectedUnitIds);
  const mode = resolveUnitSelectionMode(organizationType);
  const availableUnits = mode === "main" ? units.filter(({ code }) => code === "MAIN") : units;

  return (
    <fieldset className="span-2 unit-selector">
      <legend>Unidades</legend>
      <p className="unit-selector-hint">
        {mode === "multiple"
          ? "Selecione uma ou mais unidades operacionais."
          : "Selecione a unidade operacional do aluno."}
      </p>
      {availableUnits.length === 0 ? (
        <p className="muted">Nenhuma unidade disponivel para o seu escopo.</p>
      ) : (
        <div className="unit-options">
          {availableUnits.map((unit, index) => (
            <label key={unit.id}>
              <input
                type={mode === "multiple" ? "checkbox" : "radio"}
                name="unitIds"
                value={unit.id}
                required={mode !== "multiple"}
                defaultChecked={
                  selectedIds.has(unit.id) ||
                  (selectedIds.size === 0 && mode === "main" && index === 0)
                }
              />
              <span>
                {unit.name}
                {unit.code ? <small>{unit.code}</small> : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
