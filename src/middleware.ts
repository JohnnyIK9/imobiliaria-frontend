import { NextRequest, NextResponse } from 'next/server'

const DOMINIOS_PUBLICOS = [
  'anaerichard.visualizeaquiseu.app.br',  // homologação
  'imobiliariadoprofessor.com.br',         // produção
]

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? ''
  // Remove porta caso esteja presente (ex: localhost:3000)
  const hostname = host.split(':')[0]

  const isGestao = DOMINIOS_PUBLICOS.some((d) => hostname === `gestao.${d}`)

  if (isGestao) {
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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
