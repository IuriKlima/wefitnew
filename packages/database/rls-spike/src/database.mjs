import { readFile } from "node:fs/promises";
import { createConnection } from "node:net";

import { PrismaClient } from "@prisma/client";

import { roles, SCHEMA_NAME } from "./constants.mjs";

export function readRequiredDatabaseUrl() {
  const value = process.env.DATABASE_URL_TEST?.trim();

  if (!value) {
    throw new Error(
      "DATABASE_URL_TEST e obrigatoria para o spike de RLS. Nenhum fallback para DATABASE_URL e permitido."
    );
  }

  const parsed = new URL(value);
  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!databaseName.endsWith("_test")) {
    throw new Error(`Execucao recusada: o banco "${databaseName}" nao termina com _test.`);
  }

  return { value, parsed, databaseName };
}

export function createSpikeClient(databaseUrl, connectionLimit = 1) {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.set("connection_limit", String(connectionLimit));
  parsed.searchParams.set("application_name", "wefit-rls-spike");

  return new PrismaClient({
    datasources: {
      db: {
        url: parsed.toString()
      }
    }
  });
}

export function assertDatabaseReachable(databaseUrl) {
  const host = databaseUrl.hostname;
  const port = Number(databaseUrl.port || "5432");

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(
        new Error(`PostgreSQL de teste indisponivel em ${host}:${port}. Execute pnpm docker:up.`)
      );
    }, 2_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once("error", () => {
      clearTimeout(timeout);
      reject(
        new Error(`PostgreSQL de teste indisponivel em ${host}:${port}. Execute pnpm docker:up.`)
      );
    });
  });
}

export async function executeStaticDdlFile(prisma, fileUrl) {
  const sql = await readFile(fileUrl, "utf8");
  const statements = splitStaticSql(sql);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

function splitStaticSql(sql) {
  const statements = [];
  let current = "";
  let dollarTag = null;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (inLineComment) {
      current += character;
      if (character === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += character;
      if (character === "*" && nextCharacter === "/") {
        current += nextCharacter;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += character;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && character === "-" && nextCharacter === "-") {
      inLineComment = true;
      current += character;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && character === "/" && nextCharacter === "*") {
      inBlockComment = true;
      current += character;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && character === "$") {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length - 1;
        continue;
      }
    }

    if (!inDoubleQuote && character === "'") {
      if (inSingleQuote && nextCharacter === "'") {
        current += "''";
        index += 1;
        continue;
      }
      inSingleQuote = !inSingleQuote;
    } else if (!inSingleQuote && character === '"') {
      if (inDoubleQuote && nextCharacter === '"') {
        current += '""';
        index += 1;
        continue;
      }
      inDoubleQuote = !inDoubleQuote;
    }

    if (!inSingleQuote && !inDoubleQuote && character === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

export async function assertAdministrativeConnection(prisma, expectedDatabaseName) {
  const [database] = await prisma.$queryRaw`
    SELECT
      pg_catalog.current_database() AS database_name,
      pg_catalog.current_user AS role_name
  `;
  const [attributes] = await prisma.$queryRaw`
    SELECT rolsuper, rolcreaterole
    FROM pg_catalog.pg_roles
    WHERE rolname = pg_catalog.current_user
  `;

  if (database?.database_name !== expectedDatabaseName) {
    throw new Error("DATABASE_URL_TEST nao aponta para o banco validado no preflight.");
  }

  if (!attributes?.rolsuper) {
    throw new Error(
      "A conexao de setup do spike deve ser a administradora do PostgreSQL descartavel; assertions executam depois com SET LOCAL ROLE sem SUPERUSER."
    );
  }

  return { databaseName: database.database_name, roleName: database.role_name };
}

export async function snapshotNonSpikeRls(prisma) {
  return prisma.$queryRaw`
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS relation_name,
      relation.relrowsecurity AS rls_enabled,
      relation.relforcerowsecurity AS rls_forced
    FROM pg_catalog.pg_class AS relation
    INNER JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE relation.relkind IN ('r', 'p')
      AND namespace.nspname NOT IN ('pg_catalog', 'information_schema', ${SCHEMA_NAME})
      AND namespace.nspname NOT LIKE 'pg_toast%'
    ORDER BY namespace.nspname, relation.relname
  `;
}

export async function withRoleTransaction(prisma, role, context, callback, options = {}) {
  return prisma.$transaction(
    async (transaction) => {
      await setLocalRole(transaction, role);
      if (context) {
        await setLocalContext(transaction, context);
      }
      return callback(transaction);
    },
    {
      maxWait: options.maxWait ?? 5_000,
      timeout: options.timeout ?? 10_000
    }
  );
}

export async function setLocalContext(transaction, context) {
  await transaction.$queryRaw`
    SELECT set_config('app.actor_user_id', ${context.actorUserId ?? ""}, true)
  `;
  await transaction.$queryRaw`
    SELECT set_config('app.organization_id', ${context.organizationId ?? ""}, true)
  `;
  await transaction.$queryRaw`
    SELECT set_config('app.unit_id', ${context.unitId ?? ""}, true)
  `;
  await transaction.$queryRaw`
    SELECT set_config('app.correlation_id', ${context.correlationId ?? "rls-spike"}, true)
  `;
}

export async function readLocalContext(transaction) {
  const [context] = await transaction.$queryRaw`
    SELECT
      rls_spike.current_actor_user_id() AS actor_user_id,
      rls_spike.current_organization_id() AS organization_id,
      rls_spike.current_unit_id() AS unit_id,
      NULLIF(pg_catalog.current_setting('app.correlation_id', true), '') AS correlation_id
  `;
  return context;
}

async function setLocalRole(transaction, role) {
  switch (role) {
    case roles.api:
      return transaction.$executeRaw`SET LOCAL ROLE wefit_api_spike_test`;
    case roles.worker:
      return transaction.$executeRaw`SET LOCAL ROLE wefit_worker_spike_test`;
    case roles.opsRead:
      return transaction.$executeRaw`SET LOCAL ROLE wefit_ops_read_spike_test`;
    case roles.opsWrite:
      return transaction.$executeRaw`SET LOCAL ROLE wefit_ops_write_spike_test`;
    case roles.migrator:
      return transaction.$executeRaw`SET LOCAL ROLE wefit_migrator_spike_test`;
    default:
      throw new Error(`Role nao autorizada pelo harness: ${role}.`);
  }
}

export function databaseErrorDetails(error) {
  const meta = error && typeof error === "object" && "meta" in error ? error.meta : undefined;
  const sqlState = meta && typeof meta === "object" && "code" in meta ? meta.code : undefined;
  const databaseMessage =
    meta && typeof meta === "object" && "message" in meta ? meta.message : undefined;

  return {
    prismaCode: error && typeof error === "object" && "code" in error ? error.code : undefined,
    sqlState,
    databaseMessage,
    publicMessage: "Operacao nao permitida para o contexto informado."
  };
}
