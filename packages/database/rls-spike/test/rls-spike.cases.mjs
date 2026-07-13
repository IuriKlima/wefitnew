import assert from "node:assert/strict";

import { readLocalContext, setLocalContext, withRoleTransaction } from "../src/database.mjs";
import { ids, roles, SCHEMA_NAME } from "../src/constants.mjs";
import { expectDatabaseError, numericCount } from "../src/test-registry.mjs";

const contexts = Object.freeze({
  globalA: {
    actorUserId: ids.userGlobalA,
    organizationId: ids.organizationA,
    correlationId: "spike-global-a"
  },
  scopedA1: {
    actorUserId: ids.userScopedA1,
    organizationId: ids.organizationA,
    unitId: ids.unitA1,
    correlationId: "spike-a1"
  },
  globalAAtA1: {
    actorUserId: ids.userGlobalA,
    organizationId: ids.organizationA,
    unitId: ids.unitA1,
    correlationId: "spike-global-a-at-a1"
  },
  globalAAtA2: {
    actorUserId: ids.userGlobalA,
    organizationId: ids.organizationA,
    unitId: ids.unitA2,
    correlationId: "spike-global-a-at-a2"
  },
  globalB: {
    actorUserId: ids.userGlobalB,
    organizationId: ids.organizationB,
    correlationId: "spike-global-b"
  }
});

export function registerSpikeTests(registry, primaryClient, concurrentClient) {
  registerRoleAndCatalogTests(registry, primaryClient);
  registerIamTests(registry, primaryClient);
  registerMembershipRoleTests(registry, primaryClient);
  registerIsolationTests(registry, primaryClient);
  registerContextTests(registry, primaryClient, concurrentClient);
  registerWriteAndConstraintTests(registry, primaryClient);
  registerSecurityDefinerTests(registry, primaryClient);
  registerWorkerAndOperationsTests(registry, primaryClient);
  registerInvariantTests(registry, primaryClient, concurrentClient);
  registerPerformanceTests(registry, primaryClient);
}

function registerRoleAndCatalogTests(registry, prisma) {
  registry.test("roles", "roles runtime nao possuem atributos administrativos", async () => {
    const roleRows = await withRoleTransaction(
      prisma,
      roles.api,
      null,
      (transaction) =>
        transaction.$queryRaw`
        SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin
        FROM pg_catalog.pg_roles
        WHERE rolname IN (
          'wefit_migrator_spike_test',
          'wefit_api_spike_test',
          'wefit_worker_spike_test',
          'wefit_ops_read_spike_test',
          'wefit_ops_write_spike_test',
          'wefit_rls_owner_spike_test'
        )
        ORDER BY rolname
      `
    );

    assert.equal(roleRows.length, 6);
    for (const role of roleRows) {
      assert.equal(role.rolsuper, false);
      if (role.rolname === 'wefit_rls_owner_spike_test') {
        assert.equal(role.rolbypassrls, true);
      } else {
        assert.equal(role.rolbypassrls, false);
      }
      assert.equal(role.rolcreatedb, false);
      assert.equal(role.rolcreaterole, false);
      assert.equal(role.rolcanlogin, false);
    }
  });

  registry.test("roles", "todas as tabelas do spike usam ENABLE e FORCE RLS", async () => {
    const tables = await withRoleTransaction(
      prisma,
      roles.api,
      null,
      (transaction) =>
        transaction.$queryRaw`
        SELECT relation.relname, relation.relrowsecurity, relation.relforcerowsecurity
        FROM pg_catalog.pg_class AS relation
        INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = ${SCHEMA_NAME}
          AND relation.relkind = 'r'
        ORDER BY relation.relname
      `
    );

    assert.equal(tables.length, 12);
    for (const table of tables) {
      assert.equal(table.relrowsecurity, true, `${table.relname} sem RLS.`);
      assert.equal(table.relforcerowsecurity, true, `${table.relname} sem FORCE RLS.`);
    }
  });

  registry.test("roles", "API e worker nao sao donos de tabelas", async () => {
    const owners = await withRoleTransaction(
      prisma,
      roles.api,
      null,
      (transaction) =>
        transaction.$queryRaw`
        SELECT DISTINCT owner.rolname
        FROM pg_catalog.pg_class AS relation
        INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        INNER JOIN pg_catalog.pg_roles AS owner ON owner.oid = relation.relowner
        WHERE namespace.nspname = ${SCHEMA_NAME}
          AND relation.relkind = 'r'
      `
    );

    assert.deepEqual(
      owners.map((owner) => owner.rolname),
      [roles.migrator]
    );
  });

  registry.test("roles", "FORCE RLS tambem restringe o owner das tabelas", async () => {
    const withoutContext = await withRoleTransaction(
      prisma,
      roles.migrator,
      null,
      (transaction) => transaction.$queryRaw`SELECT COUNT(*) AS count FROM rls_spike.organization`
    );
    assert.equal(numericCount(withoutContext), 0);

    const withContext = await withRoleTransaction(
      prisma,
      roles.migrator,
      contexts.globalA,
      (transaction) => transaction.$queryRaw`SELECT COUNT(*) AS count FROM rls_spike.organization`
    );
    assert.equal(numericCount(withContext), 1);
  });
}

