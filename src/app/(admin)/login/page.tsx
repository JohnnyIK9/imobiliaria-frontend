'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loginApi } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [segundosRestantes, setSegundosRestantes] = useState(0)

  useEffect(() => {
    if (segundosRestantes <= 0) return
    const timer = setTimeout(() => setSegundosRestantes((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [segundosRestantes])

  function formatarContagem(segundos: number) {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0')
    const s = (segundos % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (segundosRestantes > 0) return
    setErro('')
    setCarregando(true)

    try {
      const res = await loginApi(email, senha)

      if (res.ok) {
        router.push('/')
        return
      }

      if (res.status === 429) {
        const data = await res.json()
        setSegundosRestantes(data.bloqueadoPorSegundos)
        setErro(`Muitas tentativas. Tente novamente em ${formatarContagem(data.bloqueadoPorSegundos)}`)
      } else if (res.status === 401) {
        setErro('E-mail ou senha inválidos')
      } else {
        setErro('Erro ao conectar. Tente novamente.')
      }
    } catch {
      setErro('Erro ao conectar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const bloqueado = segundosRestantes > 0

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-black)' }}>
      <div className="w-full max-w-sm">
        {/* Logo / Nome */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
            style={{ backgroundColor: 'var(--color-green-dark)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#40A6F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-white)' }}>
            Imobiliária do Professor
          </h1>
          <p className="mt-1 text-sm font-light" style={{ color: 'var(--color-gray-dark)' }}>
            Painel Administrativo
          </p>
        </div>

        {/* Card do formulário */}
        <div
          className="rounded-2xl p-8"
          style={{ backgroundColor: 'var(--color-green-dark)' }}
        >
          <h2 className="text-lg font-bold mb-6" style={{ color: 'var(--color-white)' }}>
            Entrar na sua conta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-white)' }}>
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@imobiliaria.com"
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all placeholder:font-light"
                style={{
                  backgroundColor: 'var(--color-green-mid)',
                  color: 'var(--color-white)',
                  border: '1px solid transparent',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-blue)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-white)' }}>
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all placeholder:font-light"
                style={{
                  backgroundColor: 'var(--color-green-mid)',
                  color: 'var(--color-white)',
                  border: '1px solid transparent',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-blue)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              />
            </div>

            {/* Mensagem de erro */}
            {erro && (
              <div
                className="rounded-lg px-4 py-3 text-sm font-light"
                style={{ backgroundColor: '#3B1F1F', color: '#F87171' }}
              >
                {bloqueado
                  ? `Tente novamente em ${formatarContagem(segundosRestantes)}`
                  : erro}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={carregando || bloqueado}
              className="w-full rounded-lg py-2.5 text-sm font-bold transition-opacity mt-2"
              style={{
                backgroundColor: 'var(--color-blue)',
                color: 'var(--color-white)',
                opacity: carregando || bloqueado ? 0.5 : 1,
                cursor: carregando || bloqueado ? 'not-allowed' : 'pointer',
              }}
            >
              {carregando ? 'Entrando...' : bloqueado ? `Aguarde ${formatarContagem(segundosRestantes)}` : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Link de volta ao site */}
        <p className="text-center mt-6 text-sm font-light" style={{ color: 'var(--color-gray-dark)' }}>
          <a
            href="/"
            className="hover:underline transition-colors"
            style={{ color: 'var(--color-blue)' }}
          >
            ← Voltar ao site
          </a>
        </p>
      </div>
    </div>
  )
}
