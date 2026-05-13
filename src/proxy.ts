import { NextRequest, NextResponse } from 'next/server'

// Subdomínios admin explícitos (conforme documentação)
const HOSTS_GESTAO = [
  'gestao.imobiliariadoprofessor.com.br',      // produção
  'gestaoanaerichard.visualizeaquiseu.app.br', // homologação
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Não reescrever arquivos estáticos da pasta public/
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next()
  }

  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]

  const isGestao = HOSTS_GESTAO.includes(hostname)

  if (isGestao) {
    // Rotas de API não devem ser reescritas — o next.config.ts já as proxeia para o backend
    if (pathname.startsWith('/api/')) {
      return NextResponse.next()
    }

    const url = request.nextUrl.clone()

    // Evita duplo prefixo caso a URL já comece com /gestao
    if (!url.pathname.startsWith('/gestao')) {
      url.pathname = '/gestao' + (url.pathname === '/' ? '' : url.pathname)
    }

    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Aplica em todas as rotas exceto arquivos estáticos e _next
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