function registerIamTests(registry, prisma) {
  registry.test("iam", "ator global descobre o grafo IAM da sua organizacao", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.globalA, async (transaction) => {
      const memberships = await transaction.$queryRaw`
        SELECT id FROM rls_spike.membership ORDER BY id
      `;
      const assignments = await transaction.$queryRaw`
        SELECT id FROM rls_spike.membership_role ORDER BY id
      `;
      const roleRows = await transaction.$queryRaw`SELECT id FROM rls_spike.role ORDER BY id`;
      const permissionRows = await transaction.$queryRaw`
        SELECT role_id FROM rls_spike.role_permission ORDER BY role_id
      `;

      // Org A has 3 memberships in seed.mjs
      assert.equal(memberships.length, 3);
      // Org A has 3 membership_role assignments
      assert.equal(assignments.length, 3);
      // Org A has 3 roles
      assert.equal(roleRows.length, 3);
      // Org A has permissions? seed.mjs inserts permissions for all roles
      assert.equal(permissionRows.length, 3);
    });
  });

  registry.test("iam", "ator A1 nao recebe role global nem role de A2", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
      const assignments = await transaction.$queryRaw`
        SELECT role_id, unit_id FROM rls_spike.membership_role ORDER BY role_id
      `;
      const roleRows = await transaction.$queryRaw`SELECT id FROM rls_spike.role ORDER BY id`;

      assert.deepEqual(assignments, [{ role_id: ids.roleScopedA1, unit_id: ids.unitA1 }]);
      assert.deepEqual(
        roleRows.map((row) => row.id),
        [ids.roleScopedA1]
      );
    });
  });

  registry.test("iam", "membership suspensa nao produz grants", async () => {
    const suspendedContext = {
      actorUserId: ids.userSuspendedA,
      organizationId: ids.organizationA,
      correlationId: "spike-suspended-a"
    };
    await withRoleTransaction(prisma, roles.api, suspendedContext, async (transaction) => {
      const memberships = await transaction.$queryRaw`
        SELECT id FROM rls_spike.membership
      `;
      const assignments = await transaction.$queryRaw`
        SELECT id FROM rls_spike.membership_role
      `;
      const organizations = await transaction.$queryRaw`
        SELECT id FROM rls_spike.organization
      `;

      assert.equal(memberships.length, 0);
      assert.equal(assignments.length, 0);
      assert.equal(organizations.length, 0);
    });
  });

  registry.test("iam", "ator de B nao descobre IAM de A", async () => {
    const forgedContext = {
      actorUserId: ids.userGlobalB,
      organizationId: ids.organizationA,
      correlationId: "spike-forged-b-at-a"
    };
    await withRoleTransaction(prisma, roles.api, forgedContext, async (transaction) => {
      const memberships = await transaction.$queryRaw`SELECT id FROM rls_spike.membership`;
      const rolesFound = await transaction.$queryRaw`SELECT id FROM rls_spike.role`;
      assert.equal(memberships.length, 0);
      assert.equal(rolesFound.length, 0);
    });
  });
}

