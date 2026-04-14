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
type Estado = { id: string; nome: string }
type CidadeRaw = { id: number; nome: string; estado?: { id: string; nome: string }; estadoId?: string }
type Cidade = { id: number; nome: string; estadoId: string }
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
  fotoCapaSrc: string | null
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
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converte valor em reais (número) → string mascarada "R$ 480.000,00" */
function precoParaMascara(valor: string): string {
  const num = Number(valor) || 0
  return (Math.round(num * 100) / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

/** Extrai apenas dígitos do input mascarado e converte centavos → reais como string */
function mascaraParaPreco(mascara: string): string {
  const digits = mascara.replace(/\D/g, '')
  if (!digits) return ''
  return String(parseInt(digits, 10) / 100)
}

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => { resolve((reader.result as string).split(',')[1]) }
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
  return 'rgba(0,0,0,0.2)'
}

function labelStatus(status: string) {
  if (status === 'ativo') return 'Ativo'
  if (status === 'pausado') return 'Pausado'
  return 'Inativo'
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
  const fotoCapa = raw.fotoCapa as Record<string, unknown> | null
  const fotoCapaSrc = fotoCapa?.dadosBase64
    ? `data:${fotoCapa.mimeType};base64,${fotoCapa.dadosBase64}`
    : null
  const regiaoObj = raw.regiao as Record<string, unknown> | null
  const cidadeObj = raw.cidade as Record<string, unknown> | null
  return {
    id: raw.id as number,
    codigo: (raw.codigo ?? raw.code ?? String(raw.id)) as string,
    status: (raw.status ?? 'inativo') as string,
    publicarEm: (raw.publicarEm ?? raw.publicar_em ?? null) as string | null,
    cidadeId: (raw.cidadeId ?? raw.cidade_id ?? cidadeObj?.id ?? 0) as number,
    regiaoId: (raw.regiaoId ?? raw.regiao_id ?? regiaoObj?.id ?? null) as number | null,
    regiaoNome: (raw.regiaoNome ?? raw.regiao_nome ?? regiaoObj?.nome ?? '') as string,
    tipo: (raw.tipo ?? '') as string,
    preco: (raw.preco ?? 0) as number,
    quartos: (raw.quartos ?? 0) as number,
    banheiros: (raw.banheiros ?? 0) as number,
    areaM2: (raw.areaM2 ?? raw.area_m2 ?? 0) as number,
    vagas: (raw.vagas ?? 0) as number,
    endereco: (raw.endereco ?? '') as string,
    descricao: (raw.descricao ?? null) as string | null,
    fotoCapaSrc,
  }
}

// ── Componente principal ───────────────────────────────────
export default function ImoveisPage() {
  // Header — Estado → Cidade
  const [estados, setEstados] = useState<Estado[]>([])
  const [estadoSel, setEstadoSel] = useState('')
  const [todasCidades, setTodasCidades] = useState<Cidade[]>([])
  const [cidadesFiltradas, setCidadesFiltradas] = useState<Cidade[]>([])
  const [cidadeSel, setCidadeSel] = useState<Cidade | null>(null)

  // Lista
  const [busca, setBusca] = useState('')
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)

  // Seleção
  const [imovelSel, setImovelSel] = useState<Imovel | null>(null)

  // Mídias
  const [fotos, setFotos] = useState<Foto[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [midiaIdx, setMidiaIdx] = useState(0)
  const [carregandoMidias, setCarregandoMidias] = useState(false)
  const [adicionandoFoto, setAdicionandoFoto] = useState(false)
  const [adicionandoVideo, setAdicionandoVideo] = useState(false)
  const [urlVideo, setUrlVideo] = useState('')
  const [erroVideo, setErroVideo] = useState('')
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // Formulário
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [modoNovo, setModoNovo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  // Selects do formulário
  const [formCidades, setFormCidades] = useState<Cidade[]>([])
  const [formRegioes, setFormRegioes] = useState<Regiao[]>([])

  // Toast
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' | 'confirm' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Init ──────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const r = await getCidadesApi()
      if (!r.ok) return
      const raw: CidadeRaw[] = await r.json()
      const lista: Cidade[] = raw.map((c) => ({
        id: c.id,
        nome: c.nome,
        estadoId: c.estado?.id ?? c.estadoId ?? '',
      }))
      setTodasCidades(lista)
      setFormCidades(lista)

      // Derivar estados únicos
      const estadosMap = new Map<string, Estado>()
      raw.forEach((c) => {
        const id = c.estado?.id ?? c.estadoId ?? ''
        const nome = c.estado?.nome ?? id
        if (id) estadosMap.set(id, { id, nome })
      })
      const listaEstados = Array.from(estadosMap.values()).sort((a, b) => a.id.localeCompare(b.id))
      setEstados(listaEstados)

      // Restaura cookie ou cai no primeiro estado/cidade
      const estadoSalvo = localStorage.getItem('imoveis:estado') ?? ''
      const cidadeIdSalvo = Number(localStorage.getItem('imoveis:cidadeId')) || null

      const estadoInicial = listaEstados.find((e) => e.id === estadoSalvo) ?? listaEstados[0] ?? null
      if (!estadoInicial) return

      setEstadoSel(estadoInicial.id)
      const cidades = lista.filter((c) => c.estadoId === estadoInicial.id)
      setCidadesFiltradas(cidades)

      const cidadeInicial = cidades.find((c) => c.id === cidadeIdSalvo) ?? cidades[0] ?? null
      setCidadeSel(cidadeInicial)

      if (cidadeInicial) {
        localStorage.setItem('imoveis:estado', estadoInicial.id)
        localStorage.setItem('imoveis:cidadeId', String(cidadeInicial.id))
        await carregarImoveis({ cidadeId: cidadeInicial.id })
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // ── Header handlers ───────────────────────────────────────
  function handleEstadoChange(estadoId: string) {
    setEstadoSel(estadoId)
    localStorage.setItem('imoveis:estado', estadoId)
    setImovelSel(null)
    setModoNovo(false)
    setForm(FORM_VAZIO)
    const cidades = todasCidades.filter((c) => c.estadoId === estadoId)
    setCidadesFiltradas(cidades)
    const primeira = cidades[0] ?? null
    setCidadeSel(primeira)
    if (primeira) {
      localStorage.setItem('imoveis:cidadeId', String(primeira.id))
      carregarImoveis({ cidadeId: primeira.id })
    } else {
      localStorage.removeItem('imoveis:cidadeId')
      setImoveis([])
    }
  }

  function handleCidadeChange(cidadeId: string) {
    const cidade = cidadesFiltradas.find((c) => c.id === Number(cidadeId)) ?? null
    setCidadeSel(cidade)
    setImovelSel(null)
    setModoNovo(false)
    setForm(FORM_VAZIO)
    if (cidade) {
      localStorage.setItem('imoveis:cidadeId', String(cidade.id))
      carregarImoveis({ cidadeId: cidade.id })
    } else {
      setImoveis([])
    }
  }

  // ── API ───────────────────────────────────────────────────
  async function carregarImoveis(params?: { cidadeId?: number }) {
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
    setMidiaIdx(0)
    try {
      const res = await getMidiasImovelApi(id)
      if (res.ok) {
        const data = await res.json()
        setFotos((data.fotos ?? []).map(normalizarFoto))
        setVideos((data.videos ?? []).map(normalizarVideo))
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
    // Carrega regiões da cidade sem apagar o regiaoId já setado acima
    setFormRegioes([])
    getRegioesPorCidadeApi(imovel.cidadeId).then(async (r) => {
      if (r.ok) setFormRegioes(await r.json())
    })
    carregarMidias(imovel.id)
  }

  // ── Novo imóvel ───────────────────────────────────────────
  function novoImovel() {
    setImovelSel(null)
    setModoNovo(true)
    setForm({ ...FORM_VAZIO, cidadeId: cidadeSel ? String(cidadeSel.id) : '' })
    setFotos([])
    setVideos([])
    setMidiaIdx(0)
    setConfirmandoExclusao(false)
    if (toast) setToast(null)
    // Carrega regiões da cidade selecionada no header
    setFormRegioes([])
    if (cidadeSel) {
      getRegioesPorCidadeApi(cidadeSel.id).then(async (r) => {
        if (r.ok) setFormRegioes(await r.json())
      })
    }
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
        publicarEm: form.publicarEm ? form.publicarEm : null,
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

      const res = modoNovo
        ? await criarImovelApi(payload)
        : await editarImovelApi(imovelSel!.id, payload)

      if (res.ok) {
        const data = await res.json()
        exibirToast(modoNovo ? 'Imóvel criado com sucesso!' : 'Imóvel atualizado!', 'sucesso')
        await carregarImoveis(cidadeSel ? { cidadeId: cidadeSel.id } : undefined)
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
        await carregarImoveis(cidadeSel ? { cidadeId: cidadeSel.id } : undefined)
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
        exibirToast(`"${f.name}" não permitido. Use JPG, PNG ou WebP.`, 'erro')
        return false
      }
      if (f.size > 2 * 1024 * 1024) {
        exibirToast(`"${f.name}" excede 2MB.`, 'erro')
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
    const res = await excluirFotoApi(foto.id)
    if (res.ok) {
      await carregarMidias(imovelSel.id)
      setMidiaIdx((i) => Math.max(0, i - 1))
      exibirToast('Foto excluída.', 'sucesso')
    } else {
      exibirToast('Erro ao excluir foto.', 'erro')
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
    const res = await excluirVideoApi(video.id)
    if (res.ok) {
      await carregarMidias(imovelSel.id)
      exibirToast('Vídeo excluído.', 'sucesso')
    } else {
      exibirToast('Erro ao excluir vídeo.', 'erro')
    }
  }

  // ── Lista filtrada ────────────────────────────────────────
  const imoveisFiltrados = imoveis.filter((im) => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      im.codigo.toLowerCase().includes(q) ||
      im.tipo.toLowerCase().includes(q) ||
      (im.regiaoNome ?? '').toLowerCase().includes(q) ||
      im.endereco.toLowerCase().includes(q)
    )
  })

  // ── Mídias unificadas ─────────────────────────────────────
  const midias: ({ tipo: 'foto' } & Foto | { tipo: 'video' } & Video)[] = [
    ...fotos.map((f) => ({ tipo: 'foto' as const, ...f })),
    ...videos.map((v) => ({ tipo: 'video' as const, ...v })),
  ]
  const totalMidias = midias.length
  const midiaAtual = midias[midiaIdx]

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Toast ── */}
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
            boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
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
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '14px', cursor: 'pointer', padding: '0 2px' }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <header
        style={{
          backgroundColor: 'var(--ink, #1b3a2f)',
          borderBottom: '3px solid var(--gold, #c49818)',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <h1 style={{ color: '#ffffff', fontSize: '16px', fontWeight: 800, margin: 0, fontFamily: "'Playfair Display', serif" }}>
          Imóveis
        </h1>

        {/* Estado → Cidade — centralizado */}
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {/* Estado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ color: 'var(--gold, #c49818)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Estado
            </span>
            <div style={{ position: 'relative' }}>
              <select
                value={estadoSel}
                onChange={(e) => handleEstadoChange(e.target.value)}
                style={estiloSelectHeader}
              >
                {estados.map((est) => (
                  <option key={est.id} value={est.id} style={{ backgroundColor: '#1b3a2f', color: '#f4f1e6' }}>
                    {est.nome}
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
                value={cidadeSel?.id ?? ''}
                onChange={(e) => handleCidadeChange(e.target.value)}
                style={{ ...estiloSelectHeader, width: '200px' }}
              >
                {cidadesFiltradas.map((c) => (
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

          {/* Botão novo — ao lado de Cidade */}
          <button
            onClick={novoImovel}
            style={{
              backgroundColor: 'var(--ink, #1b3a2f)',
              color: 'var(--gold, #c49818)',
              border: '1px solid var(--gold, #c49818)',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginTop: '11px',
            }}
          >
            + Novo
          </button>
        </div>
      </header>

      {/* ── Corpo ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Painel lateral (lista) ── */}
        <div
          style={{
            width: '390px',
            flexShrink: 0,
            height: '100%',
            paddingLeft: '14px',
            backgroundColor: 'var(--paper, #f4f1e6)',
            borderRight: '2px solid var(--gold, #c49818)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Busca */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--paper-3, #dddac8)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sepia, #7a9e88)" strokeWidth="2" strokeLinecap="round"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar código, tipo, região..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  backgroundColor: 'var(--paper-2, #eae6d4)',
                  color: 'var(--ink, #1b3a2f)',
                  border: '1px solid var(--paper-3, #dddac8)',
                  borderRadius: '8px',
                  padding: '9px 10px 9px 32px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Contador */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--paper-3, #dddac8)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: 'var(--ink, #1b3a2f)', fontSize: '15px', fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>
              Imóveis
            </span>
            <span style={{ color: 'var(--sepia, #7a9e88)', fontSize: '11px' }}>
              {imoveisFiltrados.length} encontrado{imoveisFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Cards */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {carregandoLista ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <div style={estiloSpinner} />
              </div>
            ) : imoveisFiltrados.length === 0 ? (
              <p style={{ color: 'var(--sepia, #7a9e88)', fontSize: '13px', textAlign: 'center', padding: '40px 16px', margin: 0 }}>
                Nenhum imóvel encontrado.
              </p>
            ) : (
              imoveisFiltrados.map((im) => (
                <CardAdmin
                  key={im.id}
                  imovel={im}
                  selecionado={(imovelSel?.id === im.id && !modoNovo) || false}
                  onClick={() => selecionarImovel(im)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Área principal ── */}
        <div
          style={{
            flex: 1,
            height: '100%',
            backgroundColor: 'var(--paper-2, #eae6d4)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Estado vazio */}
          {!imovelSel && !modoNovo && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px' }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--paper-3, #dddac8)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <p style={{ color: 'var(--sepia, #7a9e88)', fontSize: '14px', margin: 0, fontWeight: 500 }}>
                Selecione um imóvel ou crie um novo
              </p>
            </div>
          )}

          {/* Conteúdo (galeria + form unificados) */}
          {(imovelSel || modoNovo) && (
            <>
              {/* ── Header fixo ── */}
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--paper-3, #dddac8)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--paper, #f4f1e6)',
                }}
              >
                <span style={{ color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700 }}>
                  {modoNovo ? 'Novo imóvel' : `Imóvel #${imovelSel?.codigo}`}
                </span>
                {!modoNovo && imovelSel && (
                  <button
                    onClick={pedirExclusao}
                    disabled={confirmandoExclusao}
                    style={{
                      backgroundColor: 'rgba(248,113,113,0.1)', color: '#F87171',
                      border: '1px solid rgba(248,113,113,0.3)', borderRadius: '7px',
                      padding: '6px 12px', fontSize: '12px', fontWeight: 700,
                      cursor: confirmandoExclusao ? 'not-allowed' : 'pointer',
                      opacity: confirmandoExclusao ? 0.5 : 1,
                    }}
                  >
                    Excluir
                  </button>
                )}
              </div>

              {/* ── Área scrollável: galeria + separador + campos ── */}
              <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* Galeria */}
                {imovelSel && !modoNovo && (
                  <div style={{ padding: '16px 20px' }}>
                    {carregandoMidias ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                        <div style={estiloSpinner} />
                      </div>
                    ) : (
                      <>
                        {/* Carrossel principal */}
                        <div
                          style={{
                            height: '240px', backgroundColor: '#111', borderRadius: '10px',
                            position: 'relative', overflow: 'hidden', marginBottom: '10px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {totalMidias === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                              </svg>
                              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px', margin: 0 }}>Nenhuma mídia</p>
                            </div>
                          ) : midiaAtual.tipo === 'foto' ? (
                            <img
                              src={`data:${midiaAtual.mimeType};base64,${midiaAtual.dadosBase64}`}
                              alt={midiaAtual.nomeArquivo}
                              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <iframe
                              src={`https://www.youtube.com/embed/${getYoutubeId(midiaAtual.urlYoutube)}`}
                              style={{ width: '100%', height: '100%', border: 'none' }}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          )}
                          {totalMidias > 1 && (
                            <>
                              <button onClick={() => setMidiaIdx((i) => (i - 1 + totalMidias) % totalMidias)} style={estiloNavBtn('left')}>◀</button>
                              <button onClick={() => setMidiaIdx((i) => (i + 1) % totalMidias)} style={estiloNavBtn('right')}>▶</button>
                            </>
                          )}
                          {totalMidias > 0 && (
                            <div style={{
                              position: 'absolute', bottom: '8px', right: '10px',
                              backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff',
                              fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                            }}>
                              {midiaAtual.tipo === 'video' && <span style={{ fontSize: '9px', color: '#F87171', marginRight: '4px' }}>YT</span>}
                              {midiaIdx + 1} / {totalMidias}
                            </div>
                          )}
                          {totalMidias > 0 && (
                            <button
                              onClick={() => {
                                if (midiaAtual.tipo === 'foto') handleExcluirFoto(midiaAtual)
                                else handleExcluirVideo(midiaAtual)
                              }}
                              style={{
                                position: 'absolute', top: '8px', right: '8px',
                                backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff',
                                border: 'none', borderRadius: '6px',
                                width: '26px', height: '26px', fontSize: '11px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              title="Excluir mídia"
                            >✕</button>
                          )}
                        </div>

                        {/* Thumbnails */}
                        {totalMidias > 0 && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {midias.map((midia, idx) => {
                              const thumbSrc = midia.tipo === 'foto'
                                ? `data:${midia.mimeType};base64,${midia.dadosBase64}`
                                : getYoutubeThumbnail(midia.urlYoutube) ?? ''
                              return (
                                <div
                                  key={`${midia.tipo}-${midia.id}`}
                                  onClick={() => setMidiaIdx(idx)}
                                  style={{
                                    position: 'relative', width: '52px', height: '52px',
                                    borderRadius: '6px', overflow: 'hidden', cursor: 'pointer',
                                    border: `2px solid ${idx === midiaIdx ? '#c49818' : 'transparent'}`,
                                    flexShrink: 0,
                                  }}
                                >
                                  <img src={thumbSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  {midia.tipo === 'video' && (
                                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '7px solid #000', marginLeft: '2px' }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Adicionar foto + vídeo */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input ref={fotoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleAdicionarFotos} />
                          <button
                            onClick={() => fotoInputRef.current?.click()}
                            disabled={adicionandoFoto}
                            style={{
                              flex: 1, padding: '8px', borderRadius: '8px',
                              border: '1px dashed var(--paper-3, #dddac8)', backgroundColor: 'transparent',
                              color: adicionandoFoto ? 'var(--sepia)' : 'var(--ink, #1b3a2f)',
                              fontSize: '12px', fontWeight: 700,
                              cursor: adicionandoFoto ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {adicionandoFoto ? 'Enviando...' : '+ Fotos'}
                          </button>
                          <div style={{ flex: 2, display: 'flex', gap: '6px' }}>
                            <input
                              type="text" placeholder="URL YouTube" value={urlVideo}
                              onChange={(e) => { setUrlVideo(e.target.value); setErroVideo('') }}
                              style={{
                                flex: 1, backgroundColor: 'var(--paper-2, #eae6d4)', color: 'var(--ink, #1b3a2f)',
                                border: `1px solid ${erroVideo ? '#F87171' : 'var(--paper-3, #dddac8)'}`,
                                borderRadius: '7px', padding: '8px 10px', fontSize: '12px', outline: 'none',
                              }}
                            />
                            <button
                              onClick={handleAdicionarVideo}
                              disabled={adicionandoVideo || !urlVideo.trim()}
                              style={{
                                backgroundColor: 'var(--ink, #1b3a2f)', color: 'var(--gold, #c49818)',
                                border: '1px solid var(--gold, #c49818)', borderRadius: '7px',
                                padding: '8px 12px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                                cursor: adicionandoVideo || !urlVideo.trim() ? 'not-allowed' : 'pointer',
                                opacity: adicionandoVideo || !urlVideo.trim() ? 0.5 : 1,
                              }}
                            >
                              {adicionandoVideo ? '...' : '+ Vídeo'}
                            </button>
                          </div>
                        </div>
                        {erroVideo && <p style={{ color: '#F87171', fontSize: '11px', margin: '4px 0 0 0' }}>{erroVideo}</p>}
                      </>
                    )}
                  </div>
                )}

                {/* Aviso novo imóvel */}
                {modoNovo && (
                  <div style={{ padding: '14px 20px' }}>
                    <p style={{ color: 'var(--sepia, #7a9e88)', fontSize: '12px', margin: 0, fontStyle: 'italic' }}>
                      📷 Salve o imóvel primeiro para adicionar fotos e vídeos.
                    </p>
                  </div>
                )}

                {/* ── Separador ornamental ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 20px 20px' }}>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
                  <span style={{ color: 'var(--gold, #c49818)', fontSize: '10px' }}>◆</span>
                  <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
                </div>

                {/* ── Campos do formulário ── */}
                <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Status + Publicar em */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <CampoForm label="Status">
                      <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        style={estiloSelectForm}
                      >
                        <option value="ativo" style={estiloOption}>Ativo</option>
                        <option value="pausado" style={estiloOption}>Pausado</option>
                        <option value="inativo" style={estiloOption}>Inativo</option>
                      </select>
                    </CampoForm>
                    <CampoForm label="Publicar a partir de">
                      <input
                        type="datetime-local" value={form.publicarEm}
                        onChange={(e) => setForm((f) => ({ ...f, publicarEm: e.target.value }))}
                        style={estiloInputForm}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)' }}
                      />
                    </CampoForm>
                  </div>
                  {form.status === 'ativo' && (
                    <p style={{ margin: '-8px 0 0', fontSize: '11px', color: 'var(--sepia, #7a9e88)', fontStyle: 'italic' }}>
                      {form.publicarEm
                        ? `Aparece no site a partir de ${new Date(form.publicarEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`
                        : 'Sem data → aparece imediatamente no site'}
                    </p>
                  )}

                  {/* Cidade + Região */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <CampoForm label="Cidade *">
                      <select
                        value={form.cidadeId}
                        onChange={(e) => {
                          const cidadeId = e.target.value
                          setForm((f) => ({ ...f, cidadeId, regiaoId: '' }))
                          setFormRegioes([])
                          if (cidadeId) {
                            getRegioesPorCidadeApi(Number(cidadeId)).then(async (r) => {
                              if (r.ok) setFormRegioes(await r.json())
                            })
                          }
                        }}
                        style={estiloSelectForm}
                      >
                        <option value="" disabled hidden>Selecione</option>
                        {formCidades.map((c) => (
                          <option key={c.id} value={String(c.id)} style={estiloOption}>{c.nome}</option>
                        ))}
                      </select>
                    </CampoForm>
                    <CampoForm label="Região">
                      <select
                        value={form.regiaoId}
                        onChange={(e) => setForm((f) => ({ ...f, regiaoId: e.target.value }))}
                        disabled={!form.cidadeId || formRegioes.length === 0}
                        style={{ ...estiloSelectForm, opacity: !form.cidadeId ? 0.5 : 1 }}
                      >
                        <option value="">Sem região</option>
                        {formRegioes.map((r) => (
                          <option key={r.id} value={String(r.id)} style={estiloOption}>{r.nome}</option>
                        ))}
                      </select>
                    </CampoForm>
                  </div>

                  {/* Tipo */}
                  <CampoForm label="Tipo">
                    <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} style={estiloSelectForm}>
                      {['Casa', 'Apartamento', 'Sobrado', 'Terreno', 'Comercial'].map((t) => (
                        <option key={t} value={t} style={estiloOption}>{t}</option>
                      ))}
                    </select>
                  </CampoForm>

                  {/* Preço */}
                  <CampoForm label="Preço">
                    <input
                      type="text" inputMode="numeric"
                      value={form.preco ? precoParaMascara(form.preco) : ''}
                      onChange={(e) => setForm((f) => ({ ...f, preco: mascaraParaPreco(e.target.value) }))}
                      placeholder="R$ 0,00" style={estiloInputForm}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)' }}
                    />
                  </CampoForm>

                  {/* Quartos + Banheiros + Área + Vagas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    {([
                      { label: 'Quartos', key: 'quartos', max: 20 },
                      { label: 'Banheiros', key: 'banheiros', max: 20 },
                      { label: 'Área m²', key: 'areaM2', max: undefined, step: 0.1, placeholder: '120' },
                      { label: 'Vagas', key: 'vagas', max: 10 },
                    ] as { label: string; key: keyof FormState; max?: number; step?: number; placeholder?: string }[]).map(({ label, key, max, step, placeholder }) => (
                      <CampoForm key={key} label={label}>
                        <input
                          type="number" min="0" max={max} step={step}
                          value={form[key] as string}
                          placeholder={placeholder}
                          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                          style={estiloInputForm}
                          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)' }}
                        />
                      </CampoForm>
                    ))}
                  </div>

                  {/* Endereço */}
                  <CampoForm label="Endereço *">
                    <input
                      type="text" value={form.endereco}
                      onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
                      placeholder="Ex: Rua das Flores, 123" style={estiloInputForm}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)' }}
                    />
                  </CampoForm>

                  {/* Descrição */}
                  <CampoForm label="Descrição">
                    <textarea
                      value={form.descricao}
                      onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                      placeholder="Descrição opcional..." rows={4}
                      style={{ ...estiloInputForm, resize: 'vertical', minHeight: '88px', fontFamily: 'inherit' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)' }}
                    />
                  </CampoForm>
                </div>
              </div>

              {/* ── Rodapé fixo ── */}
              <div
                style={{
                  padding: '14px 20px', borderTop: '1px solid var(--paper-3, #dddac8)',
                  display: 'flex', gap: '10px', flexShrink: 0,
                  backgroundColor: 'var(--paper, #f4f1e6)',
                }}
              >
                <button
                  onClick={cancelar}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--paper-3, #dddac8)',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    backgroundColor: 'var(--paper-3, #dddac8)', color: 'var(--ink, #1b3a2f)',
                  }}
                >Cancelar</button>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  style={{
                    flex: 2, padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--gold, #c49818)',
                    fontSize: '13px', fontWeight: 700,
                    cursor: salvando ? 'not-allowed' : 'pointer',
                    backgroundColor: 'var(--ink, #1b3a2f)', color: 'var(--gold, #c49818)',
                    opacity: salvando ? 0.6 : 1,
                  }}
                >{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── CardAdmin ──────────────────────────────────────────────
function CardAdmin({
  imovel,
  selecionado,
  onClick,
}: {
  imovel: Imovel
  selecionado: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        margin: '0 10px 8px',
        backgroundColor: selecionado ? 'rgba(196,152,24,0.08)' : 'var(--paper-2, #eae6d4)',
        borderRadius: '10px',
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        border: `1.5px solid ${selecionado ? 'var(--gold, #c49818)' : 'var(--paper-3, #dddac8)'}`,
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseOver={(e) => { if (!selecionado) e.currentTarget.style.borderColor = 'var(--gold, #c49818)' }}
      onMouseOut={(e) => { if (!selecionado) e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)' }}
    >
      {/* Foto capa */}
      <div
        style={{
          position: 'relative',
          width: '96px',
          minHeight: '96px',
          flexShrink: 0,
          backgroundColor: 'var(--paper-3, #dddac8)',
        }}
      >
        {imovel.fotoCapaSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imovel.fotoCapaSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
        )}
        {/* Badge tipo */}
        <span
          style={{
            position: 'absolute', bottom: '5px', left: '5px',
            backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff',
            fontSize: '9px', fontWeight: 800, padding: '1px 6px',
            borderRadius: '3px', letterSpacing: '0.06em', textTransform: 'uppercase',
          }}
        >
          {imovel.tipo}
        </span>
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px', flex: 1, minWidth: 0 }}>
        {/* Preço + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <p style={{ color: 'var(--gold, #c49818)', fontSize: '15px', fontWeight: 800, margin: 0 }}>
            {formatarPreco(imovel.preco)}
          </p>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--sepia, #7a9e88)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: corStatus(imovel.status), flexShrink: 0 }} />
            {labelStatus(imovel.status)}
          </span>
        </div>

        {/* Região / tipo */}
        <p style={{ color: 'var(--ink, #1b3a2f)', fontSize: '13px', fontWeight: 700, margin: '0 0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {imovel.regiaoNome ? `${imovel.regiaoNome} — ` : ''}{imovel.tipo}
        </p>

        {/* Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {imovel.quartos > 0 && <span style={estiloBadge}>{imovel.quartos} qtos</span>}
          {imovel.banheiros > 0 && <span style={estiloBadge}>{imovel.banheiros} bnh</span>}
          {imovel.vagas > 0 && <span style={estiloBadge}>{imovel.vagas} vagas</span>}
          {imovel.areaM2 > 0 && <span style={estiloBadge}>{imovel.areaM2} m²</span>}
        </div>

        {/* Código */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {imovel.regiaoNome && (
            <span style={{ color: 'var(--gold, #c49818)', fontSize: '10px', fontWeight: 700 }}>
              <span style={{ fontSize: '8px' }}>◆</span> {imovel.regiaoNome.toUpperCase()}
            </span>
          )}
          {imovel.regiaoNome && <span style={{ color: 'var(--paper-3, #dddac8)', fontSize: '10px' }}>·</span>}
          <span style={{ color: 'var(--ink, #1b3a2f)', fontSize: '10px', fontWeight: 800 }}>{imovel.codigo}</span>
        </div>
      </div>
    </div>
  )
}

// ── Estilos reutilizáveis ──────────────────────────────────
const estiloSpinner: React.CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: '3px solid rgba(196,152,24,0.2)',
  borderTopColor: '#c49818',
  animation: 'spin 0.8s linear infinite',
}

const estiloInputForm: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--paper-2, #eae6d4)',
  color: 'var(--ink, #1b3a2f)',
  border: '1px solid var(--paper-3, #dddac8)',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  outline: 'none',
}

const estiloSelectForm: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--paper-2, #eae6d4)',
  color: 'var(--ink, #1b3a2f)',
  border: '1px solid var(--paper-3, #dddac8)',
  borderRadius: '8px',
  padding: '8px 10px',
  fontSize: '13px',
  fontWeight: 700,
  outline: 'none',
  cursor: 'pointer',
}

const estiloOption: React.CSSProperties = {
  color: 'var(--ink, #1b3a2f)',
  backgroundColor: 'var(--paper-2, #eae6d4)',
}

const estiloSelectHeader: React.CSSProperties = {
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

const estiloBadge: React.CSSProperties = {
  backgroundColor: 'var(--paper-3, #dddac8)',
  color: 'var(--ink, #1b3a2f)',
  fontSize: '11px',
  fontWeight: 600,
  padding: '2px 7px',
  borderRadius: '5px',
  border: '1px solid rgba(0,0,0,0.08)',
}

function estiloNavBtn(lado: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [lado]: '8px',
    transform: 'translateY(-50%)',
    backgroundColor: 'rgba(0,0,0,0.55)',
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

// ── CampoForm ──────────────────────────────────────────────
function CampoForm({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', color: 'var(--ink, #1b3a2f)', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
