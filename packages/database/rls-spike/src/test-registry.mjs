import assert from "node:assert/strict";

import { databaseErrorDetails } from "./database.mjs";

export function createTestRegistry() {
  const cases = [];

  return {
    test(group, name, execute) {
      cases.push({ group, name, execute });
    },
    async run() {
      const results = [];

      for (const testCase of cases) {
        const startedAt = performance.now();
        try {
          await testCase.execute();
          const durationMs = Math.round(performance.now() - startedAt);
          results.push({ ...testCase, status: "PASS", durationMs });
          console.log(`PASS [${testCase.group}] ${testCase.name} (${durationMs} ms)`);
        } catch (error) {
          const durationMs = Math.round(performance.now() - startedAt);
          results.push({ ...testCase, status: "FAIL", durationMs, error });
          console.error(`FAIL [${testCase.group}] ${testCase.name} (${durationMs} ms)`);
          console.error(error);
        }
      }

      const failed = results.filter((result) => result.status === "FAIL");
      console.log(`RLS spike: ${results.length - failed.length}/${results.length} casos passaram.`);

      if (failed.length > 0) {
        throw new Error(`${failed.length} caso(s) do spike de RLS falharam.`);
      }

      return results;
    }
  };
}

export async function expectDatabaseError(action, expectedSqlStates) {
  try {
    await action();
  } catch (error) {
    const details = databaseErrorDetails(error);
    if (!details.sqlState) {
      console.error("DEBUG: Unexpected error object:", error);
    }
    assert.ok(
      expectedSqlStates.includes(details.sqlState),
      `SQLSTATE esperado: ${expectedSqlStates.join(", ")}; recebido: ${String(details.sqlState)}.`
    );
    assert.equal(details.publicMessage, "Operacao nao permitida para o contexto informado.");
    return details;
  }

  assert.fail(`A operacao deveria falhar com SQLSTATE ${expectedSqlStates.join(" ou ")}.`);
}

export function numericCount(rows) {
  assert.equal(rows.length, 1);
  return Number(rows[0].count);
}