function registerMembershipRoleTests(registry, prisma) {
  registry.test(
    "membership_role",
    "usuario A1 nao consegue criar MembershipRole global (unit_id = NULL)",
    async () => {
      await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.api,
            contexts.scopedA1,
            (transaction) =>
              transaction.$executeRaw`
              INSERT INTO rls_spike.membership_role (organization_id, membership_id, role_id, unit_id)
              VALUES (${ids.organizationA}::uuid, ${ids.membershipScopedA1}::uuid, ${ids.roleScopedA1}::uuid, NULL)
            `
          ),
        ["42501"]
      );
    }
  );

  registry.test(
    "membership_role",
    "usuario A1 nao consegue atualizar um vinculo A1 para global",
    async () => {
      await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.api,
            contexts.scopedA1,
            (transaction) =>
              transaction.$executeRaw`
              UPDATE rls_spike.membership_role
              SET unit_id = NULL
              WHERE organization_id = ${ids.organizationA}::uuid
                AND role_id = ${ids.roleScopedA1}::uuid
                AND unit_id = ${ids.unitA1}::uuid
            `
          ),
        ["42501"]
      );
    }
  );

  registry.test(
    "membership_role",
    "usuario A1 nao consegue alterar ou excluir vinculo global",
    async () => {
      await withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
        const updated = await transaction.$executeRaw`
          UPDATE rls_spike.membership_role
          SET unit_id = ${ids.unitA1}::uuid
          WHERE organization_id = ${ids.organizationA}::uuid
            AND role_id = ${ids.roleGlobalA}::uuid
            AND unit_id IS NULL
        `;
        assert.equal(updated, 0);

        const deleted = await transaction.$executeRaw`
          DELETE FROM rls_spike.membership_role
          WHERE organization_id = ${ids.organizationA}::uuid
            AND role_id = ${ids.roleGlobalA}::uuid
            AND unit_id IS NULL
        `;
        assert.equal(deleted, 0);
      });
    }
  );

  registry.test(
    "membership_role",
    "usuario A1 consulta apenas seu grafo permitido",
    async () => {
      await withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
        const rolesFound = await transaction.$queryRaw`
          SELECT role_id FROM rls_spike.membership_role
        `;
        assert.deepEqual(
          rolesFound.map((r) => r.role_id),
          [ids.roleScopedA1]
        );
      });
    }
  );

  registry.test(
    "membership_role",
    "ator global da organizacao A continua gerenciando vinculos globais e locais",
    async () => {
      await withRoleTransaction(prisma, roles.api, contexts.globalA, async (transaction) => {
        // Can see all roles in org A
        const rolesFound = await transaction.$queryRaw`
          SELECT role_id FROM rls_spike.membership_role ORDER BY role_id
        `;
        assert.equal(rolesFound.length, 3); // globalA, scopedA1, suspendedA
      });
    }
  );

  registry.test(
    "membership_role",
    "tentativas negadas nao alteram vinculos e A1 continua sem acesso a A2",
    async () => {
      await withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
        const students = await transaction.$queryRaw`
          SELECT id FROM rls_spike.student ORDER BY id
        `;
        assert.equal(students.some((s) => s.id === ids.studentA2), false);
      });
    }
  );
}

function registerIsolationTests(registry, prisma) {
  registry.test(
    "isolamento",
    "query sem filtro explicito continua limitada ao tenant A",
    async () => {
      const students = await withRoleTransaction(
        prisma,
        roles.api,
        contexts.globalA,
        (transaction) => transaction.$queryRaw`SELECT id FROM rls_spike.student ORDER BY id`
      );

      assert.equal(students.length, 5);
      assert.equal(
        students.some((student) => student.id === ids.studentB1),
        false
      );
    }
  );

  registry.test("isolamento", "tenant B nao retorna unidades, alunos ou logs de A", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.globalB, async (transaction) => {
      const units = await transaction.$queryRaw`SELECT organization_id FROM rls_spike.unit`;
      const students = await transaction.$queryRaw`
        SELECT organization_id FROM rls_spike.student
      `;
      const logs = await transaction.$queryRaw`
        SELECT organization_id FROM rls_spike.audit_log
      `;

      assert.deepEqual(
        units.map((row) => row.organization_id),
        [ids.organizationB]
      );
      assert.deepEqual(
        students.map((row) => row.organization_id),
        [ids.organizationB]
      );
      assert.deepEqual(
        logs.map((row) => row.organization_id),
        [ids.organizationB]
      );
    });
  });

  registry.test("unidade", "A1 ve aluno exclusivo e compartilhado, mas nao A2", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
      const students = await transaction.$queryRaw`
        SELECT id FROM rls_spike.student ORDER BY id
      `;
      const links = await transaction.$queryRaw`
        SELECT student_id, unit_id FROM rls_spike.student_unit ORDER BY student_id
      `;

      assert.deepEqual(
        students.map((row) => row.id),
        [ids.studentA1, ids.studentSharedA, ids.studentInvariantA1]
      );
      assert.equal(
        students.some((student) => student.id === ids.studentA2),
        false
      );
      assert.equal(
        links.every((link) => link.unit_id === ids.unitA1),
        true
      );
      assert.equal(
        links.some((link) => link.student_id === ids.studentSharedA),
        true
      );
    });
  });

  registry.test("unidade", "grant A1 sem unit_id no contexto nao ganha escopo global", async () => {
    const scopedWithoutUnit = {
      actorUserId: ids.userScopedA1,
      organizationId: ids.organizationA,
      correlationId: "spike-a1-without-unit"
    };
    const students = await withRoleTransaction(
      prisma,
      roles.api,
      scopedWithoutUnit,
      (transaction) => transaction.$queryRaw`SELECT id FROM rls_spike.student`
    );
    assert.equal(students.length, 0);
  });

  registry.test("unidade", "unit_id de outra organizacao nao concede acesso", async () => {
    const invalidUnitContext = {
      actorUserId: ids.userGlobalA,
      organizationId: ids.organizationA,
      unitId: ids.unitB1,
      correlationId: "spike-cross-tenant-unit"
    };
    const units = await withRoleTransaction(
      prisma,
      roles.api,
      invalidUnitContext,
      (transaction) => transaction.$queryRaw`SELECT id FROM rls_spike.unit`
    );
    assert.equal(units.length, 0);
  });

  registry.test("auditoria", "audit log respeita organization_id e unit_id", async () => {
    const scopedLogs = await withRoleTransaction(
      prisma,
      roles.api,
      contexts.globalAAtA1,
      (transaction) => transaction.$queryRaw`SELECT id, unit_id FROM rls_spike.audit_log`
    );
    assert.equal(scopedLogs.length, 1);
    assert.equal(scopedLogs[0].unit_id, ids.unitA1);

    const globalLogs = await withRoleTransaction(
      prisma,
      roles.api,
      contexts.globalA,
      (transaction) => transaction.$queryRaw`SELECT id FROM rls_spike.audit_log`
    );
    assert.equal(globalLogs.length, 2);
  });

  registry.test("isolamento", "contexto ausente ou UUID invalido falha fechado", async () => {
    const withoutContext = await withRoleTransaction(
      prisma,
      roles.api,
      null,
      (transaction) => transaction.$queryRaw`SELECT id FROM rls_spike.student`
    );
    assert.equal(withoutContext.length, 0);

    const invalidContext = {
      actorUserId: ids.userGlobalA,
      organizationId: "not-a-uuid",
      correlationId: "spike-invalid-context"
    };
    const invalid = await withRoleTransaction(
      prisma,
      roles.api,
      invalidContext,
      (transaction) => transaction.$queryRaw`SELECT id FROM rls_spike.student`
    );
    assert.equal(invalid.length, 0);
  });
}

