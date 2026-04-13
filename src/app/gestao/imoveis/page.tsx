'use client'

import { useEffect, useRef, useState } from 'react'
import {
  getCidadesApi,
  getRegioesPorCidadeApi,
  getImoveisAdminApi,
  criarImovelApi,
  editarImovelApi,
  excluirImovelApi,
  getMidiasImovelApi,
  adicionarFotoApi,
  excluirFotoApi,
  adicionarVideoApi,
  excluirVideoApi,
} from '@/lib/api'

// ── Tipos ──────────────────────────────────────────────────
type Cidade = { id: number; nome: string }
type Regiao = { id: number; nome: string }

type Imovel = {
  id: number
  codigo: string
  status: string
  publicarEm: string | null
  cidadeId: number
  regiaoId: number | null
  regiaoNome?: string
  tipo: string
  preco: number
  quartos: number
  banheiros: number
  areaM2: number
  vagas: number
  endereco: string
  descricao: string | null
}

type Foto = {
  id: number
  dadosBase64: string
  mimeType: string
  nomeArquivo: string
  ordem: number
}

type Video = {
  id: number
  urlYoutube: string
  titulo?: string
}

type FormState = {
  status: string
  publicarEm: string
  cidadeId: string
  regiaoId: string
  tipo: string
  preco: string
  quartos: string
  banheiros: string
  areaM2: string
  vagas: string
  endereco: string
  descricao: string
}

const FORM_VAZIO: FormState = {
  status: 'ativo',
  publicarEm: '',
  cidadeId: '',
  regiaoId: '',
  tipo: 'Casa',
  preco: '',
  quartos: '0',
  banheiros: '0',
  areaM2: '',
  vagas: '0',
  endereco: '',
  descricao: '',
}

// ── Helpers ────────────────────────────────────────────────
function formatarPreco(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(arquivo)
  })
}

function isYoutubeUrl(url: string) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url.trim())
}

function corStatus(status: string) {
  if (status === 'ativo') return '#4ADE80'
  if (status === 'pausado') return '#FACC15'
  if (status === 'agendado') return '#FB923C'
  return 'rgba(255,255,255,0.3)'
}

function getYoutubeId(url: string) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return match ? match[1] : null
}

