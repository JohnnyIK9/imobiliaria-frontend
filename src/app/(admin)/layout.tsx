'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getMeApi, logoutApi } from '@/lib/api'

type Usuario = {
  id: number
  nome: string
  email: string
  papel: 'adm' | 'editor'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    if (pathname === '/login') {
      setVerificando(false)
      return
    }

    getMeApi()
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setUsuario(data)
        } else {
          router.replace('/login')
        }
      })
      .catch(() => router.replace('/login'))
      .finally(() => setVerificando(false))
  }, [pathname, router])

  if (pathname === '/login') return <>{children}</>

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-black)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-blue)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!usuario) return null

  return <AdminShell usuario={usuario}>{children}</AdminShell>
}

function AdminShell({ usuario, children }: { usuario: { nome: string; papel: string }; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await logoutApi().catch(() => {})
    router.replace('/login')
  }

  const navItems = [
    { href: '/', label: 'Dashboard', icon: GridIcon },
    { href: '/imoveis', label: 'Imóveis', icon: HomeIcon },
    { href: '/regioes', label: 'Regiões', icon: MapIcon },
    ...(usuario.papel === 'adm' ? [{ href: '/usuarios', label: 'Usuários', icon: UserIcon }] : []),
    { href: '/orcamento', label: 'Orçamento', icon: ClipboardIcon },
  ]

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-black)' }}>
      {/* Sidebar */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col"
        style={{ backgroundColor: 'var(--color-green-dark)' }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-blue)' }}
            >
              <HomeIcon size={16} color="#fff" />
            </div>
            <span className="text-sm font-bold leading-tight" style={{ color: 'var(--color-white)' }}>
              Imobiliária<br />do Professor
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold transition-colors text-left"
                style={{
                  backgroundColor: active ? 'rgba(64,166,244,0.15)' : 'transparent',
                  color: active ? 'var(--color-blue)' : 'rgba(255,255,255,0.6)',
                }}
              >
                <item.icon size={18} color={active ? '#40A6F4' : 'rgba(255,255,255,0.5)'} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Usuário + Sair */}
        <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ backgroundColor: 'var(--color-blue)', color: '#fff' }}
            >
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--color-white)' }}>
                {usuario.nome}
              </p>
              <p className="text-xs font-light capitalize" style={{ color: 'var(--color-gray-dark)' }}>
                {usuario.papel === 'adm' ? 'Administrador' : 'Editor'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold transition-colors hover:brightness-110"
            style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#F87171' }}
          >
            <LogoutIcon size={16} color="#F87171" />
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

/* Ícones inline */
function HomeIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function GridIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function MapIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function UserIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function ClipboardIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function LogoutIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