function registerContextTests(registry, prisma, concurrentPrisma) {
  registry.test("contexto", "GUC local e removida depois de COMMIT na mesma conexao", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.globalA, async (transaction) => {
      const context = await readLocalContext(transaction);
      assert.equal(context.organization_id, ids.organizationA);
    });

    const afterCommit = await withRoleTransaction(prisma, roles.api, null, readLocalContext);
    assert.equal(afterCommit.organization_id, null);
    assert.equal(afterCommit.unit_id, null);
    assert.equal(afterCommit.actor_user_id, null);
  });

  registry.test(
    "contexto",
    "GUC local e removida depois de ROLLBACK na mesma conexao",
    async () => {
      await assert.rejects(
        withRoleTransaction(prisma, roles.api, contexts.scopedA1, async () => {
          throw new Error("rollback-intencional");
        }),
        /rollback-intencional/
      );

      const afterRollback = await withRoleTransaction(prisma, roles.api, null, readLocalContext);
      assert.equal(afterRollback.organization_id, null);
      assert.equal(afterRollback.unit_id, null);
      assert.equal(afterRollback.actor_user_id, null);
    }
  );

  registry.test(
    "contexto",
    "cem alternancias em pool de uma conexao nao vazam tenant",
    async () => {
      for (let index = 0; index < 100; index += 1) {
        const useTenantA = index % 2 === 0;
        const rows = await withRoleTransaction(
          prisma,
          roles.api,
          useTenantA ? contexts.globalA : contexts.globalB,
          (transaction) => transaction.$queryRaw`SELECT COUNT(*) AS count FROM rls_spike.student`
        );
        assert.equal(numericCount(rows), useTenantA ? 5 : 1);
      }
    }
  );

  registry.test(
    "contexto",
    "transacoes concorrentes com tenants diferentes nao misturam dados",
    async () => {
      const operations = Array.from({ length: 20 }, (_, index) => {
        const useTenantA = index % 2 === 0;
        return withRoleTransaction(
          concurrentPrisma,
          roles.api,
          useTenantA ? contexts.globalA : contexts.globalB,
          (transaction) => transaction.$queryRaw`SELECT COUNT(*) AS count FROM rls_spike.student`
        ).then((rows) => ({ useTenantA, count: numericCount(rows) }));
      });
      const results = await Promise.all(operations);

      for (const result of results) {
        assert.equal(result.count, result.useTenantA ? 5 : 1);
      }
    }
  );

  registry.test("contexto", "timeout nao deixa contexto residual", async () => {
    await assert.rejects(
      withRoleTransaction(
        prisma,
        roles.api,
        contexts.globalA,
        (transaction) => transaction.$queryRaw`SELECT pg_catalog.pg_sleep(1)`,
        { timeout: 100 }
      )
    );

    const context = await withRoleTransaction(prisma, roles.api, null, readLocalContext);
    assert.equal(context.organization_id, null);
    assert.equal(context.actor_user_id, null);
  });
}

