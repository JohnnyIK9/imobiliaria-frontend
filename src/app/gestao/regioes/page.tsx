'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import {
  getEstadosApi,
  getCidadesApi,
  getRegioesPorCidadeApi,
  criarRegiaoApi,
  editarRegiaoApi,
  excluirRegiaoApi,
  criarCidadeApi,
  editarCidadeApi,
} from '@/lib/api'
import type { MapaRegioesRef, Ponto, RegiaoMapa } from '@/components/admin/MapaRegioes'

const MapaRegioes = dynamic(() => import('@/components/admin/MapaRegioes'), { ssr: false })

type Estado = { id: string; nome: string }
type CidadeRaw = { id: number; nome: string; estado?: { id: string; nome: string }; estadoId?: string; estado_id?: string; prefixo?: string; latCentro?: number; lat_centro?: number; lngCentro?: number; lng_centro?: number; zoomPadrao?: number; zoom_padrao?: number }
type Cidade = { id: number; nome: string; estadoId: string; estadoNome: string; prefixo: string; latCentro: number; lngCentro: number; zoomPadrao: number }

function normalizarCidade(r: CidadeRaw): Cidade {
  return {
    id: r.id,
    nome: r.nome,
    estadoId: r.estado?.id ?? r.estadoId ?? r.estado_id ?? '',
    estadoNome: r.estado?.nome ?? '',
    prefixo: r.prefixo ?? '',
    latCentro: r.latCentro ?? r.lat_centro ?? 0,
    lngCentro: r.lngCentro ?? r.lng_centro ?? 0,
    zoomPadrao: r.zoomPadrao ?? r.zoom_padrao ?? 13,
  }
}
type Regiao = { id: number; nome: string; coordenadas: string }

type ModoEdicao = {
  regiao: Regiao
  pontos: Ponto[]
  nomeEdit: string
}

