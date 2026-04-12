const API_URL = process.env.NEXT_PUBLIC_API_URL

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
