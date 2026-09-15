import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a minimal node_modules for the Docker image.
  output: "standalone",
  // Do not advertise the framework.
  poweredByHeader: false,
};

export default nextConfig;