export default function RegioesPage() {
  const mapaRef = useRef<MapaRegioesRef>(null)

  const [estados, setEstados] = useState<Estado[]>([])
  const [todosEstados, setTodosEstados] = useState<Estado[]>([])
  const [todasCidades, setTodasCidades] = useState<Cidade[]>([])
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [regioes, setRegioes] = useState<Regiao[]>([])

  const [estadoSel, setEstadoSel] = useState('')
  const [cidadeSel, setCidadeSel] = useState<Cidade | null>(null)

  const [desenhando, setDesenhando] = useState(false)
  const [desenhoFinalizado, setDesenhoFinalizado] = useState(false)
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [nomeNova, setNomeNova] = useState('')

  const [modoEdicao, setModoEdicao] = useState<ModoEdicao | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const [painelAberto, setPainelAberto] = useState(true)
  const [mapaCarregado, setMapaCarregado] = useState(false)

  const [modalCidade, setModalCidade] = useState(false)
  const [novaCidade, setNovaCidade] = useState({
    nome: '', estadoId: '', prefixo: '', latCentro: '', lngCentro: '', zoomPadrao: '13', ativa: true,
  })
  const [salvandoCidade, setSalvandoCidade] = useState(false)
  const [municipiosIBGE, setMunicipiosIBGE] = useState<{ id: number; nome: string }[]>([])
  const [carregandoMunicipios, setCarregandoMunicipios] = useState(false)

  const [modalEditarCidade, setModalEditarCidade] = useState(false)
  const [editCidade, setEditCidade] = useState({
    nome: '', estadoId: '', prefixo: '', latCentro: '', lngCentro: '', zoomPadrao: '13', ativa: true,
  })
  const [salvandoEditCidade, setSalvandoEditCidade] = useState(false)

  // Refs para que callbacks do mapa sempre leiam os valores mais recentes
  const cidadeSelRef = useRef<Cidade | null>(null)
  const regioesRef = useRef<Regiao[]>([])
  const mapaReadyRef = useRef(false)
  const todasCidadesRef = useRef<Cidade[]>([])

  useEffect(() => { cidadeSelRef.current = cidadeSel }, [cidadeSel])
  useEffect(() => { regioesRef.current = regioes }, [regioes])
  useEffect(() => { todasCidadesRef.current = todasCidades }, [todasCidades])

  // ── Inicialização ──────────────────────────────────────────
  // 1. Carrega todas as cidades de uma vez (já vêm com estado embutido)
  // 2. Deriva estados únicos a partir das cidades
  // 3. Restaura seleção salva e carrega regiões
  useEffect(() => {
    async function init() {
      const [rCidades, rEstados] = await Promise.all([getCidadesApi(), getEstadosApi()])
      if (!rCidades.ok || !rEstados.ok) return

      const listaCidadesAll: Cidade[] = (await rCidades.json()).map(normalizarCidade)
      const listaEstadosAll: Estado[] = await rEstados.json()

      setTodasCidades(listaCidadesAll)
      setTodosEstados(listaEstadosAll)

      // Deriva estados com cidades cadastradas para o select do header
      const estadosMap = new Map<string, Estado>()
      listaCidadesAll.forEach((c) => {
        if (!estadosMap.has(c.estadoId)) {
          estadosMap.set(c.estadoId, { id: c.estadoId, nome: c.estadoNome })
        }
      })
      setEstados(Array.from(estadosMap.values()))

      // Restaura seleção salva
      const estadoSalvo = localStorage.getItem('regioes:estado') ?? ''
      const cidadeIdSalvo = Number(localStorage.getItem('regioes:cidadeId')) || null
      if (!estadoSalvo) return

      setEstadoSel(estadoSalvo)
      const cidadesFiltradas = listaCidadesAll.filter((c) => c.estadoId === estadoSalvo)
      setCidades(cidadesFiltradas)

      if (!cidadeIdSalvo) return
      const cidade = cidadesFiltradas.find((c) => c.id === cidadeIdSalvo)
      if (!cidade) return

      setCidadeSel(cidade)
      cidadeSelRef.current = cidade

      const rRegioes = await getRegioesPorCidadeApi(cidade.id)
      if (!rRegioes.ok) return
      const listaRegioes: Regiao[] = await rRegioes.json()
      setRegioes(listaRegioes)
      regioesRef.current = listaRegioes

      if (mapaReadyRef.current) {
        aplicarCidadeNoMapa(cidade, listaRegioes)
      }
    }

    init()
  }, [])

  function aplicarCidadeNoMapa(cidade: Cidade, listaRegioes: Regiao[]) {
    mapaRef.current?.moverParaCidade(cidade.latCentro, cidade.lngCentro, cidade.zoomPadrao)
    const mapped: RegiaoMapa[] = listaRegioes.map((r) => ({
      id: r.id,
      nome: r.nome,
      coordenadas: JSON.parse(r.coordenadas || '[]'),
    }))
    mapaRef.current?.renderizarRegioes(mapped, null)
  }

  // Chamado pelo mapa quando termina de inicializar
  function handleMapaReady() {
    mapaReadyRef.current = true
    setMapaCarregado(true)
    // Usa refs para pegar os valores mais recentes (init pode ter terminado antes ou depois)
    const cidade = cidadeSelRef.current
    const listaRegioes = regioesRef.current
    if (cidade) {
      aplicarCidadeNoMapa(cidade, listaRegioes)
    }
  }


  // Quando cidade muda — move mapa e carrega regiões
  useEffect(() => {
    if (!cidadeSel) { setRegioes([]); return }
    if (mapaReadyRef.current) {
      mapaRef.current?.moverParaCidade(cidadeSel.latCentro, cidadeSel.lngCentro, cidadeSel.zoomPadrao)
    }
    carregarRegioes(cidadeSel.id)
  }, [cidadeSel])

  // Atualiza polígonos no mapa quando regiões mudam (só após o mapa estar pronto)
  useEffect(() => {
    if (!mapaCarregado) return
    const mapped: RegiaoMapa[] = regioes
      .filter((r) => r.id !== modoEdicao?.regiao.id)
      .map((r) => ({
        id: r.id,
        nome: r.nome,
        coordenadas: JSON.parse(r.coordenadas || '[]'),
      }))
    mapaRef.current?.renderizarRegioes(mapped, null)
  }, [regioes, modoEdicao, mapaCarregado])

  async function carregarRegioes(cidadeId: number) {
    const r = await getRegioesPorCidadeApi(cidadeId)
    if (r.ok) setRegioes(await r.json())
  }

  function exibirToast(msg: string, tipo: 'sucesso' | 'erro') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Desenho ────────────────────────────────────────────
  function toggleDesenho() {
    if (desenhando) {
      mapaRef.current?.desativarDesenho()
      setDesenhando(false)
    } else {
      mapaRef.current?.ativarDesenho()
      setDesenhando(true)
      setDesenhoFinalizado(false)
    }
  }

  function handleDesenhoFinalizado() {
    setDesenhando(false)
    setDesenhoFinalizado(true)
  }

  function limparDesenho() {
    mapaRef.current?.limparDesenho()
    setPontos([])
    setDesenhando(false)
    setDesenhoFinalizado(false)
    setNomeNova('')
  }

  async function salvarNovaRegiao() {
    if (!cidadeSel || pontos.length < 3 || !nomeNova.trim()) return
    setSalvando(true)
    try {
      const res = await criarRegiaoApi({
        nome: nomeNova.trim(),
        cidadeId: cidadeSel.id,
        coordenadas: JSON.stringify(pontos),
      })
      if (res.ok) {
        exibirToast('Região criada!', 'sucesso')
        limparDesenho()
        carregarRegioes(cidadeSel.id)
      } else {
        exibirToast('Erro ao salvar região.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  // ── Edição ─────────────────────────────────────────────
  function iniciarEdicao(r: Regiao) {
    const pts: Ponto[] = JSON.parse(r.coordenadas || '[]')
    setModoEdicao({ regiao: r, pontos: pts, nomeEdit: r.nome })
    mapaRef.current?.ativarEdicao(
      pts,
      (novos) => setModoEdicao((prev) => prev ? { ...prev, pontos: novos } : null),
    )
  }

  function cancelarEdicao() {
    mapaRef.current?.desativarEdicao()
    setModoEdicao(null)
    if (cidadeSel) {
      const mapped: RegiaoMapa[] = regioes.map((r) => ({
        id: r.id,
        nome: r.nome,
        coordenadas: JSON.parse(r.coordenadas || '[]'),
      }))
      mapaRef.current?.renderizarRegioes(mapped, null)
    }
  }

  async function salvarEdicao() {
    if (!cidadeSel || !modoEdicao) return
    setSalvando(true)
    try {
      const res = await editarRegiaoApi(modoEdicao.regiao.id, {
        nome: modoEdicao.nomeEdit.trim(),
        cidadeId: cidadeSel.id,
        coordenadas: JSON.stringify(modoEdicao.pontos),
      })
      if (res.ok) {
        exibirToast('Região atualizada!', 'sucesso')
        mapaRef.current?.desativarEdicao()
        setModoEdicao(null)
        carregarRegioes(cidadeSel.id)
      } else {
        exibirToast('Erro ao salvar.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function excluirRegiao(r: Regiao) {
    if (!cidadeSel) return
    setSalvando(true)
    try {
      const res = await excluirRegiaoApi(r.id)
      if (res.ok) {
        exibirToast('Região excluída.', 'sucesso')
        carregarRegioes(cidadeSel.id)
      } else if (res.status === 409) {
        exibirToast('Região possui imóveis vinculados.', 'erro')
      } else {
        exibirToast('Erro ao excluir.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function buscarMunicipiosIBGE(uf: string) {
    if (!uf) { setMunicipiosIBGE([]); return }
    setCarregandoMunicipios(true)
    try {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
      if (res.ok) {
        const data: { id: number; nome: string }[] = await res.json()
        setMunicipiosIBGE(data.sort((a, b) => a.nome.localeCompare(b.nome)))
      }
    } catch {
      setMunicipiosIBGE([])
    } finally {
      setCarregandoMunicipios(false)
    }
  }

  async function salvarNovaCidade() {
    const prefixo = novaCidade.prefixo.trim().toUpperCase()
    if (!novaCidade.nome.trim() || !novaCidade.estadoId || prefixo.length !== 3 || !/^[A-Z]{3}$/.test(prefixo)) return
    const lat = parseFloat(novaCidade.latCentro)
    const lng = parseFloat(novaCidade.lngCentro)
    const zoom = parseInt(novaCidade.zoomPadrao)
    if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return
    setSalvandoCidade(true)
    try {
      const res = await criarCidadeApi({
        nome: novaCidade.nome.trim(),
        estadoId: novaCidade.estadoId,
        prefixo,
        latCentro: lat,
        lngCentro: lng,
        zoomPadrao: zoom,
        ativa: true,
      })
      if (res.ok) {
        exibirToast('Cidade cadastrada!', 'sucesso')
        setModalCidade(false)
        setNovaCidade({ nome: '', estadoId: '', prefixo: '', latCentro: '', lngCentro: '', zoomPadrao: '13', ativa: true })
        setMunicipiosIBGE([])
        // Recarrega todas as cidades e recalcula estados disponíveis
        const rC = await getCidadesApi()
        if (rC.ok) {
          const todasAtualizadas: Cidade[] = (await rC.json()).map(normalizarCidade)
          setTodasCidades(todasAtualizadas)
          const estadosMap = new Map<string, Estado>()
          todasAtualizadas.forEach((c) => {
            if (!estadosMap.has(c.estadoId)) estadosMap.set(c.estadoId, { id: c.estadoId, nome: c.estadoNome })
          })
          setEstados(Array.from(estadosMap.values()))
          if (estadoSel) setCidades(todasAtualizadas.filter((c) => c.estadoId === estadoSel))
        }
      } else {
        const err = await res.json().catch(() => null)
        exibirToast(err?.message ?? 'Erro ao cadastrar cidade.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setSalvandoCidade(false)
    }
  }

  function abrirEditarCidade() {
    if (!cidadeSel) return
    setEditCidade({
      nome: cidadeSel.nome,
      estadoId: cidadeSel.estadoId,
      prefixo: cidadeSel.prefixo,
      latCentro: cidadeSel.latCentro.toString(),
      lngCentro: cidadeSel.lngCentro.toString(),
      zoomPadrao: cidadeSel.zoomPadrao.toString(),
      ativa: true,
    })
    setModalEditarCidade(true)
  }

  async function salvarEditarCidade() {
    if (!cidadeSel) return
    const lat = parseFloat(editCidade.latCentro)
    const lng = parseFloat(editCidade.lngCentro)
    const zoom = parseInt(editCidade.zoomPadrao)
    if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return
    setSalvandoEditCidade(true)
    try {
      const res = await editarCidadeApi(cidadeSel.id, {
        nome: cidadeSel.nome,
        estadoId: estadoSel,
        prefixo: editCidade.prefixo,
        latCentro: lat,
        lngCentro: lng,
        zoomPadrao: zoom,
        ativa: true,
      })
      if (res.ok) {
        exibirToast('Cidade atualizada!', 'sucesso')
        setModalEditarCidade(false)
        // Recarrega todas as cidades e atualiza cidadeSel
        const rC = await getCidadesApi()
        if (rC.ok) {
          const todasAtualizadas: Cidade[] = (await rC.json()).map(normalizarCidade)
          setTodasCidades(todasAtualizadas)
          const filtradas = todasAtualizadas.filter((c) => c.estadoId === estadoSel)
          setCidades(filtradas)
          setCidadeSel(filtradas.find((c) => c.id === cidadeSel.id) ?? null)
        }
      } else {
        const err = await res.json().catch(() => null)
        exibirToast(err?.message ?? 'Erro ao atualizar cidade.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setSalvandoEditCidade(false)
    }
  }

  const podeDesenhar = !!cidadeSel
  const podeSalvar = pontos.length >= 3 && nomeNova.trim().length > 0
  const desenhoAtivo = pontos.length >= 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold shadow-lg"
          style={{
            backgroundColor: toast.tipo === 'sucesso' ? '#14532d' : '#3B1F1F',
            color: toast.tipo === 'sucesso' ? '#4ADE80' : '#F87171',
            border: `1px solid ${toast.tipo === 'sucesso' ? '#166534' : '#7f1d1d'}`,
          }}
        >
          {toast.tipo === 'sucesso' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 20px',
          borderBottom: '3px solid var(--gold, #c49818)',
          backgroundColor: 'var(--ink, #1b3a2f)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 800, margin: 0, marginRight: '8px', fontFamily: "'Playfair Display', serif" }}>
          Regiões
        </h1>

        {/* Selects estado + cidade — centro do header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: 'var(--gold, #c49818)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Estado
            </span>
            <div style={{ position: 'relative' }}>
              <select
                value={estadoSel}
                onChange={(e) => {
                  const v = e.target.value
                  setEstadoSel(v)
                  localStorage.setItem('regioes:estado', v)
                  const filtradas = todasCidadesRef.current.filter((c) => c.estadoId === v)
                  setCidades(filtradas)
                  const primeira = filtradas[0] ?? null
                  setCidadeSel(primeira)
                  if (primeira) localStorage.setItem('regioes:cidadeId', primeira.id.toString())
                  else localStorage.removeItem('regioes:cidadeId')
                }}
                style={estiloSelectHeaderRegioes}
              >
                {estados.map((e) => (
                  <option key={e.id} value={e.id} style={{ backgroundColor: '#1b3a2f', color: '#f4f1e6' }}>
                    {e.nome}
                  </option>
                ))}
              </select>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c49818)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '18px', marginTop: '10px' }}>›</span>

          {/* Cidade */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: 'var(--gold, #c49818)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Cidade
            </span>
            <div style={{ position: 'relative' }}>
              <select
                value={cidadeSel?.id.toString() ?? ''}
                onChange={(e) => {
                  const c = cidades.find((c) => c.id.toString() === e.target.value) ?? null
                  setCidadeSel(c)
                  if (c) localStorage.setItem('regioes:cidadeId', c.id.toString())
                }}
                disabled={!estadoSel || cidades.length === 0}
                style={{ ...estiloSelectHeaderRegioes, width: '200px' }}
              >
                {cidades.map((c) => (
                  <option key={c.id} value={c.id} style={{ backgroundColor: '#1b3a2f', color: '#f4f1e6' }}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--gold, #c49818)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <button
            onClick={() => setModalCidade(true)}
            style={{
              backgroundColor: 'var(--ink, #1b3a2f)',
              color: 'var(--gold, #c49818)',
              border: '1px solid var(--gold, #c49818)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginTop: '16px',
            }}
          >
            + Cadastrar cidade
          </button>
          {cidadeSel && (
            <button
              onClick={abrirEditarCidade}
              style={{
                backgroundColor: 'var(--ink, #1b3a2f)',
                color: 'var(--gold, #c49818)',
                border: '1px solid var(--gold, #c49818)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginTop: '16px',
              }}
            >
              ✎ Editar cidade
            </button>
          )}
        </div>

        {/* Toggle painel mobile */}
        <button
          onClick={() => setPainelAberto((v) => !v)}
          className="md:hidden"
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {painelAberto ? '✕ Painel' : '☰ Painel'}
        </button>
      </div>

      {/* Corpo */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mapa */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapaRegioes
            ref={mapaRef}
            onDesenhoAtualizado={setPontos}
            onDesenhoFinalizado={handleDesenhoFinalizado}
            onReady={handleMapaReady}
          />

          {/* Loading overlay */}
          {!mapaCarregado && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1000,
              backgroundColor: 'var(--color-black)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '3px solid rgba(196,152,24,0.2)',
                borderTopColor: '#c49818',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 300, margin: 0 }}>
                Carregando mapa...
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Instrução de desenho flutuante */}
          {desenhando && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 500,
                backgroundColor: 'rgba(29,30,32,0.9)',
                color: '#c49818',
                border: '1px solid rgba(196,152,24,0.4)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 700,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {pontos.length < 3
                ? `Clique no mapa para adicionar pontos (${pontos.length} adicionado${pontos.length !== 1 ? 's' : ''})`
                : `${pontos.length} pontos — duplo clique para finalizar`}
            </div>
          )}
        </div>

        {/* Painel lateral */}
        <div
          style={{
            width: '340px',
            flexShrink: 0,
            height: '100%',
            backgroundColor: 'var(--paper, #f4f1e6)',
            borderLeft: '1px solid var(--gold, #c49818)',
            display: painelAberto ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Modo edição ── */}
          {modoEdicao ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gold, #c49818)', flexShrink: 0 }}>
                <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '14px', fontWeight: 800, margin: '0 0 12px 0', fontFamily: "'Playfair Display', serif" }}>
                  Editando: {modoEdicao.regiao.nome}
                </p>
                <Campo
                  label="Nome"
                  value={modoEdicao.nomeEdit}
                  onChange={(v) => setModoEdicao({ ...modoEdicao, nomeEdit: v })}
                />
                <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '11px', margin: '10px 0 0 0' }}>
                  Arraste os marcadores no mapa ou edite as coordenadas abaixo.
                </p>
              </div>

              {/* Lista de pontos */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>
                  Pontos ({modoEdicao.pontos.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {modoEdicao.pontos.map((p, i) => {
                    return (
                      <div
                        key={i}
                        style={{
                          backgroundColor: 'var(--paper-2, #eae6d4)',
                          border: '1px solid var(--paper-3, #dddac8)',
                          borderRadius: '8px',
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: 'var(--ink, #1b3a2f)', fontSize: '11px', fontWeight: 700 }}>
                            Ponto {i + 1}
                          </span>
                          {modoEdicao.pontos.length > 3 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                mapaRef.current?.excluirPontoEdicao(i)
                              }}
                              style={{ background: 'none', border: 'none', color: '#F87171', fontSize: '12px', cursor: 'pointer', padding: '0 2px' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <div>
                            <label style={{ color: 'var(--ink, #1b3a2f)', fontSize: '10px', display: 'block', marginBottom: '2px' }}>Lat</label>
                            <input
                              type="number"
                              step="any"
                              value={p[0].toFixed(6)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const lat = parseFloat(e.target.value)
                                if (!isNaN(lat)) mapaRef.current?.atualizarPontoEdicao(i, lat, p[1])
                              }}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                backgroundColor: 'var(--paper, #f4f1e6)',
                                color: 'var(--ink, #1b3a2f)',
                                border: '1px solid var(--paper-3, #dddac8)',
                                borderRadius: '4px', padding: '4px 6px',
                                fontSize: '11px', outline: 'none',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ color: 'var(--ink, #1b3a2f)', fontSize: '10px', display: 'block', marginBottom: '2px' }}>Lng</label>
                            <input
                              type="number"
                              step="any"
                              value={p[1].toFixed(6)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const lng = parseFloat(e.target.value)
                                if (!isNaN(lng)) mapaRef.current?.atualizarPontoEdicao(i, p[0], lng)
                              }}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                backgroundColor: 'var(--paper, #f4f1e6)',
                                color: 'var(--ink, #1b3a2f)',
                                border: '1px solid var(--paper-3, #dddac8)',
                                borderRadius: '4px', padding: '4px 6px',
                                fontSize: '11px', outline: 'none',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Botões */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gold, #c49818)', display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={cancelarEdicao} style={btnSecundario}>Cancelar</button>
                <button onClick={salvarEdicao} disabled={salvando} style={btnPrimario(salvando)}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ) : (
            /* ── Modo padrão ── */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Formulário nova região */}
              <div style={{ padding: '20px', borderBottom: '1px solid var(--gold, #c49818)' }}>
                <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '14px', fontWeight: 800, margin: '0 0 14px 0', fontFamily: "'Playfair Display', serif" }}>
                  Nova região
                </p>

                {!podeDesenhar && (
                  <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '12px', margin: '0 0 12px 0' }}>
                    Selecione uma cidade no cabeçalho para habilitar o desenho.
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={toggleDesenho}
                      disabled={!podeDesenhar}
                      style={{
                        flex: 1,
                        padding: '9px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: podeDesenhar ? 'pointer' : 'not-allowed',
                        opacity: podeDesenhar ? 1 : 0.4,
                        backgroundColor: desenhando ? 'rgba(248,113,113,0.1)' : 'var(--ink, #1b3a2f)',
                        color: desenhando ? '#F87171' : 'var(--gold, #c49818)',
                        border: desenhando ? '1px solid #F87171' : '1px solid var(--gold, #c49818)',
                      }}
                    >
                      {desenhando ? '✕ Parar' : desenhoFinalizado ? '✓ Finalizado' : '✏ Desenhar'}
                    </button>
                    {pontos.length > 0 && (
                      <button onClick={limparDesenho} style={{ ...btnSecundario, flex: 1 }}>
                        Limpar
                      </button>
                    )}
                  </div>

                  {desenhoAtivo && (
                    <Campo
                      label="Nome da região"
                      placeholder="Ex: Zona Norte"
                      value={nomeNova}
                      onChange={setNomeNova}
                    />
                  )}

                  <button
                    onClick={salvarNovaRegiao}
                    disabled={!podeSalvar || salvando}
                    style={btnPrimario(!podeSalvar || salvando)}
                  >
                    {salvando ? 'Salvando...' : 'Salvar região'}
                  </button>

                  {pontos.length > 0 && pontos.length < 3 && (
                    <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '11px', margin: 0, textAlign: 'center' }}>
                      Adicione pelo menos 3 pontos para salvar.
                    </p>
                  )}
                </div>
              </div>

              {/* Lista de regiões */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {!cidadeSel ? (
                  <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '12px', margin: 0 }}>
                    Selecione uma cidade para ver as regiões.
                  </p>
                ) : regioes.length === 0 ? (
                  <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '12px', margin: 0 }}>
                    Nenhuma região cadastrada para esta cidade.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0', fontFamily: "'Playfair Display', serif" }}>
                      Regiões cadastradas
                    </p>
                    {regioes.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          backgroundColor: 'var(--paper-2, #eae6d4)',
                          border: '1px solid var(--gold, #c49818)',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.nome}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => iniciarEdicao(r)}
                            style={{
                              backgroundColor: 'var(--ink, #1b3a2f)',
                              color: 'var(--gold, #c49818)',
                              border: '1px solid var(--gold, #c49818)',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirRegiao(r)}
                            style={{
                              backgroundColor: 'rgba(248,113,113,0.1)',
                              color: '#F87171',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '5px 10px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Modal cadastrar cidade */}
      {modalCidade && (
        <div
          onClick={() => { setModalCidade(false); setMunicipiosIBGE([]) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--paper, #f4f1e6)',
              border: '1px solid var(--gold, #c49818)',
              borderTop: '3px solid var(--gold, #c49818)',
              borderRadius: '14px',
              padding: '28px',
              width: '100%',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '15px', fontWeight: 800, margin: 0, fontFamily: "'Playfair Display', serif" }}>
                Cadastrar cidade
              </p>
              <button
                onClick={() => { setModalCidade(false); setMunicipiosIBGE([]) }}
                style={{ backgroundColor: 'var(--paper-3, #dddac8)', border: 'none', color: 'var(--ink, #1b3a2f)', fontSize: '14px', cursor: 'pointer', lineHeight: 1, borderRadius: '6px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Estado */}
              <div>
                <label style={{ display: 'block', color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Estado
                </label>
                <select
                  value={novaCidade.estadoId}
                  onChange={(e) => {
                    const uf = e.target.value
                    setNovaCidade((p) => ({ ...p, estadoId: uf, nome: '' }))
                    setMunicipiosIBGE([])
                    buscarMunicipiosIBGE(uf)
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: 'var(--paper-2, #eae6d4)',
                    color: 'var(--ink, #1b3a2f)',
                    border: '1px solid var(--paper-3, #dddac8)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', fontWeight: 700, outline: 'none',
                  }}
                >
                  <option value="" disabled hidden>Selecione o estado</option>
                  {todosEstados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Município (IBGE) */}
              <div>
                <label style={{ display: 'block', color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Cidade
                </label>
                <select
                  value={novaCidade.nome}
                  disabled={!novaCidade.estadoId || carregandoMunicipios}
                  onChange={(e) => setNovaCidade((p) => ({ ...p, nome: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: 'var(--paper-2, #eae6d4)',
                    color: 'var(--ink, #1b3a2f)',
                    border: '1px solid var(--paper-3, #dddac8)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', fontWeight: 700, outline: 'none',
                    opacity: (!novaCidade.estadoId || carregandoMunicipios) ? 0.4 : 1,
                    cursor: (!novaCidade.estadoId || carregandoMunicipios) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="" disabled hidden>
                    {carregandoMunicipios ? 'Carregando...' : 'Selecione a cidade'}
                  </option>
                  {municipiosIBGE.map((m) => (
                    <option key={m.id} value={m.nome}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prefixo */}
              <div>
                <label style={{ display: 'block', color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Prefixo <span style={{ color: 'var(--sepia, #7a9e88)', fontWeight: 400, fontSize: '11px' }}>(3 letras maiúsculas — ex: ARC)</span>
                </label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="ARC"
                  value={novaCidade.prefixo}
                  onChange={(e) => setNovaCidade((p) => ({ ...p, prefixo: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))}
                  style={estiloInputModal}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold, #c49818)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              {/* Lat / Lng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <CampoModal
                  label="Latitude centro"
                  placeholder="-21.2089"
                  value={novaCidade.latCentro}
                  onChange={(v) => setNovaCidade((p) => ({ ...p, latCentro: v }))}
                  type="number"
                />
                <CampoModal
                  label="Longitude centro"
                  placeholder="-50.4328"
                  value={novaCidade.lngCentro}
                  onChange={(v) => setNovaCidade((p) => ({ ...p, lngCentro: v }))}
                  type="number"
                />
              </div>

              {/* Zoom */}
              <CampoModal
                label="Zoom padrão"
                placeholder="13"
                value={novaCidade.zoomPadrao}
                onChange={(v) => setNovaCidade((p) => ({ ...p, zoomPadrao: v }))}
                type="number"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={() => { setModalCidade(false); setMunicipiosIBGE([]) }} style={{ ...btnSecundario, flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={salvarNovaCidade}
                disabled={salvandoCidade}
                style={btnPrimario(salvandoCidade)}
              >
                {salvandoCidade ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar cidade */}
      {modalEditarCidade && cidadeSel && (
        <div
          onClick={() => setModalEditarCidade(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--paper, #f4f1e6)',
              border: '1px solid var(--gold, #c49818)',
              borderTop: '3px solid var(--gold, #c49818)',
              borderRadius: '14px',
              padding: '28px',
              width: '100%',
              maxWidth: '420px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '15px', fontWeight: 800, margin: 0, fontFamily: "'Playfair Display', serif" }}>
                Editar cidade
              </p>
              <button
                onClick={() => setModalEditarCidade(false)}
                style={{ backgroundColor: 'var(--paper-3, #dddac8)', border: 'none', color: 'var(--ink, #1b3a2f)', fontSize: '14px', cursor: 'pointer', lineHeight: 1, borderRadius: '6px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <CampoLeitura label="Estado" value={estados.find((e) => e.id === estadoSel)?.nome ?? estadoSel} />
                <CampoLeitura label="Sigla" value={cidadeSel.prefixo} />
              </div>
              <CampoLeitura label="Cidade" value={cidadeSel.nome} />

              <div style={{ height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />

              {/* Lat / Lng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <CampoModal
                  label="Latitude centro"
                  placeholder="-20.4237"
                  value={editCidade.latCentro}
                  onChange={(v) => setEditCidade((p) => ({ ...p, latCentro: v }))}
                  type="number"
                />
                <CampoModal
                  label="Longitude centro"
                  placeholder="-49.9781"
                  value={editCidade.lngCentro}
                  onChange={(v) => setEditCidade((p) => ({ ...p, lngCentro: v }))}
                  type="number"
                />
              </div>

              {/* Zoom */}
              <CampoModal
                label="Zoom padrão"
                placeholder="13"
                value={editCidade.zoomPadrao}
                onChange={(v) => setEditCidade((p) => ({ ...p, zoomPadrao: v }))}
                type="number"
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={() => setModalEditarCidade(false)} style={{ ...btnSecundario, flex: 1 }}>
                Cancelar
              </button>
              <button
                onClick={salvarEditarCidade}
                disabled={salvandoEditCidade}
                style={btnPrimario(salvandoEditCidade)}
              >
                {salvandoEditCidade ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Estilos inline reutilizáveis ── */
const btnPrimario = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px',
  borderRadius: '8px',
  border: '1px solid var(--gold, #c49818)',
  fontSize: '13px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  backgroundColor: 'var(--ink, #1b3a2f)',
  color: 'var(--gold, #c49818)',
  opacity: disabled ? 0.4 : 1,
})

const btnSecundario: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: '8px',
  border: '1px solid var(--paper-3, #dddac8)',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  backgroundColor: 'var(--paper-3, #dddac8)',
  color: 'var(--ink, #1b3a2f)',
}

/* ── Componentes auxiliares ── */
function Campo({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <label style={{ display: 'block', color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          backgroundColor: 'var(--paper-2, #eae6d4)',
          color: 'var(--ink, #1b3a2f)',
          border: '1px solid var(--paper-3, #dddac8)',
          borderRadius: '8px',
          padding: '9px 12px',
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box',
          opacity: disabled ? 0.4 : 1,
        }}
        onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)')}
      />
    </div>
  )
}


const estiloSelectHeaderRegioes: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: '#ffffff',
  border: '1.5px solid var(--gold, #c49818)',
  borderRadius: '0',
  padding: '5px 28px 5px 10px',
  fontSize: '12px',
  fontWeight: 700,
  outline: 'none',
  cursor: 'pointer',
  width: '120px',
  appearance: 'none',
  WebkitAppearance: 'none',
}

const estiloInputModal: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--paper-2, #eae6d4)',
  color: 'var(--ink, #1b3a2f)',
  border: '1px solid var(--paper-3, #dddac8)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  outline: 'none',
  fontWeight: 700,
}

function CampoModal({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type={type}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={estiloInputModal}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold, #c49818)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)')}
      />
    </div>
  )
}

function CampoLeitura({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--sepia, #7a9e88)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </label>
      <p style={{
        margin: 0,
        backgroundColor: 'var(--paper-3, #dddac8)',
        border: '1px solid var(--paper-3, #dddac8)',
        borderRadius: '8px',
        padding: '9px 12px',
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--sepia, #7a9e88)',
        cursor: 'not-allowed',
        userSelect: 'none',
        opacity: 0.8,
      }}>
        {value}
      </p>
    </div>
  )
}