function registerWriteAndConstraintTests(registry, prisma) {
  registry.test(
    "escrita",
    "INSERT de tenant B com contexto A e bloqueado por WITH CHECK",
    async () => {
      await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.api,
            contexts.globalA,
            (transaction) =>
              transaction.$executeRaw`
            INSERT INTO rls_spike.student (id, organization_id, name)
            VALUES ('73000000-0000-4000-8000-000000000001', ${ids.organizationB}::uuid, 'Negado B')
          `
          ),
        ["42501"]
      );
    }
  );

  registry.test("escrita", "UPDATE e DELETE de B com contexto A afetam zero linhas", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.globalA, async (transaction) => {
      const updated = await transaction.$executeRaw`
        UPDATE rls_spike.student SET name = 'Alteracao indevida' WHERE id = ${ids.studentB1}::uuid
      `;
      const deleted = await transaction.$executeRaw`
        DELETE FROM rls_spike.student WHERE id = ${ids.studentB1}::uuid
      `;
      assert.equal(updated, 0);
      assert.equal(deleted, 0);
    });
  });

  registry.test("escrita", "WITH CHECK bloqueia troca de organization_id", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.globalA,
          (transaction) =>
            transaction.$executeRaw`
            UPDATE rls_spike.student
            SET organization_id = ${ids.organizationB}::uuid
            WHERE id = ${ids.studentA1}::uuid
          `
        ),
      ["42501"]
    );
  });

  registry.test("escrita", "WITH CHECK bloqueia troca de unit_id fora de A1", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.scopedA1,
          (transaction) =>
            transaction.$executeRaw`
            UPDATE rls_spike.student_unit
            SET unit_id = ${ids.unitA2}::uuid
            WHERE student_id = ${ids.studentA1}::uuid
              AND unit_id = ${ids.unitA1}::uuid
          `
        ),
      ["42501"]
    );
  });

  registry.test("integridade", "FK composta bloqueia StudentUnit cross-tenant", async () => {
    const hiddenExisting = await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.globalA,
          (transaction) =>
            transaction.$executeRaw`
            INSERT INTO rls_spike.student_unit (id, organization_id, student_id, unit_id)
            VALUES (
              '86000000-0000-4000-8000-000000000001',
              ${ids.organizationA}::uuid,
              ${ids.studentB1}::uuid,
              ${ids.unitA1}::uuid
            )
          `
        ),
      ["23503"]
    );
    const nonexistent = await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.globalA,
          (transaction) =>
            transaction.$executeRaw`
            INSERT INTO rls_spike.student_unit (id, organization_id, student_id, unit_id)
            VALUES (
              '86000000-0000-4000-8000-000000000002',
              ${ids.organizationA}::uuid,
              'ffffffff-0000-4000-8000-000000000001',
              ${ids.unitA1}::uuid
            )
          `
        ),
      ["23503"]
    );

    assert.equal(hiddenExisting.publicMessage, nonexistent.publicMessage);
  });

  registry.test("integridade", "unicidade ativa de StudentUnit permanece valida", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.globalA,
          (transaction) =>
            transaction.$executeRaw`
            INSERT INTO rls_spike.student_unit (id, organization_id, student_id, unit_id)
            VALUES (
              '86000000-0000-4000-8000-000000000003',
              ${ids.organizationA}::uuid,
              ${ids.studentA1}::uuid,
              ${ids.unitA1}::uuid
            )
          `
        ),
      ["23505"]
    );
  });

  registry.test(
    "canal-lateral",
    "unique e primary key internas exigem normalizacao externa",
    async () => {
      const uniqueLeak = await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.api,
            contexts.globalA,
            (transaction) =>
              transaction.$executeRaw`
            INSERT INTO rls_spike.constraint_probe (id, organization_id, external_key)
            VALUES (
              '72000000-0000-4000-8000-000000000002',
              ${ids.organizationA}::uuid,
              'hidden-b-key'
            )
          `
          ),
        ["23505"]
      );
      const primaryKeyLeak = await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.api,
            contexts.globalA,
            (transaction) =>
              transaction.$executeRaw`
            INSERT INTO rls_spike.constraint_probe (id, organization_id, external_key)
            VALUES (
              ${ids.constraintProbeB}::uuid,
              ${ids.organizationA}::uuid,
              'different-key'
            )
          `
          ),
        ["23505"]
      );

      assert.equal(uniqueLeak.publicMessage, primaryKeyLeak.publicMessage);
      assert.equal(uniqueLeak.publicMessage.includes("constraint"), false);
      assert.equal(uniqueLeak.publicMessage.includes("hidden-b-key"), false);
    }
  );

  registry.test("auditoria", "INSERT de log cross-tenant e bloqueado", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.globalAAtA1,
          (transaction) =>
            transaction.$executeRaw`
            INSERT INTO rls_spike.audit_log (
              id, organization_id, unit_id, actor_user_id, action, correlation_id
            ) VALUES (
              'a1000000-0000-4000-8000-000000000010',
              ${ids.organizationB}::uuid,
              ${ids.unitB1}::uuid,
              ${ids.userGlobalA}::uuid,
              'cross-tenant.denied',
              'spike-cross-tenant-log'
            )
          `
        ),
      ["42501"]
    );
  });
}

