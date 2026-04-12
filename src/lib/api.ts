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
