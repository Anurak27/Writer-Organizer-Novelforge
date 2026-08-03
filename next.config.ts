import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow server-side external packages for Vercel
  serverExternalPackages: ['pdfkit'],
};

export default nextConfig;