function registerSecurityDefinerTests(registry, prisma) {
  registry.test(
    "security-definer",
    "funcoes possuem owner NOLOGIN e search_path seguro",
    async () => {
      const functions = await withRoleTransaction(
        prisma,
        roles.api,
        null,
        (transaction) =>
          transaction.$queryRaw`
        SELECT
          procedure.proname,
          procedure.prosecdef,
          procedure.proconfig,
          procedure.proacl::text AS acl,
          procedure.prosrc,
          owner.rolname AS owner_name,
          owner.rolcanlogin AS owner_can_login
        FROM pg_catalog.pg_proc AS procedure
        INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
        INNER JOIN pg_catalog.pg_roles AS owner ON owner.oid = procedure.proowner
        WHERE namespace.nspname = ${SCHEMA_NAME}
          AND procedure.proname IN ('has_global_scope', 'can_access_unit')
        ORDER BY procedure.proname
      `
      );

      assert.equal(functions.length, 2);
      for (const functionDefinition of functions) {
        assert.equal(functionDefinition.prosecdef, true);
        assert.equal(functionDefinition.owner_name, roles.owner);
        assert.equal(functionDefinition.owner_can_login, false);
        assert.deepEqual(functionDefinition.proconfig, ["search_path=pg_catalog, rls_spike"]);
        // PUBLIC execution privilege is represented by an empty grantee (e.g. {=X/...} or ,=X/...)
        assert.equal(/(^|{)[^=]*=X\//.test(functionDefinition.acl) && functionDefinition.acl.includes("{=X/") || functionDefinition.acl.includes(",=X/"), false);
        assert.equal(/\bEXECUTE\b/i.test(functionDefinition.prosrc), false);
      }
    }
  );

  registry.test("security-definer", "argumento cross-tenant nao amplia o escopo", async () => {
    const [result] = await withRoleTransaction(
      prisma,
      roles.api,
      contexts.globalA,
      (transaction) =>
        transaction.$queryRaw`
          SELECT
            rls_spike.has_global_scope(${ids.organizationB}::uuid) AS global_b,
            rls_spike.can_access_unit(${ids.organizationB}::uuid, ${ids.unitB1}::uuid) AS unit_b
        `
    );
    assert.equal(result.global_b, false);
    assert.equal(result.unit_b, false);
  });

  registry.test(
    "security-definer",
    "API nao e membro do owner e nao pode criar objetos",
    async () => {
      const [membership] = await withRoleTransaction(
        prisma,
        roles.api,
        null,
        (transaction) =>
          transaction.$queryRaw`
        SELECT pg_catalog.pg_has_role(
          'wefit_api_spike_test',
          'wefit_rls_owner_spike_test',
          'MEMBER'
        ) AS is_member
      `
      );
      assert.equal(membership.is_member, false);

      await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.api,
            contexts.globalA,
            (transaction) =>
              transaction.$executeRaw`CREATE TABLE rls_spike.escalation_attempt (id integer)`
          ),
        ["42501"]
      );
    }
  );

  registry.test(
    "security-definer",
    "search_path hostil nao altera funcoes qualificadas",
    async () => {
      const [result] = await withRoleTransaction(
        prisma,
        roles.api,
        contexts.globalA,
        async (transaction) => {
          await transaction.$executeRaw`SET LOCAL search_path = public, pg_catalog`;
          return transaction.$queryRaw`
          SELECT rls_spike.has_global_scope(${ids.organizationA}::uuid) AS allowed
        `;
        }
      );
      assert.equal(result.allowed, true);
    }
  );
}

