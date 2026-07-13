export type FeatureEntitlement = {
  key: string;
  enabled: boolean;
  limitValue?: number | null;
  config?: Record<string, unknown> | null;
};

export type ResolvedFeatureEntitlement = {
  key: string;
  enabled: boolean;
  limitValue: number | null;
  config: Record<string, unknown>;
};

export function resolveFeatureEntitlement(
  features: FeatureEntitlement[],
  key: string
): ResolvedFeatureEntitlement {
  const feature = features.find((item) => item.key === key);

  return {
    key,
    enabled: feature?.enabled ?? false,
    limitValue: feature?.limitValue ?? null,
    config: feature?.config ?? {}
  };
}

export function isFeatureEnabled(features: FeatureEntitlement[], key: string): boolean {
  return resolveFeatureEntitlement(features, key).enabled;
}
