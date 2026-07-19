import { spawnSync } from "node:child_process";
import { createConnection } from "node:net";

const defaultTestDatabaseUrl =
  "postgresql://gym_platform:gym_platform_test_password@localhost:55432/gym_platform_test?schema=public";
const databaseUrl = process.env.DATABASE_URL_TEST ?? defaultTestDatabaseUrl;

const parsed = new URL(databaseUrl);
const databaseName = parsed.pathname.replace(/^\//, "");

try {
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Refusing to migrate non-test database "${databaseName}".`);
  }

  await assertDatabasePortReachable(parsed);

  const packageManagerPath = process.env.npm_execpath;
  if (!packageManagerPath) {
    throw new Error('Run this command through pnpm: "pnpm db:test:deploy".');
  }

  const result = spawnSync(
    process.execPath,
    [packageManagerPath, "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl
      },
      shell: false,
      stdio: "inherit"
    }
  );

  if (result.error) {
    throw new Error("Unable to start the Prisma CLI for the test database.");
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unable to deploy test database.");
  process.exit(1);
}

function assertDatabasePortReachable(databaseUrl) {
  const host = databaseUrl.hostname;
  const port = Number(databaseUrl.port || "5432");

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      rejectConnection(reject, host, port);
    }, 2000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      rejectConnection(reject, host, port);
    });
  });
}

function rejectConnection(reject, host, port) {
  reject(
    new Error(
      `PostgreSQL test database is unavailable at ${host}:${port}. Run "pnpm docker:up" before "pnpm db:test:deploy".`
    )
  );
}