function registerWorkerAndOperationsTests(registry, prisma) {
  registry.test("worker", "job com contexto A nao le nem escreve tenant B", async () => {
    await withRoleTransaction(prisma, roles.worker, contexts.globalAAtA1, async (transaction) => {
      const students = await transaction.$queryRaw`
        SELECT organization_id FROM rls_spike.student
      `;
      assert.equal(students.length, 3);
      assert.equal(
        students.every((row) => row.organization_id === ids.organizationA),
        true
      );

      await transaction.$executeRaw`
        INSERT INTO rls_spike.audit_log (
          id, organization_id, unit_id, actor_user_id, action, correlation_id
        ) VALUES (
          'a1000000-0000-4000-8000-000000000020',
          ${ids.organizationA}::uuid,
          ${ids.unitA1}::uuid,
          ${ids.userGlobalA}::uuid,
          'worker.processed',
          'spike-worker-a1'
        )
      `;
    });

    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.worker,
          contexts.globalAAtA1,
          (transaction) =>
            transaction.$executeRaw`
            INSERT INTO rls_spike.audit_log (
              id, organization_id, unit_id, actor_user_id, action, correlation_id
            ) VALUES (
              'a1000000-0000-4000-8000-000000000021',
              ${ids.organizationB}::uuid,
              ${ids.unitB1}::uuid,
              ${ids.userGlobalA}::uuid,
              'worker.cross-tenant',
              'spike-worker-cross-tenant'
            )
          `
        ),
      ["42501"]
    );
  });

  registry.test("worker", "worker nao possui grant de UPDATE em Student", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.worker,
          contexts.globalA,
          (transaction) =>
            transaction.$executeRaw`
            UPDATE rls_spike.student SET name = 'Worker indevido' WHERE id = ${ids.studentA1}::uuid
          `
        ),
      ["42501"]
    );
  });

  registry.test(
    "operacao",
    "ops read nao escreve e ops write permanece tenant-scoped",
    async () => {
      await expectDatabaseError(
        () =>
          withRoleTransaction(
            prisma,
            roles.opsRead,
            contexts.globalA,
            (transaction) =>
              transaction.$executeRaw`
            INSERT INTO rls_spike.constraint_probe (id, organization_id, external_key)
            VALUES ('72000000-0000-4000-8000-000000000003', ${ids.organizationA}::uuid, 'ops-read')
          `
          ),
        ["42501"]
      );

      const updated = await withRoleTransaction(
        prisma,
        roles.opsWrite,
        contexts.globalA,
        (transaction) =>
          transaction.$executeRaw`
          UPDATE rls_spike.student SET name = 'Ops indevido' WHERE id = ${ids.studentB1}::uuid
        `
      );
      assert.equal(updated, 0);
    }
  );

  registry.test(
    "compatibilidade",
    "SQL arbitrario como wefit_api consegue trocar GUC",
    async () => {
      await withRoleTransaction(prisma, roles.api, contexts.globalA, async (transaction) => {
        const before = await transaction.$queryRaw`SELECT id FROM rls_spike.organization`;
        assert.deepEqual(
          before.map((row) => row.id),
          [ids.organizationA]
        );

        await setLocalContext(transaction, contexts.globalB);
        const after = await transaction.$queryRaw`SELECT id FROM rls_spike.organization`;
        assert.deepEqual(
          after.map((row) => row.id),
          [ids.organizationB]
        );
      });
    }
  );
}

