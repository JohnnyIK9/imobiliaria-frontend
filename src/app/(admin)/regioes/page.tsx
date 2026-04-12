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
} from '@/lib/api'
import type { MapaRegioesRef, Ponto, RegiaoMapa } from '@/components/admin/MapaRegioes'

const MapaRegioes = dynamic(() => import('@/components/admin/MapaRegioes'), { ssr: false })

type Estado = { id: string; nome: string }
type Cidade = { id: number; nome: string; estadoId: string; latCentro: number; lngCentro: number; zoomPadrao: number }
type Regiao = { id: number; nome: string; coordenadas: string; totalImoveis: number }

type ModoEdicao = {
  regiao: Regiao
  pontos: Ponto[]
  nomeEdit: string
  pontoSelecionado: number | null
}

export default function RegioesPage() {
  const mapaRef = useRef<MapaRegioesRef>(null)

  const [estados, setEstados] = useState<Estado[]>([])
  const [cidades, setCidades] = useState<Cidade[]>([])
  const [regioes, setRegioes] = useState<Regiao[]>([])

  const [estadoSel, setEstadoSel] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('regioes:estado') ?? '' : ''
  )
  const [cidadeSel, setCidadeSel] = useState<Cidade | null>(null)
  const cidadeIdSalva = useRef<number | null>(
    typeof window !== 'undefined'
      ? Number(localStorage.getItem('regioes:cidadeId')) || null
      : null
  )

  const [desenhando, setDesenhando] = useState(false)
  const [desenhoFinalizado, setDesenhoFinalizado] = useState(false)
  const [pontos, setPontos] = useState<Ponto[]>([])
  const [nomeNova, setNomeNova] = useState('')

  const [modoEdicao, setModoEdicao] = useState<ModoEdicao | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const [painelAberto, setPainelAberto] = useState(true)
  const [mapaCarregado, setMapaCarregado] = useState(false)

  // Carrega estados ao montar
  useEffect(() => {
    getEstadosApi().then(async (r) => {
      if (r.ok) setEstados(await r.json())
    })
  }, [])

  // Persiste estado selecionado
  useEffect(() => {
    if (estadoSel) localStorage.setItem('regioes:estado', estadoSel)
  }, [estadoSel])

  // Carrega cidades ao trocar estado e restaura cidade salva
  useEffect(() => {
    if (!estadoSel) { setCidades([]); setCidadeSel(null); return }
    getCidadesApi(estadoSel).then(async (r) => {
      if (r.ok) {
        const lista: Cidade[] = await r.json()
        setCidades(lista)
        // Restaura última cidade se pertencer ao estado atual
        if (cidadeIdSalva.current) {
          const anterior = lista.find((c) => c.id === cidadeIdSalva.current)
          if (anterior) setCidadeSel(anterior)
        }
      } else {
        setCidades([])
      }
    })
  }, [estadoSel])

  // Carrega regiões ao trocar cidade e move o mapa
  useEffect(() => {
    if (!cidadeSel) { setRegioes([]); return }
    // Se o mapa já estiver pronto, move imediatamente
    if (mapaRef.current) {
      mapaRef.current.moverParaCidade(cidadeSel.latCentro, cidadeSel.lngCentro, cidadeSel.zoomPadrao)
    }
    // Se não, onReady vai chamar quando o mapa inicializar
    carregarRegioes(cidadeSel.id)
  }, [cidadeSel])

  function handleMapaReady() {
    setTimeout(() => {
      if (cidadeSel) {
        mapaRef.current?.moverParaCidade(cidadeSel.latCentro, cidadeSel.lngCentro, cidadeSel.zoomPadrao)
      }
      // Renderiza regiões que já foram carregadas enquanto o mapa inicializava
      if (regioes.length > 0) {
        const mapped: RegiaoMapa[] = regioes.map((r) => ({
          id: r.id,
          nome: r.nome,
          coordenadas: JSON.parse(r.coordenadas || '[]'),
          totalImoveis: r.totalImoveis,
        }))
        mapaRef.current?.renderizarRegioes(mapped, null)
      }
      setMapaCarregado(true)
    }, 1000)
  }

  // Atualiza polígonos no mapa quando regiões mudam (só após o mapa estar pronto)
  useEffect(() => {
    if (!mapaCarregado) return
    const mapped: RegiaoMapa[] = regioes.map((r) => ({
      id: r.id,
      nome: r.nome,
      coordenadas: JSON.parse(r.coordenadas || '[]'),
      totalImoveis: r.totalImoveis,
    }))
    mapaRef.current?.renderizarRegioes(mapped, modoEdicao?.regiao.id ?? null)
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
    setModoEdicao({ regiao: r, pontos: pts, nomeEdit: r.nome, pontoSelecionado: null })
    mapaRef.current?.ativarEdicao(
      pts,
      (novos) => setModoEdicao((prev) => prev ? { ...prev, pontos: novos } : null),
      (i) => setModoEdicao((prev) => prev ? { ...prev, pontoSelecionado: i } : null),
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
        totalImoveis: r.totalImoveis,
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

  const podeDesenhar = !!cidadeSel
  const podeSalvar = pontos.length >= 3 && nomeNova.trim().length > 0

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
              if (c) {
                cidadeIdSalva.current = c.id
                localStorage.setItem('regioes:cidadeId', c.id.toString())
              }
            }}
            placeholder="Selecione a cidade"
            options={cidades.map((c) => ({ value: c.id.toString(), label: c.nome }))}
            disabled={!estadoSel || cidades.length === 0}
            width="220px"
          />
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
                  Clique num marcador para selecioná-lo (fica vermelho) e edite as coordenadas abaixo.
                </p>
              </div>

              {/* Lista de pontos */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>
                  Pontos ({modoEdicao.pontos.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {modoEdicao.pontos.map((p, i) => {
                    const selecionado = modoEdicao.pontoSelecionado === i
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setModoEdicao((prev) => prev ? { ...prev, pontoSelecionado: i } : null)
                          mapaRef.current?.selecionarPontoEdicao(i)
                        }}
                        style={{
                          backgroundColor: selecionado ? 'rgba(248,113,113,0.12)' : 'var(--color-green-mid)',
                          border: `1px solid ${selecionado ? 'rgba(248,113,113,0.4)' : 'transparent'}`,
                          borderRadius: '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: selecionado ? '#F87171' : 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700 }}>
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
                  <Campo
                    label="Nome da região"
                    placeholder="Ex: Zona Norte"
                    value={nomeNova}
                    onChange={setNomeNova}
                    disabled={!podeDesenhar}
                  />

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
                          <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', margin: 0 }}>
                            {r.totalImoveis} imóvel(is)
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
