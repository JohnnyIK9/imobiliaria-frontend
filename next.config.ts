import type { NextConfig } from "next";

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8080'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
      // Produção
      'imobiliariadoprofessor.com.br',
      'www.imobiliariadoprofessor.com.br',
      'gestao.imobiliariadoprofessor.com.br',
      // Homologação
      'anaerichard.visualizeaquiseu.app.br',
      'www.anaerichard.visualizeaquiseu.app.br',
      'gestaoanaerichard.visualizeaquiseu.app.br',
      ],
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ]
  },
}

export default nextConfig;