function registerInvariantTests(registry, prisma, concurrentPrisma) {
  registry.test("invariante", "Student ativo sem StudentUnit falha somente no COMMIT", async () => {
    let callbackCompleted = false;
    await expectDatabaseError(
      () =>
        withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
          await transaction.$executeRaw`
            INSERT INTO rls_spike.student (id, organization_id, name)
            VALUES ('66000000-0000-4000-8000-000000000001', ${ids.organizationA}::uuid, 'Sem vinculo')
          `;
          callbackCompleted = true;
        }),
      ["23514"]
    );
    assert.equal(callbackCompleted, true);
  });

  registry.test("invariante", "Student e StudentUnit corretos passam no mesmo COMMIT", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO rls_spike.student (id, organization_id, name)
        VALUES ('66000000-0000-4000-8000-000000000002', ${ids.organizationA}::uuid, 'Com vinculo')
      `;
      await transaction.$executeRaw`
        INSERT INTO rls_spike.student_unit (id, organization_id, student_id, unit_id)
        VALUES (
          '86000000-0000-4000-8000-000000000010',
          ${ids.organizationA}::uuid,
          '66000000-0000-4000-8000-000000000002',
          ${ids.unitA1}::uuid
        )
      `;
    });

    const persisted = await withRoleTransaction(
      prisma,
      roles.api,
      contexts.globalA,
      (transaction) =>
        transaction.$queryRaw`
          SELECT id FROM rls_spike.student
          WHERE id = '66000000-0000-4000-8000-000000000002'
        `
    );
    assert.equal(persisted.length, 1);
  });

  registry.test("invariante", "vinculo para unidade errada falha fechado", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
          await transaction.$executeRaw`
            INSERT INTO rls_spike.student (id, organization_id, name)
            VALUES ('66000000-0000-4000-8000-000000000003', ${ids.organizationA}::uuid, 'Unidade errada')
          `;
          await transaction.$executeRaw`
            INSERT INTO rls_spike.student_unit (id, organization_id, student_id, unit_id)
            VALUES (
              '86000000-0000-4000-8000-000000000011',
              ${ids.organizationA}::uuid,
              '66000000-0000-4000-8000-000000000003',
              ${ids.unitA2}::uuid
            )
          `;
        }),
      ["42501"]
    );
  });

  registry.test("invariante", "remocao do ultimo vinculo ativo falha no COMMIT", async () => {
    await expectDatabaseError(
      () =>
        withRoleTransaction(
          prisma,
          roles.api,
          contexts.globalAAtA1,
          (transaction) =>
            transaction.$executeRaw`
            DELETE FROM rls_spike.student_unit
            WHERE student_id = ${ids.studentInvariantA1}::uuid
              AND unit_id = ${ids.unitA1}::uuid
          `
        ),
      ["23514"]
    );
  });

  registry.test("invariante", "rollback nao deixa Student parcial", async () => {
    await assert.rejects(
      withRoleTransaction(prisma, roles.api, contexts.scopedA1, async (transaction) => {
        await transaction.$executeRaw`
          INSERT INTO rls_spike.student (id, organization_id, name)
          VALUES ('66000000-0000-4000-8000-000000000004', ${ids.organizationA}::uuid, 'Rollback')
        `;
        throw new Error("rollback-invariante");
      }),
      /rollback-invariante/
    );

    const rows = await withRoleTransaction(
      prisma,
      roles.api,
      contexts.globalA,
      (transaction) =>
        transaction.$queryRaw`
        SELECT id FROM rls_spike.student
        WHERE id = '66000000-0000-4000-8000-000000000004'
      `
    );
    assert.equal(rows.length, 0);
  });

  registry.test(
    "invariante",
    "transacoes concorrentes preservam vinculos obrigatorios",
    async () => {
      const attempts = await Promise.allSettled([
        withRoleTransaction(
          concurrentPrisma,
          roles.api,
          contexts.globalAAtA1,
          (transaction) =>
            transaction.$executeRaw`
          DELETE FROM rls_spike.student_unit
          WHERE student_id = ${ids.studentInvariantA1}::uuid
            AND unit_id = ${ids.unitA1}::uuid
        `
        ),
        withRoleTransaction(
          concurrentPrisma,
          roles.api,
          contexts.globalAAtA2,
          (transaction) =>
            transaction.$executeRaw`
          DELETE FROM rls_spike.student_unit
          WHERE student_id = ${ids.studentInvariantA2}::uuid
            AND unit_id = ${ids.unitA2}::uuid
        `
        )
      ]);

      assert.equal(
        attempts.every((attempt) => attempt.status === "rejected"),
        true
      );
      for (const attempt of attempts) {
        if (attempt.status === "rejected") {
          const details = await expectRejectedDatabaseError(attempt.reason, ["23514"]);
          assert.equal(details.publicMessage, "Operacao nao permitida para o contexto informado.");
        }
      }
    }
  );

  registry.test("invariante", "soft delete coordenado de Student e StudentUnit passa", async () => {
    await withRoleTransaction(prisma, roles.api, contexts.globalAAtA1, async (transaction) => {
      await transaction.$executeRaw`
        UPDATE rls_spike.student
        SET status = 'INACTIVE', deleted_at = clock_timestamp()
        WHERE id = ${ids.studentInvariantA1}::uuid
      `;
      await transaction.$executeRaw`
        UPDATE rls_spike.student_unit
        SET deleted_at = clock_timestamp()
        WHERE student_id = ${ids.studentInvariantA1}::uuid
          AND unit_id = ${ids.unitA1}::uuid
      `;
    });

    const [student] = await withRoleTransaction(
      prisma,
      roles.api,
      contexts.globalA,
      (transaction) =>
        transaction.$queryRaw`
          SELECT status, deleted_at FROM rls_spike.student
          WHERE id = ${ids.studentInvariantA1}::uuid
        `
    );
    assert.equal(student.status, "INACTIVE");
    assert.notEqual(student.deleted_at, null);
  });
}

function registerPerformanceTests(registry, prisma) {
  registry.test(
    "performance",
    "EXPLAIN ANALYZE mantem indice de StudentUnit disponivel",
    async () => {
      const plan = await withRoleTransaction(
        prisma,
        roles.api,
        contexts.globalAAtA1,
        async (transaction) => {
          await transaction.$executeRaw`SET LOCAL enable_seqscan = off`;
          return transaction.$queryRaw`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          SELECT student_id
          FROM rls_spike.student_unit
          WHERE organization_id = ${ids.organizationA}::uuid
            AND unit_id = ${ids.unitA1}::uuid
            AND deleted_at IS NULL
        `;
        }
      );

      const serializedPlan = JSON.stringify(plan);
      assert.equal(serializedPlan.includes("student_unit_scope_idx"), true);
    }
  );
}

async function expectRejectedDatabaseError(error, expectedSqlStates) {
  return expectDatabaseError(() => Promise.reject(error), expectedSqlStates);
}
