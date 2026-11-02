import type { NextConfig } from "next";

// Adresse réelle du backend Render, utilisée uniquement côté serveur Vercel.
// Le navigateur ne la voit jamais : il appelle /backend/... sur le domaine Vercel,
// et Vercel relaie la requête vers Render.
const BACKEND_URL = process.env.BACKEND_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!BACKEND_URL) return [];
    return [
      {
        source: "/backend/:path*",
        destination: `${BACKEND_URL.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;