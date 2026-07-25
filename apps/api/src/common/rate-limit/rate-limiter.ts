export const RATE_LIMITER = Symbol("RATE_LIMITER");

export type RateLimitInput = {
  key: string;
  limit: number;
  ttlMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  current: number;
  retryAfterMs: number;
};

export interface RateLimiter {
  consume(input: RateLimitInput): Promise<RateLimitDecision>;
}
