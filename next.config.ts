import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase cache size limit to handle large Modrinth API responses (default is 2MB)
  // Set to 50MB to accommodate bulk project/version data
  cacheMaxMemorySize: 50 * 1024 * 1024,
};

export default nextConfig;
