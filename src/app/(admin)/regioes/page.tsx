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
type CidadeRaw = { id: number; nome: string; estadoId?: string; estado_id?: string; prefixo?: string; latCentro?: number; lat_centro?: number; lngCentro?: number; lng_centro?: number; zoomPadrao?: number; zoom_padrao?: number }
type Cidade = { id: number; nome: string; estadoId: string; prefixo: string; latCentro: number; lngCentro: number; zoomPadrao: number }

function normalizarCidade(r: CidadeRaw): Cidade {
  return {
    id: r.id,
    nome: r.nome,
    estadoId: r.estadoId ?? r.estado_id ?? '',
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

  useEffect(() => { cidadeSelRef.current = cidadeSel }, [cidadeSel])
  useEffect(() => { regioesRef.current = regioes }, [regioes])

  // ── Inicialização sequencial ──────────────────────────────
  // 1. Carrega estados
  // 2. Lê cookie e carrega cidades do estado salvo
  // 3. Restaura cidade salva
  // 4. Carrega regiões da cidade
  // (mover mapa e renderizar regiões acontece em handleMapaReady ou aqui se mapa já estiver pronto)
  useEffect(() => {
    async function init() {
      // 1. Estados
      const rEstados = await getEstadosApi()
      if (!rEstados.ok) return
      const listaEstados: Estado[] = await rEstados.json()
      setEstados(listaEstados)

      // 2. Cookie
      const estadoSalvo = localStorage.getItem('regioes:estado') ?? ''
      const cidadeIdSalvo = Number(localStorage.getItem('regioes:cidadeId')) || null
      if (!estadoSalvo) return

      setEstadoSel(estadoSalvo)

      // 3. Cidades do estado salvo
      const rCidades = await getCidadesApi(estadoSalvo)
      if (!rCidades.ok) return
      const listaCidades: Cidade[] = (await rCidades.json()).map(normalizarCidade)
      setCidades(listaCidades)

      if (!cidadeIdSalvo) return
      const cidade = listaCidades.find((c) => c.id === cidadeIdSalvo)
      if (!cidade) return

      setCidadeSel(cidade)
      cidadeSelRef.current = cidade

      // 4. Regiões da cidade
      const rRegioes = await getRegioesPorCidadeApi(cidade.id)
      if (!rRegioes.ok) return
      const listaRegioes: Regiao[] = await rRegioes.json()
      setRegioes(listaRegioes)
      regioesRef.current = listaRegioes

      // 5. Se o mapa já estiver pronto, move e renderiza agora
      if (mapaReadyRef.current) {
        aplicarCidadeNoMapa(cidade, listaRegioes)
      }
      // Caso contrário, handleMapaReady vai usar os refs quando o mapa terminar de carregar
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

  // Quando o usuário muda o estado manualmente no filtro
  const initDone = useRef(false)
  useEffect(() => {
    // Ignora o primeiro disparo — a inicialização sequencial já cuida disso
    if (!initDone.current) { initDone.current = true; return }
    if (!estadoSel) { setCidades([]); setCidadeSel(null); return }
    localStorage.setItem('regioes:estado', estadoSel)
    getCidadesApi(estadoSel).then(async (r) => {
      if (r.ok) setCidades((await r.json()).map(normalizarCidade))
      else setCidades([])
    })
    setCidadeSel(null)
  }, [estadoSel])

  // Quando o usuário muda de cidade manualmente no filtro
  useEffect(() => {
    if (!cidadeSel) { setRegioes([]); return }
    localStorage.setItem('regioes:cidadeId', cidadeSel.id.toString())
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
        // Recarrega as cidades do estado selecionado no header
        if (novaCidade.estadoId === estadoSel) {
          getCidadesApi(estadoSel).then(async (r) => {
            if (r.ok) setCidades((await r.json()).map(normalizarCidade))
          })
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
        // Recarrega cidades e atualiza cidadeSel com os novos dados
        const r = await getCidadesApi(editCidade.estadoId)
        if (r.ok) {
          const lista: Cidade[] = (await r.json()).map(normalizarCidade)
          setCidades(lista)
          const atualizada = lista.find((c) => c.id === cidadeSel.id) ?? null
          setCidadeSel(atualizada)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'var(--color-green-dark)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={{ color: 'var(--color-white)', fontSize: '16px', fontWeight: 800, margin: 0, marginRight: '8px' }}>
          Regiões
        </h1>

        {/* Selects estado + cidade — centro do header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Select
            value={estadoSel}
            onChange={setEstadoSel}
            placeholder="Selecione o estado"
            options={estados.map((e) => ({ value: e.id, label: e.nome }))}
            width="200px"
          />
          <Select
            value={cidadeSel?.id.toString() ?? ''}
            onChange={(v) => {
              const c = cidades.find((c) => c.id.toString() === v) ?? null
              setCidadeSel(c)
            }}
            placeholder="Selecione a cidade"
            options={cidades.map((c) => ({ value: c.id.toString(), label: c.nome }))}
            disabled={!estadoSel || cidades.length === 0}
            width="220px"
          />
          <button
            onClick={() => setModalCidade(true)}
            style={{
              backgroundColor: 'rgba(74,222,128,0.12)',
              color: '#4ADE80',
              border: '1px solid rgba(74,222,128,0.25)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Cadastrar cidade
          </button>
          {cidadeSel && (
            <button
              onClick={abrirEditarCidade}
              style={{
                backgroundColor: 'rgba(64,166,244,0.12)',
                color: '#40A6F4',
                border: '1px solid rgba(64,166,244,0.25)',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
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
            backgroundColor: 'var(--color-green-mid)',
            color: 'var(--color-white)',
            border: 'none',
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
                border: '3px solid rgba(64,166,244,0.2)',
                borderTopColor: '#40A6F4',
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
                color: '#40A6F4',
                border: '1px solid rgba(64,166,244,0.4)',
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
            backgroundColor: 'var(--color-green-dark)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: painelAberto ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Modo edição ── */}
          {modoEdicao ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 800, margin: '0 0 12px 0' }}>
                  Editando: {modoEdicao.regiao.nome}
                </p>
                <Campo
                  label="Nome"
                  value={modoEdicao.nomeEdit}
                  onChange={(v) => setModoEdicao({ ...modoEdicao, nomeEdit: v })}
                />
                <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', margin: '10px 0 0 0' }}>
                  Arraste os marcadores no mapa ou edite as coordenadas abaixo.
                </p>
              </div>

              {/* Lista de pontos */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>
                  Pontos ({modoEdicao.pontos.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {modoEdicao.pontos.map((p, i) => {
                    return (
                      <div
                        key={i}
                        style={{
                          backgroundColor: 'var(--color-green-mid)',
                          border: '1px solid transparent',
                          borderRadius: '8px',
                          padding: '8px 10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700 }}>
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
                            <label style={{ color: 'var(--color-gray-dark)', fontSize: '10px', display: 'block', marginBottom: '2px' }}>Lat</label>
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
                                backgroundColor: 'var(--color-green-dark)',
                                color: 'var(--color-white)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px', padding: '4px 6px',
                                fontSize: '11px', outline: 'none',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ color: 'var(--color-gray-dark)', fontSize: '10px', display: 'block', marginBottom: '2px' }}>Lng</label>
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
                                backgroundColor: 'var(--color-green-dark)',
                                color: 'var(--color-white)',
                                border: '1px solid rgba(255,255,255,0.1)',
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
              <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px', flexShrink: 0 }}>
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
              <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 800, margin: '0 0 14px 0' }}>
                  Nova região
                </p>

                {!podeDesenhar && (
                  <p style={{ color: 'var(--color-gray-dark)', fontSize: '12px', margin: '0 0 12px 0' }}>
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
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: podeDesenhar ? 'pointer' : 'not-allowed',
                        backgroundColor: desenhando
                          ? 'rgba(248,113,113,0.15)'
                          : desenhoFinalizado
                          ? 'rgba(74,222,128,0.15)'
                          : 'rgba(64,166,244,0.15)',
                        color: desenhando ? '#F87171' : desenhoFinalizado ? '#4ADE80' : '#40A6F4',
                        opacity: podeDesenhar ? 1 : 0.4,
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
                    <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', margin: 0, textAlign: 'center' }}>
                      Adicione pelo menos 3 pontos para salvar.
                    </p>
                  )}
                </div>
              </div>

              {/* Lista de regiões */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {!cidadeSel ? (
                  <p style={{ color: 'var(--color-gray-dark)', fontSize: '12px', margin: 0 }}>
                    Selecione uma cidade para ver as regiões.
                  </p>
                ) : regioes.length === 0 ? (
                  <p style={{ color: 'var(--color-gray-dark)', fontSize: '12px', margin: 0 }}>
                    Nenhuma região cadastrada para esta cidade.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>
                      Regiões cadastradas
                    </p>
                    {regioes.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          backgroundColor: 'var(--color-green-mid)',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.nome}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          <button
                            onClick={() => iniciarEdicao(r)}
                            style={{
                              backgroundColor: 'rgba(64,166,244,0.15)',
                              color: '#40A6F4',
                              border: 'none',
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
              backgroundColor: 'var(--color-green-dark)',
              border: '1px solid rgba(255,255,255,0.1)',
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
              <p style={{ color: 'var(--color-white)', fontSize: '15px', fontWeight: 800, margin: 0 }}>
                Cadastrar cidade
              </p>
              <button
                onClick={() => { setModalCidade(false); setMunicipiosIBGE([]) }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Estado */}
              <div>
                <label style={{ display: 'block', color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
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
                    backgroundColor: 'var(--color-green-mid)',
                    color: novaCidade.estadoId ? 'var(--color-white)' : 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', fontWeight: 700, outline: 'none',
                  }}
                >
                  <option value="" disabled hidden>Selecione o estado</option>
                  {estados.map((e) => (
                    <option key={e.id} value={e.id} style={{ color: '#fff', backgroundColor: '#374C4B' }}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Município (IBGE) */}
              <div>
                <label style={{ display: 'block', color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Cidade
                </label>
                <select
                  value={novaCidade.nome}
                  disabled={!novaCidade.estadoId || carregandoMunicipios}
                  onChange={(e) => setNovaCidade((p) => ({ ...p, nome: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    backgroundColor: 'var(--color-green-mid)',
                    color: novaCidade.nome ? 'var(--color-white)' : 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)',
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
                    <option key={m.id} value={m.nome} style={{ color: '#fff', backgroundColor: '#374C4B' }}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prefixo */}
              <div>
                <label style={{ display: 'block', color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  Prefixo <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, fontSize: '11px' }}>(3 letras maiúsculas — ex: ARC)</span>
                </label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="ARC"
                  value={novaCidade.prefixo}
                  onChange={(e) => setNovaCidade((p) => ({ ...p, prefixo: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))}
                  style={estiloInputModal}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-blue)')}
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
              backgroundColor: 'var(--color-green-dark)',
              border: '1px solid rgba(255,255,255,0.1)',
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
              <p style={{ color: 'var(--color-white)', fontSize: '15px', fontWeight: 800, margin: 0 }}>
                Editar cidade
              </p>
              <button
                onClick={() => setModalEditarCidade(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Campos somente leitura — dados do filtro central */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <CampoLeitura label="Estado" value={estados.find((e) => e.id === estadoSel)?.nome ?? estadoSel} />
                <CampoLeitura label="Sigla" value={cidadeSel.prefixo} />
              </div>
              <CampoLeitura label="Cidade" value={cidadeSel.nome} />

              <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />

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
  border: 'none',
  fontSize: '13px',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  backgroundColor: 'var(--color-blue)',
  color: '#fff',
  opacity: disabled ? 0.4 : 1,
})

const btnSecundario: React.CSSProperties = {
  padding: '9px 14px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  backgroundColor: 'var(--color-green-mid)',
  color: 'var(--color-white)',
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
      <label style={{ display: 'block', color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
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
          backgroundColor: 'var(--color-green-mid)',
          color: 'var(--color-white)',
          border: '1px solid transparent',
          borderRadius: '8px',
          padding: '9px 12px',
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box',
          opacity: disabled ? 0.4 : 1,
        }}
        onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--color-blue)' }}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      />
    </div>
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  width,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  width?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        backgroundColor: 'var(--color-green-mid)',
        color: value ? 'var(--color-white)' : 'rgba(255,255,255,0.4)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: 700,
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        width: width ?? 'auto',
      }}
    >
      <option value="" disabled hidden>{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ color: '#fff', backgroundColor: '#374C4B' }}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

const estiloInputModal: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-green-mid)',
  color: 'var(--color-white)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  outline: 'none',
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
      <label style={{ display: 'block', color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type={type}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={estiloInputModal}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-blue)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
    </div>
  )
}

function CampoLeitura({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label style={{ display: 'block', color: 'var(--color-gray-dark)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </label>
      <p style={{
        margin: 0,
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '9px 12px',
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--color-white)',
      }}>
        {value}
      </p>
    </div>
  )
}
