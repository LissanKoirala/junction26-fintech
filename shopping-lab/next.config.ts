import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Optional sub-path hosting (e.g. NEXT_PUBLIC_BASE_PATH=/lab). Unset = served at the origin root.
  ...(process.env.NEXT_PUBLIC_BASE_PATH ? { basePath: process.env.NEXT_PUBLIC_BASE_PATH } : {}),
};

export default nextConfig;
