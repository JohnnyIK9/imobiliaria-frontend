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
    if (pathname === '/gestao/login') {
      setVerificando(false)
      return
    }

    getMeApi()
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setUsuario(data)
        } else {
          router.replace('/gestao/login')
        }
      })
      .catch(() => router.replace('/gestao/login'))
      .finally(() => setVerificando(false))
  }, [pathname, router])

  if (pathname === '/gestao/login') return <>{children}</>

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-black)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--gold, #c49818)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (!usuario) return null

  return <AdminShell usuario={usuario}>{children}</AdminShell>
}

function AdminShell({ usuario, children }: { usuario: { nome: string; papel: string }; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [recolhido, setRecolhido] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  async function handleLogout() {
    await logoutApi().catch(() => {})
    router.replace('/gestao/login')
  }

  const navItems = [
    { href: '/gestao', label: 'Dashboard', icon: GridIcon },
    { href: '/gestao/imoveis', label: 'Imóveis', icon: HomeIcon },
    { href: '/gestao/regioes', label: 'Regiões', icon: MapIcon },
    ...(usuario.papel === 'adm' ? [{ href: '/gestao/usuarios', label: 'Usuários', icon: UserIcon }] : []),
  ]

  function isActive(href: string) {
    if (href === '/gestao') return pathname === '/gestao'
    return pathname.startsWith(href)
  }

  function navegarMobile(href: string) {
    setMenuMobileAberto(false)
    router.push(href)
  }

  // ── Mobile ──────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: 'var(--paper, #f4f1e6)', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>

        {/* Top bar mobile */}
        <header style={{ backgroundColor: 'var(--ink, #1b3a2f)', borderBottom: '3px solid var(--gold, #c49818)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ border: '1px solid var(--gold, #c49818)', padding: '0 8px', display: 'flex', alignItems: 'center', height: '40px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/svg/white-02.svg" alt="Logo" style={{ objectFit: 'contain', width: '32px', height: '32px' }} />
            </div>
            <div style={{ lineHeight: '1.2' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--gold, #c49818)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Imobiliária</div>
              <div style={{ fontSize: '14px', fontWeight: 800, lineHeight: '1.1', fontFamily: "'Playfair Display', serif" }}>
                <span style={{ color: '#ffffff' }}>do </span>
                <span style={{ color: 'var(--gold, #c49818)', fontStyle: 'italic' }}>Professor</span>
              </div>
            </div>
          </div>

          {/* Botão hambúrguer */}
          <button
            onClick={() => setMenuMobileAberto(true)}
            style={{ background: 'none', border: '1px solid var(--gold, #c49818)', borderRadius: '6px', padding: '6px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            <span style={{ display: 'block', width: '20px', height: '2px', backgroundColor: 'var(--gold, #c49818)', borderRadius: '2px' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', backgroundColor: 'var(--gold, #c49818)', borderRadius: '2px' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', backgroundColor: 'var(--gold, #c49818)', borderRadius: '2px' }} />
          </button>
        </header>

        {/* Conteúdo */}
        <main style={{ flex: 1, overflow: 'hidden' }}>
          {children}
        </main>

        {/* Menu fullscreen overlay */}
        {menuMobileAberto && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'var(--ink, #1b3a2f)', display: 'flex', flexDirection: 'column' }}>

            {/* Cabeçalho do overlay */}
            <div style={{ borderBottom: '3px solid var(--gold, #c49818)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ border: '1px solid var(--gold, #c49818)', padding: '0 8px', display: 'flex', alignItems: 'center', height: '40px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/svg/white-02.svg" alt="Logo" style={{ objectFit: 'contain', width: '32px', height: '32px' }} />
                </div>
                <div style={{ lineHeight: '1.2' }}>
                  <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--gold, #c49818)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Imobiliária</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, lineHeight: '1.1', fontFamily: "'Playfair Display', serif" }}>
                    <span style={{ color: '#ffffff' }}>do </span>
                    <span style={{ color: 'var(--gold, #c49818)', fontStyle: 'italic' }}>Professor</span>
                  </div>
                </div>
              </div>
              {/* Botão fechar */}
              <button
                onClick={() => setMenuMobileAberto(false)}
                style={{ background: 'none', border: '1px solid var(--gold, #c49818)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: 'var(--gold, #c49818)', fontSize: '20px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Nav fullscreen */}
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: '8px', overflowY: 'auto' }}>
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <button
                    key={item.href}
                    onClick={() => navegarMobile(item.href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '16px 20px', borderRadius: '10px', width: '100%',
                      backgroundColor: active ? 'rgba(196,152,24,0.15)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(196,152,24,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      color: active ? 'var(--gold, #c49818)' : 'rgba(255,255,255,0.75)',
                      fontSize: '16px', fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <item.icon size={22} color={active ? '#c49818' : 'rgba(255,255,255,0.5)'} />
                    {item.label}
                  </button>
                )
              })}
            </nav>

            {/* Usuário + Sair */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--gold, #c49818)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                  {usuario.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0 }}>{usuario.nome}</p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', margin: 0 }}>{usuario.papel === 'adm' ? 'Administrador' : 'Editor'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px', backgroundColor: 'rgba(248,113,113,0.1)', color: '#F87171', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 700, width: '100%' }}
              >
                <LogoutIcon size={18} color="#F87171" />
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Desktop ──────────────────────────────────────────────────
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--paper, #f4f1e6)', fontFamily: "'DM Sans', sans-serif", overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 flex flex-col"
        style={{
          backgroundColor: 'var(--ink, #1b3a2f)',
          width: recolhido ? '64px' : '240px',
          transition: 'width 0.2s ease',
          overflow: 'visible',
          position: 'relative',
          zIndex: 20,
        }}
      >
        {/* Aba de toggle na borda direita */}
        <button
          onClick={() => setRecolhido((v) => !v)}
          title={recolhido ? 'Expandir menu' : 'Recolher menu'}
          style={{
            position: 'absolute',
            top: '50%',
            right: '-14px',
            transform: 'translateY(-50%)',
            zIndex: 30,
            width: '14px',
            height: '48px',
            backgroundColor: 'var(--ink, #1b3a2f)',
            border: '1px solid var(--gold, #c49818)',
            borderLeft: 'none',
            borderRadius: '0 6px 6px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(196,152,24,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--ink, #1b3a2f)')}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--gold, #c49818)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'transform 0.2s', transform: recolhido ? 'rotate(180deg)' : 'none' }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Logo */}
        <div style={{ borderBottom: '3px solid var(--gold, #c49818)', padding: recolhido ? '12px 0' : '16px 20px', display: 'flex', alignItems: 'center', justifyContent: recolhido ? 'center' : 'flex-start', gap: '8px' }}>
          {!recolhido && (
            <div className="flex items-center gap-3">
              <div style={{ border: '1px solid var(--gold, #c49818)', padding: '0 10px', display: 'flex', alignItems: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/svg/white-02.svg" alt="Logo" style={{ objectFit: 'contain', width: '48px', height: '48px' }} />
              </div>
              <div style={{ lineHeight: '1.2' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--gold, #c49818)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Imobiliária</div>
                <div style={{ fontSize: '17px', fontWeight: 800, lineHeight: '1.1', fontFamily: "'Playfair Display', serif" }}>
                  <span style={{ color: '#ffffff' }}>do </span>
                  <span style={{ color: 'var(--gold, #c49818)', fontStyle: 'italic' }}>Professor</span>
                </div>
              </div>
            </div>
          )}
          {recolhido && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/svg/white-02.svg" alt="Logo" style={{ objectFit: 'contain', width: '32px', height: '32px' }} />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto" style={{ padding: recolhido ? '16px 0' : '16px 12px' }}>
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                title={recolhido ? item.label : undefined}
                className="w-full flex items-center text-sm font-bold transition-colors"
                style={{
                  gap: recolhido ? '0' : '12px',
                  justifyContent: recolhido ? 'center' : 'flex-start',
                  padding: recolhido ? '10px 0' : '8px 12px',
                  borderRadius: recolhido ? '0' : '8px',
                  backgroundColor: active ? 'rgba(196,152,24,0.15)' : 'transparent',
                  color: active ? 'var(--gold, #c49818)' : 'rgba(255,255,255,0.6)',
                  marginBottom: '2px',
                }}
              >
                <item.icon size={18} color={active ? '#c49818' : 'rgba(255,255,255,0.5)'} />
                {!recolhido && item.label}
              </button>
            )
          })}
        </nav>

        {/* Usuário + Sair */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: recolhido ? '12px 0' : '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: recolhido ? 'center' : 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: recolhido ? 'center' : 'flex-start' }}>
            <div
              title={recolhido ? usuario.nome : undefined}
              style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: 'var(--gold, #c49818)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, lineHeight: 1, cursor: 'default',
              }}
            >
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            {!recolhido && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 700, margin: 0, lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {usuario.nome}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: 300, margin: 0, lineHeight: '1.2' }}>
                  {usuario.papel === 'adm' ? 'Administrador' : 'Editor'}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            title={recolhido ? 'Sair' : undefined}
            className="flex items-center font-bold transition-colors hover:brightness-110"
            style={{
              gap: recolhido ? '0' : '8px',
              justifyContent: recolhido ? 'center' : 'flex-start',
              padding: recolhido ? '6px' : '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(248,113,113,0.1)', color: '#F87171',
              border: 'none', cursor: 'pointer', fontSize: '13px', width: '100%',
            }}
          >
            <LogoutIcon size={16} color="#F87171" />
            {!recolhido && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-hidden">
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
