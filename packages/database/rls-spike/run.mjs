import assert from "node:assert/strict";

import {
  assertAdministrativeConnection,
  assertDatabaseReachable,
  createSpikeClient,
  executeStaticDdlFile,
  readRequiredDatabaseUrl,
  snapshotNonSpikeRls
} from "./src/database.mjs";
import { seedSpike } from "./src/seed.mjs";
import { createTestRegistry } from "./src/test-registry.mjs";
import { registerSpikeTests } from "./test/rls-spike.cases.mjs";

const sqlFiles = {
  roles: new URL("./sql/00-roles-and-schema.sql", import.meta.url),
  tables: new URL("./sql/01-tables.sql", import.meta.url),
  policies: new URL("./sql/02-context-policies-and-triggers.sql", import.meta.url),
  cleanup: new URL("./sql/90-cleanup.sql", import.meta.url)
};

let primaryClient;
let concurrentClient;
let beforeCatalog;
let environmentValidated = false;

try {
  const database = readRequiredDatabaseUrl();
  await assertDatabaseReachable(database.parsed);

  primaryClient = createSpikeClient(database.value, 1);
  concurrentClient = createSpikeClient(database.value, 2);
  const connection = await assertAdministrativeConnection(primaryClient, database.databaseName);
  environmentValidated = true;
  beforeCatalog = await snapshotNonSpikeRls(primaryClient);

  console.log(
    `RLS spike: banco ${connection.databaseName}, setup por ${connection.roleName}, schema rls_spike.`
  );

  await executeStaticDdlFile(primaryClient, sqlFiles.roles);
  await executeStaticDdlFile(primaryClient, sqlFiles.tables);
  await executeStaticDdlFile(primaryClient, sqlFiles.policies);
  await seedSpike(primaryClient);

  const registry = createTestRegistry();
  registerSpikeTests(registry, primaryClient, concurrentClient);
  await registry.run();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha desconhecida no spike de RLS.");
  process.exitCode = 1;
} finally {
  if (environmentValidated && primaryClient) {
    try {
      await executeStaticDdlFile(primaryClient, sqlFiles.cleanup);
      const afterCatalog = await snapshotNonSpikeRls(primaryClient);
      assert.deepEqual(afterCatalog, beforeCatalog, "O catalogo fora de rls_spike foi alterado.");
      console.log("Cleanup concluido: somente o schema rls_spike foi removido.");
    } catch (cleanupError) {
      console.error("Falha no cleanup seguro do schema rls_spike.");
      console.error(cleanupError);
      process.exitCode = 1;
    }
  }

  await Promise.allSettled([
    primaryClient?.$disconnect() ?? Promise.resolve(),
    concurrentClient?.$disconnect() ?? Promise.resolve()
  ]);
}
