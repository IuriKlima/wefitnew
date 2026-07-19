const targets = [
  {
    name: "API liveness",
    value: process.env.RELEASE_API_URL,
    path: "/health/live"
  },
  {
    name: "API readiness",
    value: process.env.RELEASE_API_URL,
    path: "/health/ready"
  },
  {
    name: "Admin web",
    value: process.env.RELEASE_ADMIN_WEB_URL,
    path: "/api/health"
  }
];

const missing = targets.filter((target) => !target.value).map((target) => target.name);

if (missing.length > 0) {
  console.error(`Missing release URL configuration for: ${missing.join(", ")}.`);
  process.exit(1);
}

let failed = false;

for (const target of targets) {
  const url = new URL(target.path, target.value).toString();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      redirect: "follow"
    });
    const succeeded = response.status >= 200 && response.status < 400;

    console.log(`${succeeded ? "OK" : "FAILED"} ${target.name}: HTTP ${response.status}`);
    failed ||= !succeeded;
  } catch (error) {
    console.error(
      `FAILED ${target.name}: ${error instanceof Error ? error.message : String(error)}`
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
