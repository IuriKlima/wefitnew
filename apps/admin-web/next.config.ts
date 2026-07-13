import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: false,
  transpilePackages: ["@gym-platform/ui"]
};

export default nextConfig;