function getYoutubeThumbnail(url: string) {
  const id = getYoutubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

function normalizarFoto(raw: Record<string, unknown>): Foto {
  return {
    id: raw.id as number,
    dadosBase64: (raw.dadosBase64 ?? raw.dados_base64 ?? '') as string,
    mimeType: (raw.mimeType ?? raw.mime_type ?? 'image/jpeg') as string,
    nomeArquivo: (raw.nomeArquivo ?? raw.nome_arquivo ?? '') as string,
    ordem: (raw.ordem ?? 0) as number,
  }
}

function normalizarVideo(raw: Record<string, unknown>): Video {
  return {
    id: raw.id as number,
    urlYoutube: (raw.urlYoutube ?? raw.url_youtube ?? '') as string,
    titulo: (raw.titulo ?? undefined) as string | undefined,
  }
}

function normalizarImovel(raw: Record<string, unknown>): Imovel {
  return {
    id: raw.id as number,
    codigo: (raw.codigo ?? raw.code ?? String(raw.id)) as string,
    status: (raw.status ?? 'inativo') as string,
    publicarEm: (raw.publicarEm ?? raw.publicar_em ?? null) as string | null,
    cidadeId: (raw.cidadeId ?? raw.cidade_id ?? 0) as number,
    regiaoId: (raw.regiaoId ?? raw.regiao_id ?? null) as number | null,
    regiaoNome: (raw.regiaoNome ?? raw.regiao_nome ?? raw.regiao?.nome ?? '') as string,
    tipo: (raw.tipo ?? '') as string,
    preco: (raw.preco ?? 0) as number,
    quartos: (raw.quartos ?? 0) as number,
    banheiros: (raw.banheiros ?? 0) as number,
    areaM2: (raw.areaM2 ?? raw.area_m2 ?? 0) as number,
    vagas: (raw.vagas ?? 0) as number,
    endereco: (raw.endereco ?? '') as string,
    descricao: (raw.descricao ?? null) as string | null,
  }
}

// ── Componente principal ───────────────────────────────────
export default function ImoveisPage() {
  // Filtros coluna 1
  const [filtroCidadeId, setFiltroCidadeId] = useState('')
  const [filtroRegiaoId, setFiltroRegiaoId] = useState('')
  const [filtroCidades, setFiltroCidades] = useState<Cidade[]>([])
  const [filtroRegioes, setFiltroRegioes] = useState<Regiao[]>([])
  const [busca, setBusca] = useState('')

  // Lista
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)

  // Seleção
  const [imovelSel, setImovelSel] = useState<Imovel | null>(null)

  // Mídias
  const [fotos, setFotos] = useState<Foto[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [fotoIdx, setFotoIdx] = useState(0)
  const [carregandoMidias, setCarregandoMidias] = useState(false)
  const [adicionandoFoto, setAdicionandoFoto] = useState(false)
  const [adicionandoVideo, setAdicionandoVideo] = useState(false)
  const [urlVideo, setUrlVideo] = useState('')
  const [erroVideo, setErroVideo] = useState('')
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // Formulário coluna 3
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [modoNovo, setModoNovo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  // Selects formulário
  const [formCidades, setFormCidades] = useState<Cidade[]>([])
  const [formRegioes, setFormRegioes] = useState<Regiao[]>([])

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' | 'confirm' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const [rCidades] = await Promise.all([getCidadesApi()])
      if (rCidades.ok) {
        const lista: Cidade[] = await rCidades.json()
        setFiltroCidades(lista)
        setFormCidades(lista)
      }
      await carregarImoveis()
    }
    init()
  }, [])

  // Filtro cidade → carrega regiões e refiltra lista
  useEffect(() => {
    setFiltroRegiaoId('')
    setFiltroRegioes([])
    carregarImoveis(filtroCidadeId ? { cidadeId: Number(filtroCidadeId) } : undefined)
    if (!filtroCidadeId) return
    getRegioesPorCidadeApi(Number(filtroCidadeId)).then(async (r) => {
      if (r.ok) setFiltroRegioes(await r.json())
    })
  }, [filtroCidadeId])

  // Filtro região → refiltra lista
  useEffect(() => {
    if (filtroCidadeId === '') return
    const params: { cidadeId?: number; regiaoId?: number } = { cidadeId: Number(filtroCidadeId) }
    if (filtroRegiaoId) params.regiaoId = Number(filtroRegiaoId)
    carregarImoveis(params)
  }, [filtroRegiaoId])

  // Cidade no formulário → carrega regiões do formulário
  useEffect(() => {
    setForm((f) => ({ ...f, regiaoId: '' }))
    setFormRegioes([])
    if (!form.cidadeId) return
    getRegioesPorCidadeApi(Number(form.cidadeId)).then(async (r) => {
      if (r.ok) setFormRegioes(await r.json())
    })
  }, [form.cidadeId])

  // ── API ───────────────────────────────────────────────────
  async function carregarImoveis(params?: { cidadeId?: number; regiaoId?: number }) {
    setCarregandoLista(true)
    setImoveis([])
    try {
      const res = await getImoveisAdminApi(params)
      if (res.ok) {
        const raw: Record<string, unknown>[] = await res.json()
        setImoveis(raw.map(normalizarImovel))
      }
    } finally {
      setCarregandoLista(false)
    }
  }

  async function carregarMidias(id: number) {
    setCarregandoMidias(true)
    setFotos([])
    setVideos([])
    setFotoIdx(0)
    try {
      const res = await getMidiasImovelApi(id)
      if (res.ok) {
        const data = await res.json()
        const fotosRaw: Record<string, unknown>[] = data.fotos ?? []
        const videosRaw: Record<string, unknown>[] = data.videos ?? []
        setFotos(fotosRaw.map(normalizarFoto))
        setVideos(videosRaw.map(normalizarVideo))
      }
    } finally {
      setCarregandoMidias(false)
    }
  }

  // ── Toast ─────────────────────────────────────────────────
  function exibirToast(msg: string, tipo: 'sucesso' | 'erro' | 'confirm') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, tipo })
    if (tipo !== 'confirm') {
      toastTimer.current = setTimeout(() => setToast(null), 3000)
    }
  }

  // ── Selecionar imóvel ─────────────────────────────────────
  function selecionarImovel(imovel: Imovel) {
    setImovelSel(imovel)
    setModoNovo(false)
    setConfirmandoExclusao(false)
    setForm({
      status: imovel.status,
      publicarEm: imovel.publicarEm ? imovel.publicarEm.slice(0, 16) : '',
      cidadeId: String(imovel.cidadeId),
      regiaoId: imovel.regiaoId ? String(imovel.regiaoId) : '',
      tipo: imovel.tipo,
      preco: String(imovel.preco),
      quartos: String(imovel.quartos),
      banheiros: String(imovel.banheiros),
      areaM2: String(imovel.areaM2),
      vagas: String(imovel.vagas),
      endereco: imovel.endereco,
      descricao: imovel.descricao ?? '',
    })
    carregarMidias(imovel.id)
  }

  // ── Novo imóvel ───────────────────────────────────────────
  function novoImovel() {
    setImovelSel(null)
    setModoNovo(true)
    setForm(FORM_VAZIO)
    setFotos([])
    setVideos([])
    setFotoIdx(0)
    setConfirmandoExclusao(false)
    if (toast) setToast(null)
  }

  // ── Cancelar ──────────────────────────────────────────────
  function cancelar() {
    if (imovelSel) {
      selecionarImovel(imovelSel)
    } else {
      setModoNovo(false)
      setForm(FORM_VAZIO)
    }
    setConfirmandoExclusao(false)
  }

  // ── Salvar ────────────────────────────────────────────────
  async function salvar() {
    if (!form.cidadeId || !form.endereco.trim()) {
      exibirToast('Cidade e endereço são obrigatórios.', 'erro')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        status: form.status,
        publicarEm: form.status === 'agendado' && form.publicarEm ? form.publicarEm : null,
        cidadeId: Number(form.cidadeId),
        regiaoId: form.regiaoId ? Number(form.regiaoId) : null,
        tipo: form.tipo,
        preco: Number(form.preco) || 0,
        quartos: Number(form.quartos) || 0,
        banheiros: Number(form.banheiros) || 0,
        areaM2: Number(form.areaM2) || 0,
        vagas: Number(form.vagas) || 0,
        endereco: form.endereco.trim(),
        descricao: form.descricao.trim() || null,
      }

      let res: Response
      if (modoNovo) {
        res = await criarImovelApi(payload)
      } else {
        res = await editarImovelApi(imovelSel!.id, payload)
      }

      if (res.ok) {
        const data = await res.json()
        exibirToast(modoNovo ? 'Imóvel criado com sucesso!' : 'Imóvel atualizado!', 'sucesso')

        // Recarrega lista
        const params: { cidadeId?: number; regiaoId?: number } = {}
        if (filtroCidadeId) params.cidadeId = Number(filtroCidadeId)
        if (filtroRegiaoId) params.regiaoId = Number(filtroRegiaoId)
        await carregarImoveis(Object.keys(params).length ? params : undefined)

        // Seleciona o imóvel criado/editado
        const idAlvo = modoNovo ? (data.id as number) : imovelSel!.id
        setModoNovo(false)
        setImoveis((prev) => {
          const alvo = prev.find((i) => i.id === idAlvo)
          if (alvo) {
            setImovelSel(alvo)
            setForm({
              status: alvo.status,
              publicarEm: alvo.publicarEm ? alvo.publicarEm.slice(0, 16) : '',
              cidadeId: String(alvo.cidadeId),
              regiaoId: alvo.regiaoId ? String(alvo.regiaoId) : '',
              tipo: alvo.tipo,
              preco: String(alvo.preco),
              quartos: String(alvo.quartos),
              banheiros: String(alvo.banheiros),
              areaM2: String(alvo.areaM2),
              vagas: String(alvo.vagas),
              endereco: alvo.endereco,
              descricao: alvo.descricao ?? '',
            })
            if (modoNovo) carregarMidias(alvo.id)
          }
          return prev
        })
      } else {
        const err = await res.json().catch(() => null)
        exibirToast(err?.message ?? 'Erro ao salvar imóvel.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  // ── Excluir ───────────────────────────────────────────────
  function pedirExclusao() {
    setConfirmandoExclusao(true)
    exibirToast('Confirmar exclusão permanente?', 'confirm')
  }

  async function confirmarExclusao() {
    if (!imovelSel) return
    setExcluindo(true)
    try {
      const res = await excluirImovelApi(imovelSel.id)
      if (res.ok) {
        exibirToast('Imóvel excluído.', 'sucesso')
        setImovelSel(null)
        setModoNovo(false)
        setForm(FORM_VAZIO)
        setFotos([])
        setVideos([])
        setConfirmandoExclusao(false)
        await carregarImoveis()
      } else {
        const err = await res.json().catch(() => null)
        exibirToast(err?.message ?? 'Erro ao excluir.', 'erro')
        setConfirmandoExclusao(false)
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
      setConfirmandoExclusao(false)
    } finally {
      setExcluindo(false)
    }
  }

  // ── Fotos ─────────────────────────────────────────────────
  async function handleAdicionarFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? [])
    e.target.value = ''
    const permitidos = arquivos.filter((f) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        exibirToast(`Arquivo "${f.name}" não permitido. Use JPG, PNG ou WebP.`, 'erro')
        return false
      }
      if (f.size > 2 * 1024 * 1024) {
        exibirToast(`Arquivo "${f.name}" excede 2MB.`, 'erro')
        return false
      }
      return true
    })
    if (!permitidos.length) return
    setAdicionandoFoto(true)
    try {
      for (const arquivo of permitidos) {
        const base64 = await lerArquivoBase64(arquivo)
        const res = await adicionarFotoApi(imovelSel!.id, {
          dadosBase64: base64,
          mimeType: arquivo.type,
          nomeArquivo: arquivo.name,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          exibirToast(err?.message ?? 'Erro ao enviar foto.', 'erro')
        }
      }
      await carregarMidias(imovelSel!.id)
      exibirToast('Foto(s) adicionada(s)!', 'sucesso')
    } catch {
      exibirToast('Erro ao processar imagem.', 'erro')
    } finally {
      setAdicionandoFoto(false)
    }
  }

  async function handleExcluirFoto(foto: Foto) {
    if (!imovelSel) return
    try {
      const res = await excluirFotoApi(foto.id)
      if (res.ok) {
        await carregarMidias(imovelSel.id)
        setFotoIdx((idx) => Math.max(0, idx - 1))
        exibirToast('Foto excluída.', 'sucesso')
      } else {
        exibirToast('Erro ao excluir foto.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    }
  }

  // ── Vídeos ────────────────────────────────────────────────
  async function handleAdicionarVideo() {
    if (!isYoutubeUrl(urlVideo)) {
      setErroVideo('URL inválida. Use youtube.com ou youtu.be.')
      return
    }
    setErroVideo('')
    setAdicionandoVideo(true)
    try {
      const res = await adicionarVideoApi(imovelSel!.id, { urlYoutube: urlVideo.trim() })
      if (res.ok) {
        setUrlVideo('')
        await carregarMidias(imovelSel!.id)
        exibirToast('Vídeo adicionado!', 'sucesso')
      } else {
        const err = await res.json().catch(() => null)
        exibirToast(err?.message ?? 'Erro ao adicionar vídeo.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    } finally {
      setAdicionandoVideo(false)
    }
  }

  async function handleExcluirVideo(video: Video) {
    if (!imovelSel) return
    try {
      const res = await excluirVideoApi(video.id)
      if (res.ok) {
        await carregarMidias(imovelSel.id)
        exibirToast('Vídeo excluído.', 'sucesso')
      } else {
        exibirToast('Erro ao excluir vídeo.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    }
  }

  // ── Lista filtrada (client-side) ──────────────────────────
  const imoveisFiltrados = imoveis.filter((im) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      im.codigo.toLowerCase().includes(q) ||
      im.tipo.toLowerCase().includes(q) ||
      (im.regiaoNome ?? '').toLowerCase().includes(q)
    )
  })

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 700,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            backgroundColor:
              toast.tipo === 'sucesso' ? '#14532d' :
              toast.tipo === 'confirm' ? '#1e293b' : '#3B1F1F',
            color:
              toast.tipo === 'sucesso' ? '#4ADE80' :
              toast.tipo === 'confirm' ? '#FACC15' : '#F87171',
            border: `1px solid ${
              toast.tipo === 'sucesso' ? '#166534' :
              toast.tipo === 'confirm' ? '#ca8a04' : '#7f1d1d'
            }`,
          }}
        >
          {toast.tipo === 'sucesso' ? '✓ ' : toast.tipo === 'confirm' ? '⚠ ' : '✕ '}
          {toast.msg}
          {toast.tipo === 'confirm' && (
            <button
              onClick={confirmarExclusao}
              disabled={excluindo}
              style={{
                marginLeft: '8px',
                backgroundColor: '#7f1d1d',
                color: '#F87171',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: excluindo ? 'not-allowed' : 'pointer',
              }}
            >
              {excluindo ? '...' : 'Confirmar'}
            </button>
          )}
          {toast.tipo === 'confirm' && (
            <button
              onClick={() => { setToast(null); setConfirmandoExclusao(false) }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '0 2px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ── Coluna 1: Lista ── */}
      <div
        style={{
          width: '240px',
          flexShrink: 0,
          height: '100%',
          backgroundColor: 'var(--color-green-dark)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header lista */}
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: 'var(--color-white)', fontSize: '14px', fontWeight: 800 }}>Imóveis</span>
            <button
              onClick={novoImovel}
              style={{
                backgroundColor: 'var(--color-blue)',
                color: '#fff',
                border: 'none',
                borderRadius: '7px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Novo
            </button>
          </div>

          {/* Busca */}
          <input
            type="text"
            placeholder="Buscar código, tipo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: 'var(--color-green-mid)',
              color: 'var(--color-white)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '7px',
              padding: '7px 10px',
              fontSize: '12px',
              outline: 'none',
              marginBottom: '8px',
            }}
          />

          {/* Filtro cidade */}
          <select
            value={filtroCidadeId}
            onChange={(e) => setFiltroCidadeId(e.target.value)}
            style={estiloSelectFiltro(!!filtroCidadeId)}
          >
            <option value="">Todas as cidades</option>
            {filtroCidades.map((c) => (
              <option key={c.id} value={String(c.id)} style={{ color: '#fff', backgroundColor: '#374C4B' }}>
                {c.nome}
              </option>
            ))}
          </select>

          {/* Filtro região */}
          <select
            value={filtroRegiaoId}
            onChange={(e) => setFiltroRegiaoId(e.target.value)}
            disabled={!filtroCidadeId}
            style={{ ...estiloSelectFiltro(!!filtroRegiaoId), marginTop: '6px', opacity: filtroCidadeId ? 1 : 0.4 }}
          >
            <option value="">Todas as regiões</option>
            {filtroRegioes.map((r) => (
              <option key={r.id} value={String(r.id)} style={{ color: '#fff', backgroundColor: '#374C4B' }}>
                {r.nome}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const params: { cidadeId?: number; regiaoId?: number } = {}
              if (filtroCidadeId) params.cidadeId = Number(filtroCidadeId)
              if (filtroRegiaoId) params.regiaoId = Number(filtroRegiaoId)
              carregarImoveis(Object.keys(params).length ? params : undefined)
            }}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '7px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: 'rgba(64,166,244,0.15)',
              color: '#40A6F4',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Buscar
          </button>
        </div>

        {/* Lista scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {carregandoLista ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <div style={estiloSpinner} />
            </div>
          ) : imoveisFiltrados.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', padding: '24px 12px', margin: 0 }}>
              Nenhum imóvel encontrado.
            </p>
          ) : (
            imoveisFiltrados.map((im) => {
              const ativo = imovelSel?.id === im.id
              return (
                <div
                  key={im.id}
                  onClick={() => selecionarImovel(im)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    backgroundColor: ativo ? 'rgba(64,166,244,0.1)' : 'transparent',
                    borderLeft: `3px solid ${ativo ? '#40A6F4' : 'transparent'}`,
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: corStatus(im.status),
                    }} />
                    <span style={{ color: 'var(--color-white)', fontSize: '13px', fontWeight: 800 }}>
                      {im.codigo}
                    </span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', margin: '0 0 2px 14px' }}>
                    {im.tipo}{im.regiaoNome ? ` · ${im.regiaoNome}` : ''}
                  </p>
                  <p style={{ color: '#40A6F4', fontSize: '12px', fontWeight: 700, margin: '0 0 0 14px' }}>
                    {formatarPreco(im.preco)}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Coluna 2: Galeria ── */}
      <div
        style={{
          flex: 1,
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-black)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {!imovelSel && !modoNovo ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', fontWeight: 300 }}>
              Selecione um imóvel
            </p>
          </div>
        ) : modoNovo ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
              Salve o imóvel primeiro para adicionar mídias
            </p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {carregandoMidias ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div style={estiloSpinner} />
              </div>
            ) : (
              <>
                {/* ── Carrossel unificado (fotos + vídeos) ── */}
                {(() => {
                  const midias: ({ tipo: 'foto' } & Foto | { tipo: 'video' } & Video)[] = [
                    ...fotos.map((f) => ({ tipo: 'foto' as const, ...f })),
                    ...videos.map((v) => ({ tipo: 'video' as const, ...v })),
                  ]
                  const total = midias.length
                  const atual = midias[fotoIdx]

                  return (
                    <div style={{ marginBottom: '20px' }}>
                      <p style={estiloSecaoTitulo}>Mídias</p>

                      {/* Visualizador principal */}
                      <div
                        style={{
                          height: '260px',
                          backgroundColor: '#000',
                          borderRadius: '10px',
                          position: 'relative',
                          overflow: 'hidden',
                          marginBottom: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {total === 0 ? (
                          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px', margin: 0 }}>Nenhuma mídia</p>
                        ) : atual.tipo === 'foto' ? (
                          <img
                            src={`data:${atual.mimeType};base64,${atual.dadosBase64}`}
                            alt={atual.nomeArquivo}
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <iframe
                            src={`https://www.youtube.com/embed/${getYoutubeId(atual.urlYoutube)}`}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        )}

                        {/* Navegação */}
                        {total > 1 && (
                          <>
                            <button
                              onClick={() => setFotoIdx((i) => (i - 1 + total) % total)}
                              style={estiloNavBtn('left')}
                            >◀</button>
                            <button
                              onClick={() => setFotoIdx((i) => (i + 1) % total)}
                              style={estiloNavBtn('right')}
                            >▶</button>
                          </>
                        )}

                        {/* Contador + tipo */}
                        {total > 0 && (
                          <div style={{
                            position: 'absolute', bottom: '8px', right: '10px',
                            backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff',
                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                            display: 'flex', alignItems: 'center', gap: '5px',
                          }}>
                            {atual.tipo === 'video' && <span style={{ fontSize: '9px', color: '#F87171', fontWeight: 800, letterSpacing: '0.05em' }}>YT</span>}
                            {fotoIdx + 1} / {total}
                          </div>
                        )}

                        {/* Botão excluir item atual */}
                        {total > 0 && (
                          <button
                            onClick={() => {
                              if (atual.tipo === 'foto') handleExcluirFoto(atual)
                              else handleExcluirVideo(atual)
                            }}
                            style={{
                              position: 'absolute', top: '8px', right: '8px',
                              backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff',
                              border: 'none', borderRadius: '6px',
                              width: '24px', height: '24px', fontSize: '11px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Excluir"
                          >✕</button>
                        )}
                      </div>

                      {/* Thumbnails */}
                      {total > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          {midias.map((midia, idx) => {
                            const thumbSrc = midia.tipo === 'foto'
                              ? `data:${midia.mimeType};base64,${midia.dadosBase64}`
                              : getYoutubeThumbnail(midia.urlYoutube) ?? ''
                            return (
                              <div
                                key={`${midia.tipo}-${midia.id}`}
                                onClick={() => setFotoIdx(idx)}
                                style={{
                                  position: 'relative', width: '56px', height: '56px',
                                  borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0,
                                  border: `2px solid ${idx === fotoIdx ? '#40A6F4' : 'transparent'}`,
                                }}
                              >
                                <img
                                  src={thumbSrc}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                {midia.tipo === 'video' && (
                                  <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: 'rgba(0,0,0,0.4)',
                                  }}>
                                    <div style={{
                                      width: '18px', height: '18px', borderRadius: '50%',
                                      backgroundColor: 'rgba(255,255,255,0.9)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '8px solid #000', marginLeft: '2px' }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── Adicionar fotos ── */}
                <div style={{ marginBottom: '12px' }}>
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleAdicionarFotos}
                  />
                  <button
                    onClick={() => fotoInputRef.current?.click()}
                    disabled={adicionandoFoto}
                    style={{
                      width: '100%', padding: '8px', borderRadius: '8px',
                      border: '1px dashed rgba(255,255,255,0.2)', backgroundColor: 'transparent',
                      color: adicionandoFoto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
                      fontSize: '12px', fontWeight: 700,
                      cursor: adicionandoFoto ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {adicionandoFoto ? 'Enviando...' : '+ Adicionar fotos'}
                  </button>
                </div>

                {/* ── Adicionar vídeo ── */}
                <div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="URL do YouTube"
                      value={urlVideo}
                      onChange={(e) => { setUrlVideo(e.target.value); setErroVideo('') }}
                      style={{
                        flex: 1,
                        backgroundColor: 'var(--color-green-dark)',
                        color: 'var(--color-white)',
                        border: `1px solid ${erroVideo ? '#F87171' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '7px', padding: '8px 10px', fontSize: '12px', outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleAdicionarVideo}
                      disabled={adicionandoVideo || !urlVideo.trim()}
                      style={{
                        backgroundColor: 'rgba(64,166,244,0.15)', color: '#40A6F4',
                        border: 'none', borderRadius: '7px', padding: '8px 12px',
                        fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                        cursor: adicionandoVideo || !urlVideo.trim() ? 'not-allowed' : 'pointer',
                        opacity: adicionandoVideo || !urlVideo.trim() ? 0.5 : 1,
                      }}
                    >
                      {adicionandoVideo ? '...' : '+ Vídeo'}
                    </button>
                  </div>
                  {erroVideo && (
                    <p style={{ color: '#F87171', fontSize: '11px', margin: '4px 0 0 0' }}>{erroVideo}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Coluna 3: Formulário ── */}
      <div
        style={{
          width: '310px',
          flexShrink: 0,
          height: '100%',
          backgroundColor: 'var(--color-green-dark)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header formulário */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--color-white)', fontSize: '13px', fontWeight: 800 }}>
            {modoNovo ? 'Novo imóvel' : imovelSel ? `#${imovelSel.codigo}` : '---'}
          </span>
          {!modoNovo && imovelSel && (
            <button
              onClick={pedirExclusao}
              disabled={confirmandoExclusao}
              style={{
                backgroundColor: 'rgba(248,113,113,0.12)',
                color: '#F87171',
                border: 'none',
                borderRadius: '7px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: confirmandoExclusao ? 'not-allowed' : 'pointer',
                opacity: confirmandoExclusao ? 0.5 : 1,
              }}
            >
              Excluir
            </button>
          )}
        </div>

        {/* Campos */}
        {(modoNovo || imovelSel) ? (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Status */}
              <CampoForm label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value, publicarEm: '' }))}
                  style={estiloSelectForm}
                >
                  <option value="ativo" style={estiloOption}>Ativo</option>
                  <option value="pausado" style={estiloOption}>Pausado</option>
                  <option value="inativo" style={estiloOption}>Inativo</option>
                  <option value="agendado" style={estiloOption}>Agendado</option>
                </select>
              </CampoForm>

              {/* Publicar a partir de */}
              {form.status === 'agendado' && (
                <CampoForm label="Publicar a partir de">
                  <input
                    type="datetime-local"
                    value={form.publicarEm}
                    onChange={(e) => setForm((f) => ({ ...f, publicarEm: e.target.value }))}
                    style={estiloInputForm}
                  />
                </CampoForm>
              )}

              {/* Cidade */}
              <CampoForm label="Cidade *">
                <select
                  value={form.cidadeId}
                  onChange={(e) => setForm((f) => ({ ...f, cidadeId: e.target.value, regiaoId: '' }))}
                  style={estiloSelectForm}
                >
                  <option value="" disabled hidden>Selecione</option>
                  {formCidades.map((c) => (
                    <option key={c.id} value={String(c.id)} style={estiloOption}>{c.nome}</option>
                  ))}
                </select>
              </CampoForm>

              {/* Região */}
              <CampoForm label="Região">
                <select
                  value={form.regiaoId}
                  onChange={(e) => setForm((f) => ({ ...f, regiaoId: e.target.value }))}
                  disabled={!form.cidadeId || formRegioes.length === 0}
                  style={{ ...estiloSelectForm, opacity: !form.cidadeId ? 0.4 : 1 }}
                >
                  <option value="">Sem região</option>
                  {formRegioes.map((r) => (
                    <option key={r.id} value={String(r.id)} style={estiloOption}>{r.nome}</option>
                  ))}
                </select>
              </CampoForm>

              {/* Tipo */}
              <CampoForm label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  style={estiloSelectForm}
                >
                  {['Casa', 'Apartamento', 'Sobrado', 'Terreno', 'Comercial'].map((t) => (
                    <option key={t} value={t} style={estiloOption}>{t}</option>
                  ))}
                </select>
              </CampoForm>

              {/* Preço */}
              <CampoForm label="Preço (R$)">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={form.preco}
                  onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
                  placeholder="Ex: 480000"
                  style={estiloInputForm}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </CampoForm>

              {/* Grid 2 colunas: Quartos + Banheiros */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <CampoForm label="Quartos">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={form.quartos}
                    onChange={(e) => setForm((f) => ({ ...f, quartos: e.target.value }))}
                    style={estiloInputForm}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                </CampoForm>
                <CampoForm label="Banheiros">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={form.banheiros}
                    onChange={(e) => setForm((f) => ({ ...f, banheiros: e.target.value }))}
                    style={estiloInputForm}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                </CampoForm>
              </div>

              {/* Grid 2 colunas: Área + Vagas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <CampoForm label="Área m²">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.areaM2}
                    onChange={(e) => setForm((f) => ({ ...f, areaM2: e.target.value }))}
                    placeholder="Ex: 120.5"
                    style={estiloInputForm}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                </CampoForm>
                <CampoForm label="Vagas">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.vagas}
                    onChange={(e) => setForm((f) => ({ ...f, vagas: e.target.value }))}
                    style={estiloInputForm}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                </CampoForm>
              </div>

              {/* Endereço */}
              <CampoForm label="Endereço *">
                <input
                  type="text"
                  value={form.endereco}
                  onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                  placeholder="Ex: Rua das Flores, 123"
                  style={estiloInputForm}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </CampoForm>

              {/* Descrição */}
              <CampoForm label="Descrição">
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descrição opcional..."
                  rows={4}
                  style={{
                    ...estiloInputForm,
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-blue)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                />
              </CampoForm>
            </div>

            {/* Rodapé botões */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <button
                onClick={cancelar}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: 'var(--color-green-mid)',
                  color: 'var(--color-white)',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  backgroundColor: 'var(--color-blue)',
                  color: '#fff',
                  opacity: salvando ? 0.5 : 1,
                }}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>
              Selecione ou crie um imóvel
            </p>
          </div>
        )}
      </div>

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Estilos reutilizáveis ──────────────────────────────────
const estiloSpinner: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: '3px solid rgba(64,166,244,0.2)',
  borderTopColor: '#40A6F4',
  animation: 'spin 0.8s linear infinite',
}

const estiloSecaoTitulo: React.CSSProperties = {
  color: 'rgba(255,255,255,0.4)',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 10px 0',
}

const estiloInputForm: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-green-mid)',
  color: 'var(--color-white)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  outline: 'none',
}

const estiloSelectForm: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-green-mid)',
  color: 'var(--color-white)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  fontWeight: 700,
  outline: 'none',
  cursor: 'pointer',
}

const estiloOption: React.CSSProperties = {
  color: '#fff',
  backgroundColor: '#374C4B',
}

function estiloSelectFiltro(temValor: boolean): React.CSSProperties {
  return {
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-green-mid)',
    color: temValor ? 'var(--color-white)' : 'rgba(255,255,255,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '7px',
    padding: '7px 10px',
    fontSize: '12px',
    fontWeight: 700,
    outline: 'none',
    cursor: 'pointer',
  }
}

function estiloNavBtn(lado: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [lado]: '8px',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    width: '28px',
    height: '28px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  }
}

// ── Componente CampoForm ───────────────────────────────────
function CampoForm({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          color: 'var(--color-white)',
          fontSize: '12px',
          fontWeight: 700,
          marginBottom: '5px',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}
