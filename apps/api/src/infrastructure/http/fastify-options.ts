import type { FastifyServerOptions } from "fastify";

import { type ApiEnv, parseTrustedProxies } from "@gym-platform/config";

export function createFastifyOptions(env: ApiEnv, logger: boolean): FastifyServerOptions {
  const trustedProxies = parseTrustedProxies(env.TRUSTED_PROXIES);

  return {
    logger,
    ...(trustedProxies.length > 0 ? { trustProxy: trustedProxies } : {})
  };
}
