import { NextRequest, NextResponse } from 'next/server'

const HOSTS_GESTAO = [
  'gestao.imobiliariadoprofessor.com.br',
  'gestaoanaerichard.visualizeaquiseu.app.br',
]

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Não reescrever arquivos estáticos da pasta public/
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next()
  }

  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0]

  if (!HOSTS_GESTAO.includes(hostname)) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()

  if (!url.pathname.startsWith('/gestao')) {
    url.pathname = '/gestao' + (url.pathname === '/' ? '' : url.pathname)
  }

  return NextResponse.rewrite(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
