const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function loginApi(email: string, senha: string) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, senha }),
  })
  return res
}

export async function getMeApi() {
  const res = await fetch(`${API_URL}/api/auth/me`, {
    credentials: 'include',
  })
  return res
}

export async function getStatsApi() {
  const res = await fetch(`${API_URL}/api/admin/stats`, {
    credentials: 'include',
  })
  return res
}

export async function getEstadosApi() {
  const res = await fetch(`${API_URL}/api/estados`, { credentials: 'include' })
  return res
}

export async function getCidadesApi(estadoId?: string) {
  const url = estadoId
    ? `${API_URL}/api/admin/cidades?estadoId=${estadoId}`
    : `${API_URL}/api/admin/cidades`
  const res = await fetch(url, { credentials: 'include' })
  return res
}

export async function getRegioesPorCidadeApi(cidadeId: number) {
  const res = await fetch(`${API_URL}/api/admin/regioes?cidade_id=${cidadeId}`, { credentials: 'include' })
  return res
}

export async function criarCidadeApi(dados: {
  nome: string
  estadoId: string
  prefixo: string
  latCentro: number
  lngCentro: number
  zoomPadrao: number
  ativa: boolean
}) {
  const res = await fetch(`${API_URL}/api/admin/cidades`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dados),
  })
  return res
}

export async function editarCidadeApi(id: number, dados: {
  nome: string
  estadoId: string
  prefixo: string
  latCentro: number
  lngCentro: number
  zoomPadrao: number
  ativa: boolean
}) {
  const res = await fetch(`${API_URL}/api/admin/cidades/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dados),
  })
  return res
}

export async function criarRegiaoApi(dados: {
  nome: string
  cidadeId: number
  coordenadas: string
}) {
  const res = await fetch(`${API_URL}/api/admin/regioes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dados),
  })
  return res
}

export async function editarRegiaoApi(id: number, dados: {
  nome: string
  cidadeId: number
  coordenadas: string
}) {
  const res = await fetch(`${API_URL}/api/admin/regioes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dados),
  })
  return res
}

export async function excluirRegiaoApi(id: number) {
  const res = await fetch(`${API_URL}/api/admin/regioes/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  return res
}

export async function logoutApi() {
  const res = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  return res
}

export async function getUsuariosApi() {
  const res = await fetch(`${API_URL}/api/admin/usuarios`, {
    credentials: 'include',
  })
  return res
}

export async function criarUsuarioApi(dados: {
  nome: string
  email: string
  senha: string
  papel: 'adm' | 'editor'
  ativo: boolean
}) {
  const res = await fetch(`${API_URL}/api/admin/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dados),
  })
  return res
}

export async function editarUsuarioApi(
  id: number,
  dados: {
    nome: string
    email: string
    senha?: string
    papel: 'adm' | 'editor'
    ativo: boolean
  }
) {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(dados),
  })
  return res
}

export async function desativarUsuarioApi(id: number) {
  const res = await fetch(`${API_URL}/api/admin/usuarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ativo: false }),
  })
  return res
}

// ── Público ────────────────────────────────────────────────
export async function getCidadesPublicasApi() {
  return fetch(`${API_URL}/api/cidades`)
}

export async function getRegioesPorCidadePublicaApi(cidadeId: number) {
  return fetch(`${API_URL}/api/cidades/${cidadeId}/regioes`)
}

export async function getImoveisPublicosApi(params?: {
  cidadeId?: number
  regiaoId?: number
  tipo?: string
  precoMin?: number
  precoMax?: number
  quartos?: number
  vagas?: number
}) {
  const q = new URLSearchParams()
  if (params?.cidadeId) q.set('cidade_id', params.cidadeId.toString())
  if (params?.regiaoId) q.set('regiao_id', params.regiaoId.toString())
  if (params?.tipo) q.set('tipo', params.tipo)
  if (params?.precoMin) q.set('preco_min', params.precoMin.toString())
  if (params?.precoMax) q.set('preco_max', params.precoMax.toString())
  if (params?.quartos) q.set('quartos', params.quartos.toString())
  if (params?.vagas) q.set('vagas', params.vagas.toString())
  const url = `${API_URL}/api/imoveis${q.toString() ? '?' + q.toString() : ''}`
  return fetch(url)
}

// ── Imóveis ────────────────────────────────────────────────
export async function getImoveisAdminApi(params?: { cidadeId?: number; regiaoId?: number }) {
  const query = new URLSearchParams()
  if (params?.cidadeId) query.set('cidade_id', params.cidadeId.toString())
  if (params?.regiaoId) query.set('regiao_id', params.regiaoId.toString())
  const url = `${API_URL}/api/admin/imoveis${query.toString() ? '?' + query.toString() : ''}`
  return fetch(url, { credentials: 'include' })
}

export async function criarImovelApi(dados: {
  status: string; publicarEm?: string | null; cidadeId: number; regiaoId?: number | null
  tipo: string; preco: number; quartos: number; banheiros: number
  areaM2: number; vagas: number; endereco: string; descricao?: string | null
}) {
  return fetch(`${API_URL}/api/admin/imoveis`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(dados),
  })
}

export async function editarImovelApi(id: number, dados: {
  status: string; publicarEm?: string | null; cidadeId: number; regiaoId?: number | null
  tipo: string; preco: number; quartos: number; banheiros: number
  areaM2: number; vagas: number; endereco: string; descricao?: string | null
}) {
  return fetch(`${API_URL}/api/admin/imoveis/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(dados),
  })
}

export async function excluirImovelApi(id: number) {
  return fetch(`${API_URL}/api/admin/imoveis/${id}`, { method: 'DELETE', credentials: 'include' })
}

export async function getMidiasImovelApi(id: number) {
  return fetch(`${API_URL}/api/imoveis/${id}/midias`, { credentials: 'include' })
}

export async function adicionarFotoApi(imovelId: number, dados: { dadosBase64: string; mimeType: string; nomeArquivo: string }) {
  return fetch(`${API_URL}/api/admin/imoveis/${imovelId}/fotos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(dados),
  })
}

export async function excluirFotoApi(fotoId: number) {
  return fetch(`${API_URL}/api/admin/fotos/${fotoId}`, { method: 'DELETE', credentials: 'include' })
}

export async function adicionarVideoApi(imovelId: number, dados: { urlYoutube: string }) {
  return fetch(`${API_URL}/api/admin/imoveis/${imovelId}/videos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(dados),
  })
}

export async function excluirVideoApi(videoId: number) {
  return fetch(`${API_URL}/api/admin/videos/${videoId}`, { method: 'DELETE', credentials: 'include' })
}
