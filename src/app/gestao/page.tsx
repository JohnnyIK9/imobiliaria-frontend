'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStatsApi } from '@/lib/api'

type Stats = {
  imoveisAtivos: number
  regioes: number
  cidades: number
  precoMedio: number
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    getStatsApi()
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      })
      .finally(() => setCarregando(false))
  }, [])

  const cards = [
    {
      label: 'Imóveis Ativos',
      valor: stats ? String(stats.imoveisAtivos) : '—',
      icon: HomeIcon,
      cor: '#40A6F4',
    },
    {
      label: 'Regiões Cadastradas',
      valor: stats ? String(stats.regioes) : '—',
      icon: MapIcon,
      cor: '#4ADE80',
    },
    {
      label: 'Cidades Ativas',
      valor: stats ? String(stats.cidades) : '—',
      icon: CityIcon,
      cor: '#FACC15',
    },
    {
      label: 'Preço Médio',
      valor: stats ? formatarMoeda(stats.precoMedio) : '—',
      icon: TagIcon,
      cor: '#F472B6',
    },
  ]

  const atalhos = [
    { label: 'Gerenciar Imóveis', desc: 'Adicionar, editar e publicar imóveis', href: '/gestao/imoveis', icon: HomeIcon, cor: '#40A6F4' },
    { label: 'Gerenciar Regiões', desc: 'Desenhar e editar regiões no mapa', href: '/gestao/regioes', icon: MapIcon, cor: '#4ADE80' },
  ]

  return (
    <div className="h-full overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
    <div className="p-8 max-w-5xl mx-auto">

      {/* Cabeçalho */}
      <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--gold, #c49818)' }}>
        <h1 className="font-extrabold" style={{ fontSize: '36px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
          Dashboard
        </h1>
        <p className="font-bold mt-2" style={{ fontSize: '18px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
          Visão geral do sistema
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div
        className="mb-8 p-6"
        style={{ border: '1px solid var(--gold, #c49818)', borderRadius: '12px' }}
      >
        <h2 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
          Estatísticas
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl flex items-center gap-5"
              style={{ backgroundColor: 'var(--paper-2, #eae6d4)', border: '1px solid var(--paper-3, #dddac8)', padding: '20px 24px' }}
            >
              <div
                className="rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: `${card.cor}18`, width: '52px', height: '52px' }}
              >
                <card.icon size={26} color={card.cor} />
              </div>
              <div>
                {carregando ? (
                  <div className="h-8 w-20 rounded animate-pulse mb-1" style={{ backgroundColor: 'var(--paper-3, #dddac8)' }} />
                ) : (
                  <p className="font-extrabold leading-none" style={{ fontSize: '28px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
                    {card.valor}
                  </p>
                )}
                <p className="font-bold mt-1.5" style={{ fontSize: '13px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
                  {card.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Atalhos rápidos */}
      <div
        className="p-6"
        style={{ border: '1px solid var(--gold, #c49818)', borderRadius: '12px' }}
      >
        <h2 className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {atalhos.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className="flex items-center gap-5 rounded-xl text-left transition-colors hover:brightness-105"
              style={{ backgroundColor: 'var(--paper-2, #eae6d4)', border: '1px solid var(--paper-3, #dddac8)', padding: '20px 24px' }}
            >
              <div
                className="flex-shrink-0 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${item.cor}18`, width: '52px', height: '52px' }}
              >
                <item.icon size={26} color={item.cor} />
              </div>
              <div>
                <p className="font-bold" style={{ fontSize: '17px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
                  {item.label}
                </p>
                <p className="font-bold mt-1" style={{ fontSize: '13px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
                  {item.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
    </div>
  )
}

/* Ícones */
function HomeIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
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

function CityIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="22" x2="21" y2="22" />
      <rect x="2" y="9" width="10" height="13" />
      <path d="M12 9V5l7-3v17" />
      <line x1="6" y1="13" x2="6" y2="13" /><line x1="6" y1="17" x2="6" y2="17" />
      <line x1="16" y1="9" x2="16" y2="9" /><line x1="16" y1="13" x2="16" y2="13" />
      <line x1="16" y1="17" x2="16" y2="17" />
    </svg>
  )
}

function TagIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
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
