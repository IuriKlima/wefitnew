import type { UnitSummary } from "@gym-platform/contracts";

type UnitSelectorProps = {
  units: UnitSummary[];
  selectedUnitIds?: string[];
};

export function UnitSelector({ units, selectedUnitIds = [] }: UnitSelectorProps) {
  const selectedIds = new Set(selectedUnitIds);

  return (
    <fieldset className="span-2 unit-selector">
      <legend>Unidades</legend>
      {units.length === 0 ? (
        <p className="muted">Nenhuma unidade disponivel para o seu escopo.</p>
      ) : (
        <div className="unit-options">
          {units.map((unit) => (
            <label key={unit.id}>
              <input
                type="checkbox"
                name="unitIds"
                value={unit.id}
                defaultChecked={selectedIds.has(unit.id)}
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
