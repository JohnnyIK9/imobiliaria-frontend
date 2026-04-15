'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import {
  getCidadesPublicasApi,
  getRegioesPorCidadePublicaApi,
  getImoveisPublicosApi,
  getMidiasImovelApi,
} from '@/lib/api'
import type { RegiaoMapa } from '@/components/public/MapaPublico'

const MapaPublico = dynamic(() => import('@/components/public/MapaPublico'), { ssr: false })

// ── Tipos ──────────────────────────────────────────────────
type Cidade = {
  id: number
  nome: string
  uf: string
  latCentro: number
  lngCentro: number
  zoomPadrao: number
}

type ImovelCard = {
  id: number
  codigo: string
  tipo: string
  preco: number
  quartos: number
  banheiros: number
  areaM2: number
  vagas: number
  descricao: string | null
  regiao: { id: number; nome: string } | null
  cidade: { id: number; nome: string }
  fotoCapaSrc: string | null
}

type Foto = { id: number; dadosBase64: string; mimeType: string; nomeArquivo: string; ordem: number }
type Video = { id: number; embedUrl: string; thumbnailUrl: string; titulo: string | null; ordem: number }

type Filtros = {
  regiaoId: string
  tipo: string
  precoMin: string
  precoMax: string
  quartos: string
  vagas: string
}

const FILTROS_VAZIOS: Filtros = {
  regiaoId: '', tipo: '', precoMin: '', precoMax: '', quartos: '', vagas: '',
}

