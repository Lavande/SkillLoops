/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
    instrumentationHook: true,
  },
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), "better-sqlite3"];
    return config;
  },
};

export default nextConfig;