// ── Helpers ────────────────────────────────────────────────
function formatarPreco(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizarCidade(r: Record<string, unknown>): Cidade {
  const estado = r.estado as Record<string, unknown> | null
  return {
    id: r.id as number,
    nome: r.nome as string,
    uf: (estado?.id ?? '') as string,
    latCentro: (r.latCentro ?? r.lat_centro ?? -14.235) as number,
    lngCentro: (r.lngCentro ?? r.lng_centro ?? -51.925) as number,
    zoomPadrao: (r.zoomPadrao ?? r.zoom_padrao ?? 13) as number,
  }
}

function normalizarImovel(r: Record<string, unknown>): ImovelCard {
  const regiaoRaw = r.regiao as Record<string, unknown> | null
  const cidadeRaw = r.cidade as Record<string, unknown>
  const fotoCapa = r.fotoCapa as Record<string, unknown> | null
  const fotoCapaSrc = fotoCapa?.dadosBase64
    ? `data:${fotoCapa.mimeType};base64,${fotoCapa.dadosBase64}`
    : null
  return {
    id: r.id as number,
    codigo: (r.codigo ?? String(r.id)) as string,
    tipo: (r.tipo ?? '') as string,
    preco: (r.preco ?? 0) as number,
    quartos: (r.quartos ?? 0) as number,
    banheiros: (r.banheiros ?? 0) as number,
    areaM2: (r.areaM2 ?? r.area_m2 ?? 0) as number,
    vagas: (r.vagas ?? 0) as number,
    descricao: (r.descricao ?? null) as string | null,
    regiao: regiaoRaw ? { id: regiaoRaw.id as number, nome: regiaoRaw.nome as string } : null,
    cidade: { id: cidadeRaw?.id as number, nome: cidadeRaw?.nome as string },
    fotoCapaSrc,
  }
}

function normalizarRegiao(r: Record<string, unknown>): RegiaoMapa {
  let coords: [number, number][] = []
  try {
    const raw = r.coordenadas
    coords = typeof raw === 'string' ? JSON.parse(raw) : (raw as [number, number][])
  } catch { coords = [] }
  return {
    id: r.id as number,
    nome: r.nome as string,
    coordenadas: coords,
    totalImoveis: (r.imoveisAtivos ?? r.totalImoveis ?? r.total_imoveis ?? 0) as number,
  }
}

function contarFiltros(f: Filtros) {
  return [f.regiaoId, f.tipo, f.precoMin, f.precoMax, f.quartos, f.vagas].filter(Boolean).length
}

// ── Componente principal ───────────────────────────────────
export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [cidades, setCidades] = useState<Cidade[]>([])
  const [cidadeSel, setCidadeSel] = useState<Cidade | null>(null)
  const [regioes, setRegioes] = useState<RegiaoMapa[]>([])
  const regioesPadraoRef = useRef<RegiaoMapa[]>([])
  const [imoveis, setImoveis] = useState<ImovelCard[]>([])

  const [carregando, setCarregando] = useState(false)
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
  const [filtrosPendentes, setFiltrosPendentes] = useState<Filtros>(FILTROS_VAZIOS)
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<number | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)

  // Modal
  const [imovelModal, setImovelModal] = useState<ImovelCard | null>(null)
  const [fotos, setFotos] = useState<Foto[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [midiaIdx, setMidiaIdx] = useState(0)
  const [carregandoMidias, setCarregandoMidias] = useState(false)

  const WA_NUMBER = process.env.NEXT_PUBLIC_WA_NUMBER ?? ''

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    getCidadesPublicasApi().then(async (r) => {
      if (!r.ok) return
      const raw: Record<string, unknown>[] = await r.json()
      const lista = raw.map(normalizarCidade)
      setCidades(lista)
      if (lista.length > 0) selecionarCidade(lista[0])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function selecionarCidade(cidade: Cidade) {
    setCidadeSel(cidade)
    setFiltros(FILTROS_VAZIOS)
    setFiltrosPendentes(FILTROS_VAZIOS)
    setRegiaoSelecionada(null)

    const [rRegioes] = await Promise.all([
      getRegioesPorCidadePublicaApi(cidade.id),
    ])
    if (rRegioes.ok) {
      const raw: Record<string, unknown>[] = await rRegioes.json()
      const regioesMapeadas = raw.map(normalizarRegiao)
      regioesPadraoRef.current = regioesMapeadas
      setRegioes(regioesMapeadas)
    }
    await carregarImoveis({ cidadeId: cidade.id })
  }

  async function carregarImoveis(params?: Parameters<typeof getImoveisPublicosApi>[0]) {
    setCarregando(true)
    setImoveis([])
    try {
      const res = await getImoveisPublicosApi(params)
      if (res.ok) {
        const raw: Record<string, unknown>[] = await res.json()
        const lista = raw.map(normalizarImovel)
        setImoveis(lista)

        // Recalcular contadores por região com base nos resultados filtrados
        const contadores: Record<number, number> = {}
        lista.forEach((im) => {
          if (im.regiao) {
            contadores[im.regiao.id] = (contadores[im.regiao.id] ?? 0) + 1
          }
        })
        const temFiltro = params && (params.tipo || params.precoMin || params.precoMax || params.quartos || params.vagas)
        if (temFiltro) {
          setRegioes(regioesPadraoRef.current.map((r) => ({
            ...r,
            totalImoveis: contadores[r.id] ?? 0,
          })))
        } else {
          setRegioes(regioesPadraoRef.current)
        }
      }
    } finally {
      setCarregando(false)
    }
  }

  function handleRegiaoClick(regiaoId: number) {
    const nova = regiaoSelecionada === regiaoId ? null : regiaoId
    setRegiaoSelecionada(nova)
    setFiltrosPendentes((f) => ({ ...f, regiaoId: nova ? String(nova) : '' }))
    if (cidadeSel) {
      carregarImoveis({
        cidadeId: cidadeSel.id,
        regiaoId: nova ?? undefined,
        tipo: filtros.tipo || undefined,
        precoMin: filtros.precoMin ? Number(filtros.precoMin) : undefined,
        precoMax: filtros.precoMax ? Number(filtros.precoMax) : undefined,
        quartos: filtros.quartos ? Number(filtros.quartos) : undefined,
        vagas: filtros.vagas ? Number(filtros.vagas) : undefined,
      })
    }
  }

  function buscar() {
    setFiltros(filtrosPendentes)
    setRegiaoSelecionada(filtrosPendentes.regiaoId ? Number(filtrosPendentes.regiaoId) : null)
    setDrawerAberto(false)
    setFiltrosAbertos(false)
    if (!cidadeSel) return
    carregarImoveis({
      cidadeId: cidadeSel.id,
      regiaoId: filtrosPendentes.regiaoId ? Number(filtrosPendentes.regiaoId) : undefined,
      tipo: filtrosPendentes.tipo || undefined,
      precoMin: filtrosPendentes.precoMin ? Number(filtrosPendentes.precoMin) : undefined,
      precoMax: filtrosPendentes.precoMax ? Number(filtrosPendentes.precoMax) : undefined,
      quartos: filtrosPendentes.quartos ? Number(filtrosPendentes.quartos) : undefined,
      vagas: filtrosPendentes.vagas ? Number(filtrosPendentes.vagas) : undefined,
    })
  }

  function limpar() {
    setFiltrosPendentes(FILTROS_VAZIOS)
    setFiltros(FILTROS_VAZIOS)
    setRegiaoSelecionada(null)
    setDrawerAberto(false)
    setFiltrosAbertos(false)
    if (cidadeSel) carregarImoveis({ cidadeId: cidadeSel.id })
  }

  // ── Modal ─────────────────────────────────────────────────
  async function abrirModal(imovel: ImovelCard) {
    setImovelModal(imovel)
    setMidiaIdx(0)
    setFotos([])
    setVideos([])
    setCarregandoMidias(true)
    try {
      const res = await getMidiasImovelApi(imovel.id)
      if (res.ok) {
        const data = await res.json()
        setFotos(data.fotos ?? [])
        setVideos(data.videos ?? [])
      }
    } finally {
      setCarregandoMidias(false)
    }
  }

  function fecharModal() {
    setImovelModal(null)
    setFotos([])
    setVideos([])
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') fecharModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const totalFiltros = contarFiltros(filtrosPendentes)
  const midias = [
    ...fotos.map((f) => ({ tipo: 'foto' as const, ...f })),
    ...videos.map((v) => ({ tipo: 'video' as const, ...v })),
  ]

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-black)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ── */}
      <header style={{
        backgroundColor: 'var(--ink, #1b3a2f)',
        borderBottom: '3px solid var(--gold, #c49818)',
        padding: '0 24px 2px 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 100,
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ border: '1px solid var(--gold, #c49818)', padding: '0 18px', display: 'flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/svg/white-02.svg" alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          </div>
          <div style={{ lineHeight: '1.2' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--gold, #c49818)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Imobiliária</div>
            <div style={{ fontSize: '20px', fontWeight: 800, lineHeight: '1.1', fontFamily: "'Playfair Display', serif" }}>
              <span style={{ color: '#ffffff' }}>do </span>
              <span style={{ color: 'var(--gold, #c49818)', fontStyle: 'italic' }}>Professor</span>
            </div>
          </div>
        </div>

        {/* Seletor de cidade — alinhado com o painel lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '390px', alignItems: 'center', justifyContent: 'center', paddingLeft: '40px' }}>
          <span style={{ color: 'var(--gold, #c49818)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cidade</span>
          <div style={{ position: 'relative', width: '180px' }}>
            <select
              value={cidadeSel?.id ?? ''}
              onChange={(e) => {
                const cidade = cidades.find((c) => c.id === Number(e.target.value))
                if (cidade) selecionarCidade(cidade)
              }}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-white)',
                border: '1.5px solid var(--gold, #c49818)',
                borderRadius: '0',
                padding: '5px 28px 5px 10px',
                fontSize: '12px',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'Lato, sans-serif',
                width: '100%',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            >
              {cidades.map((c) => (
                <option key={c.id} value={c.id} style={{ backgroundColor: '#1b3a2f', color: '#f4f1e6' }}>
                  {c.nome}{c.uf ? ` — ${c.uf}` : ''}
                </option>
              ))}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c49818)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </header>

      {/* ── Corpo ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Mapa — desktop 70%, mobile 100% */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
        }}>
          {cidadeSel && (
            <MapaPublico
              lat={cidadeSel.latCentro}
              lng={cidadeSel.lngCentro}
              zoom={cidadeSel.zoomPadrao}
              regioes={regioes}
              regiaoSelecionada={regiaoSelecionada}
              onRegiaoClick={handleRegiaoClick}
            />
          )}

          {/* Botão Ver imóveis — mobile */}
          {isMobile && (
            <button
              onClick={() => setDrawerAberto(true)}
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--gold, #c49818)',
                color: 'var(--ink, #1b3a2f)',
                border: 'none',
                borderRadius: '24px',
                padding: '12px 28px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                zIndex: 500,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
              }}
            >
              Ver imóveis{imoveis.length > 0 ? ` (${imoveis.length})` : ''}{totalFiltros > 0 ? ` · ${totalFiltros} filtro${totalFiltros !== 1 ? 's' : ''}` : ''}
            </button>
          )}
        </div>

        {/* Painel lateral — desktop 30%, mobile: drawer */}
        <div style={{
          width: isMobile ? '100%' : '390px',
          flexShrink: 0,
          height: '100%',
          backgroundColor: 'var(--paper, #f4f1e6)',
          borderLeft: isMobile ? 'none' : '2px solid var(--gold, #c49818)',
          display: isMobile ? (drawerAberto ? 'flex' : 'none') : 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: isMobile ? 'fixed' : 'relative',
          top: isMobile ? 0 : 'auto',
          left: isMobile ? 0 : 'auto',
          right: isMobile ? 0 : 'auto',
          bottom: isMobile ? 0 : 'auto',
          zIndex: isMobile ? 1000 : 'auto',
        }}
        >
          {/* Botão fechar drawer — mobile */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--ink, #1b3a2f)', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', fontFamily: "'Playfair Display', serif" }}>
                Imóveis{imoveis.length > 0 ? ` (${imoveis.length})` : ''}
              </span>
              <button
                onClick={() => setDrawerAberto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--gold, #c49818)', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Botão dropdown filtros */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <button
              onClick={() => setFiltrosAbertos((v) => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: 'var(--color-green-mid)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0', padding: '9px 14px', cursor: 'pointer',
                color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, fontFamily: 'Lato, sans-serif',
              }}
            >
              <span>
                Filtrar imóveis{totalFiltros > 0 && <span style={{ color: 'var(--gold, #c49818)', marginLeft: '6px', fontSize: '12px' }}>{totalFiltros} ativo{totalFiltros !== 1 ? 's' : ''}</span>}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c49818)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: filtrosAbertos ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown */}
            {filtrosAbertos && (
              <div style={{
                position: 'absolute', top: '56px', left: 0, right: 0,
                backgroundColor: 'var(--ink-soft, #2e5444)',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                zIndex: 200, padding: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                <PainelFiltros
                  regioes={regioes}
                  filtros={filtrosPendentes}
                  onChange={setFiltrosPendentes}
                  onBuscar={buscar}
                  onLimpar={limpar}
                  totalFiltros={totalFiltros}
                />
              </div>
            )}
          </div>

          {/* Contador */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--paper-3, #dddac8)', flexShrink: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ color: '#000', fontSize: '16px', fontWeight: 800 }}>Imóveis disponíveis</span>
            <span style={{ color: '#000', fontSize: '11px', fontWeight: 500 }}>{imoveis.length} encontrado{imoveis.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Lista de imóveis */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {carregando ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <div style={estiloSpinner} />
              </div>
            ) : imoveis.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', textAlign: 'center', padding: '32px 16px', margin: 0 }}>
                Nenhum imóvel encontrado.
              </p>
            ) : (
              imoveis.map((im) => (
                <CardImovel key={im.id} imovel={im} onClick={() => abrirModal(im)} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Drawer mobile ── */}
      {drawerAberto && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 800,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setDrawerAberto(false)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'var(--paper, #f4f1e6)',
              borderRadius: '16px 16px 0 0',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '2px', margin: '12px auto 0' }} />
            <PainelFiltros
              regioes={regioes}
              filtros={filtrosPendentes}
              onChange={setFiltrosPendentes}
              onBuscar={buscar}
              onLimpar={limpar}
              totalFiltros={totalFiltros}
            />
          </div>
        </div>
      )}

      {/* ── Modal de detalhes ── */}
      {imovelModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={fecharModal}
        >
          <div
            style={{
              backgroundColor: 'var(--paper, #f4f1e6)',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão fechar */}
            <button
              onClick={fecharModal}
              style={{
                position: 'absolute', top: '12px', right: '12px', zIndex: 10,
                backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
                border: 'none', borderRadius: '50%',
                width: '32px', height: '32px', fontSize: '14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>

            {/* Galeria */}
            <div style={{ position: 'relative', height: '280px', backgroundColor: '#000', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
              {carregandoMidias ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={estiloSpinner} />
                </div>
              ) : midias.length === 0 ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                </div>
              ) : midias[midiaIdx].tipo === 'foto' ? (
                <img
                  src={`data:${midias[midiaIdx].mimeType};base64,${midias[midiaIdx].dadosBase64}`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <iframe
                  src={midias[midiaIdx].embedUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}

              {/* Navegação */}
              {midias.length > 1 && (
                <>
                  <button onClick={() => setMidiaIdx((i) => (i - 1 + midias.length) % midias.length)} style={estiloNavBtn('left')}>◀</button>
                  <button onClick={() => setMidiaIdx((i) => (i + 1) % midias.length)} style={estiloNavBtn('right')}>▶</button>
                </>
              )}

              {/* Badge tipo */}
              <div style={{
                position: 'absolute', bottom: '10px', left: '10px',
                backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff',
                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
              }}>
                {imovelModal.tipo}
              </div>

              {/* Contador */}
              {midias.length > 0 && (
                <div style={{
                  position: 'absolute', bottom: '10px', right: '10px',
                  backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff',
                  fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px',
                }}>
                  {midiaIdx + 1} / {midias.length}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {midias.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', padding: '8px 16px', overflowX: 'auto' }}>
                {midias.map((m, idx) => (
                  <div
                    key={idx}
                    onClick={() => setMidiaIdx(idx)}
                    style={{
                      flexShrink: 0, width: '56px', height: '56px',
                      borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
                      border: `2px solid ${idx === midiaIdx ? '#40A6F4' : 'transparent'}`,
                      position: 'relative',
                    }}
                  >
                    {m.tipo === 'foto' ? (
                      <img src={`data:${m.mimeType};base64,${m.dadosBase64}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <>
                        <img src={m.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '7px solid #000', marginLeft: '2px' }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Informações */}
            <div style={{ padding: '16px 20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                <p style={{ color: 'var(--gold, #c49818)', fontSize: '26px', fontWeight: 800, margin: 0 }}>
                  {formatarPreco(imovelModal.preco)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#000', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
                    {imovelModal.codigo}
                  </span>
                  <span style={{ color: '#000', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: "'IM Fell English', serif", fontStyle: 'italic' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {imovelModal.regiao?.nome ? `${imovelModal.regiao.nome} · ` : ''}{imovelModal.cidade.nome}
                  </span>
                </div>
              </div>

              {/* Grid specs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {[
                  { label: 'Quartos', valor: imovelModal.quartos },
                  { label: 'Banheiros', valor: imovelModal.banheiros },
                  { label: 'Vagas', valor: imovelModal.vagas },
                  { label: 'Área', valor: `${imovelModal.areaM2}m²` },
                ].map((s) => (
                  <div key={s.label} style={{
                    backgroundColor: 'var(--paper-2, #eae6d4)',
                    border: '1px solid var(--paper-3, #dddac8)',
                    borderRadius: '0', padding: '12px 8px',
                    textAlign: 'center',
                  }}>
                    <p style={{ margin: '0 0 4px', color: 'var(--ink, #1b3a2f)', fontSize: '26px', fontWeight: 800, lineHeight: 1, fontFamily: "'DM Sans', sans-serif" }}>{s.valor}</p>
                    <p style={{ margin: 0, color: 'var(--sepia, #7a9e88)', fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Sans', sans-serif" }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Separador */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
                <span style={{ color: 'var(--gold, #c49818)', fontSize: '10px' }}>◆</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
              </div>

              {imovelModal.descricao && (
                <p style={{ color: '#000', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>
                  {imovelModal.descricao}
                </p>
              )}

              {/* Botão WhatsApp */}
              <a
                href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(`Olá, tenho interesse no imóvel ${imovelModal.codigo}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  backgroundColor: '#25D366', color: '#fff',
                  borderRadius: '10px', padding: '14px',
                  fontSize: '15px', fontWeight: 800,
                  textDecoration: 'none', width: '100%', boxSizing: 'border-box',
                } as React.CSSProperties}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.548 5.876L0 24l6.278-1.524A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.374l-.36-.213-3.726.904.948-3.627-.234-.373A9.818 9.818 0 0 1 12 2.182c5.424 0 9.818 4.394 9.818 9.818 0 5.425-4.394 9.818-9.818 9.818z"/></svg>
                Tenho interesse
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{
        backgroundColor: 'var(--color-green-deeper)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: isMobile ? '10px 16px' : '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobile ? '10px' : '16px',
        flexWrap: 'nowrap',
        flexShrink: 0,
      }}>
        {/* Redes sociais */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '14px' : '24px' }}>

          {/* WhatsApp */}
          <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: '#ffffff', fontSize: '13px', fontWeight: 700 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            {!isMobile && <span>(17) 99999-9999</span>}
          </a>

          {/* Facebook */}
          <a href="https://www.facebook.com/imobiliariadoprofessor/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#ffffff', fontSize: '13px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
            {!isMobile && <span>imobiliariadoprofessor</span>}
          </a>

          {/* Instagram */}
          <a href="https://www.instagram.com/ImobiliariaDoProfessor" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: '#ffffff', fontSize: '13px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608C4.516 2.497 5.783 2.226 7.15 2.163 8.416 2.105 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 5.197.157 3.355.745 2.014 2.086.674 3.426.086 5.268 0 7.124-.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.856.673 3.698 2.014 5.038 1.34 1.341 3.182 1.929 5.038 2.014C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 1.856-.085 3.698-.673 5.038-2.014 1.341-1.34 1.929-3.182 2.014-5.038C23.986 15.668 24 15.259 24 12c0-3.259-.014-3.668-.072-4.948-.085-1.856-.673-3.698-2.014-5.038C20.574.745 18.732.157 16.876.072 15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            {!isMobile && <span>@ImobiliariaDoProfessor</span>}
          </a>

        </div>

        {/* Copyright + Endereço */}
        {isMobile ? (
          <p style={{ margin: 0, color: '#ffffff', fontSize: '11px', whiteSpace: 'nowrap' }}>
            © {new Date().getFullYear()} Imobiliária do Professor —{' '}
            <a href="https://maps.app.goo.gl/6dC2AV9rVV8uYHwUA" target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', textDecoration: 'underline' }}>
              Votuporanga - SP
            </a>
          </p>
        ) : (
          <p style={{ margin: 0, color: '#ffffff', fontSize: '12px' }}>
            © {new Date().getFullYear()} Imobiliária do Professor —{' '}
            <a href="https://maps.app.goo.gl/6dC2AV9rVV8uYHwUA" target="_blank" rel="noopener noreferrer" style={{ color: '#ffffff', textDecoration: 'underline' }}>
              Rua Rio de Janeiro, 3708, Centro - Votuporanga - SP
            </a>
          </p>
        )}
      </footer>

      {/* Responsividade */}
      <style>{`
        @media (max-width: 640px) {
          .painel-lateral { display: none !important; }
          .btn-filtros-mobile { display: flex !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ── PainelFiltros ──────────────────────────────────────────
type PainelFiltrosProps = {
  regioes: RegiaoMapa[]
  filtros: Filtros
  onChange: (f: Filtros) => void
  onBuscar: () => void
  onLimpar: () => void
  totalFiltros: number
}

function PainelFiltros({ regioes, filtros, onChange, onBuscar, onLimpar, totalFiltros }: PainelFiltrosProps) {
  const set = (key: keyof Filtros, val: string) => onChange({ ...filtros, [key]: val })

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 800 }}>
          {totalFiltros > 0 && <span style={{ color: 'var(--gold, #c49818)', fontSize: '12px' }}>{totalFiltros} ativo{totalFiltros !== 1 ? 's' : ''}</span>}
        </span>
        {totalFiltros > 0 && (
          <button onClick={onLimpar} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer', fontFamily: 'Lato, sans-serif' }}>
            Limpar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <select value={filtros.regiaoId} onChange={(e) => set('regiaoId', e.target.value)} style={estiloSelect}>
          <option value="">Todas as regiões</option>
          {regioes.map((r) => <option key={r.id} value={String(r.id)} style={{ backgroundColor: '#374C4B' }}>{r.nome}</option>)}
        </select>

        <select value={filtros.tipo} onChange={(e) => set('tipo', e.target.value)} style={estiloSelect}>
          <option value="">Todos os tipos</option>
          {['Casa', 'Apartamento', 'Sobrado', 'Terreno', 'Comercial'].map((t) => (
            <option key={t} value={t} style={{ backgroundColor: '#374C4B' }}>{t}</option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <input
            type="number" placeholder="Preço mín. R$" value={filtros.precoMin}
            onChange={(e) => set('precoMin', e.target.value)}
            style={estiloInput}
          />
          <input
            type="number" placeholder="Preço máx. R$" value={filtros.precoMax}
            onChange={(e) => set('precoMax', e.target.value)}
            style={estiloInput}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <select value={filtros.quartos} onChange={(e) => set('quartos', e.target.value)} style={estiloSelect}>
            <option value="">Quartos</option>
            {['1', '2', '3', '4'].map((v) => <option key={v} value={v} style={{ backgroundColor: '#374C4B' }}>{v}{v === '4' ? '+' : ''}</option>)}
          </select>
          <select value={filtros.vagas} onChange={(e) => set('vagas', e.target.value)} style={estiloSelect}>
            <option value="">Vagas</option>
            {['1', '2', '3'].map((v) => <option key={v} value={v} style={{ backgroundColor: '#374C4B' }}>{v}{v === '3' ? '+' : ''}</option>)}
          </select>
        </div>

        <button
          onClick={onBuscar}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--color-blue)', color: '#fff',
            fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'Lato, sans-serif',
          }}
        >
          Buscar
        </button>
      </div>
    </div>
  )
}

// ── CardImovel ─────────────────────────────────────────────
function CardImovel({ imovel, onClick }: { imovel: ImovelCard; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        margin: '0 10px 8px',
        backgroundColor: 'var(--color-green-mid)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        overflow: 'hidden',
        display: 'flex',
        gap: '0',
      }}
      onMouseOver={(e) => (e.currentTarget.style.opacity = '0.85')}
      onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
    >
      {/* Foto */}
      <div style={{ position: 'relative', width: '96px', minHeight: '96px', flexShrink: 0, backgroundColor: 'var(--color-green-dark)' }}>
        {imovel.fotoCapaSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imovel.fotoCapaSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}
        {/* Badge tipo */}
        <span style={{
          position: 'absolute', bottom: '5px', left: '5px',
          backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: '9px', fontWeight: 800, padding: '1px 6px',
          borderRadius: '3px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Lato, sans-serif',
        }}>
          {imovel.tipo}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px', flex: 1, minWidth: 0 }}>
        <p style={{ color: 'var(--gold, #c49818)', fontSize: '15px', fontWeight: 800, margin: '0 0 2px' }}>
          {formatarPreco(imovel.preco)}
        </p>
        <p style={{ color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {imovel.regiao?.nome ? `${imovel.regiao.nome} — ` : ''}{imovel.tipo}
        </p>

        {/* Badges atributos */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
          {imovel.quartos > 0 && <span style={estiloBadge}>{imovel.quartos} qtos</span>}
          {imovel.banheiros > 0 && <span style={estiloBadge}>{imovel.banheiros} bnh</span>}
          {imovel.vagas > 0 && <span style={estiloBadge}>{imovel.vagas} vagas</span>}
          {imovel.areaM2 > 0 && <span style={estiloBadge}>{imovel.areaM2} m²</span>}
        </div>

        {/* Rodapé do card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {imovel.regiao?.nome && (
            <span style={{ color: 'var(--gold, #c49818)', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '8px' }}>◆</span>{imovel.regiao.nome.toUpperCase()}
            </span>
          )}
          {imovel.regiao?.nome && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>·</span>}
          <span style={{ color: '#fff', fontSize: '10px', fontWeight: 800 }}>{imovel.codigo}</span>
        </div>
      </div>
    </div>
  )
}

const estiloBadge: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.08)',
  color: 'rgba(255,255,255,0.75)',
  fontSize: '11px', fontWeight: 600,
  padding: '3px 8px', borderRadius: '5px',
  border: '1px solid rgba(255,255,255,0.1)',
}

// ── Estilos ────────────────────────────────────────────────
const estiloSpinner: React.CSSProperties = {
  width: '28px', height: '28px', borderRadius: '50%',
  border: '3px solid rgba(64,166,244,0.2)',
  borderTopColor: '#40A6F4',
  animation: 'spin 0.8s linear infinite',
}

const estiloSelect: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: 'var(--color-green-mid)',
  color: 'var(--color-white)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px', padding: '8px 10px',
  fontSize: '12px', fontWeight: 700, outline: 'none', cursor: 'pointer',
  fontFamily: 'Lato, sans-serif',
}

const estiloInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  backgroundColor: 'var(--color-green-mid)',
  color: 'var(--color-white)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px', padding: '8px 10px',
  fontSize: '12px', outline: 'none',
  fontFamily: 'Lato, sans-serif',
}

function estiloNavBtn(lado: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [lado]: '10px',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
    border: 'none', borderRadius: '6px',
    width: '30px', height: '30px', fontSize: '12px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  }
}
