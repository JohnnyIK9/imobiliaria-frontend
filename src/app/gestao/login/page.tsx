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
    if (carregando || segundosRestantes > 0) return
    setErro('')
    setCarregando(true)

    try {
      const res = await loginApi(email, senha)

      if (res.ok) {
        router.push('/gestao')
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-black)', fontFamily: "'IM Fell English', serif" }}>
      <div className="w-full max-w-sm">
        {/* Card do formulário */}
        <div
          className="p-8"
          style={{ backgroundColor: 'var(--paper, #f4f1e6)', borderTop: '3px solid var(--gold, #c49818)' }}
        >
        {/* Logo / Nome */}
        <div className="text-center mb-8">
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--ink, #1b3a2f)',
            border: '1px solid var(--gold, #c49818)',
            padding: '6px 32px',
            marginBottom: '16px',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/svg/white-02.svg" alt="Logo" style={{ width: '64px', height: '64px', objectFit: 'contain' }} />
          </div>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sepia, #7a9e88)', marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }}>
            Área Administrativa
          </p>
          <h1 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.1, fontFamily: "'Playfair Display', serif", margin: 0 }}>
            <span style={{ color: 'var(--ink, #1b3a2f)' }}>do </span>
            <span style={{ color: 'var(--gold, #c49818)', fontStyle: 'italic' }}>Professor</span>
          </h1>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 20px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
            <span style={{ color: 'var(--gold, #c49818)', fontSize: '10px' }}>◆</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink, #1b3a2f)' }}>
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
                  backgroundColor: 'var(--paper-2, #eae6d4)',
                  color: 'var(--ink, #1b3a2f)',
                  border: '1px solid var(--paper-3, #dddac8)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold, #c49818)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink, #1b3a2f)' }}>
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
                  backgroundColor: 'var(--paper-2, #eae6d4)',
                  color: 'var(--ink, #1b3a2f)',
                  border: '1px solid var(--paper-3, #dddac8)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold, #c49818)')}
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
              className="w-full py-2.5 text-sm font-bold mt-2"
              style={{
                backgroundColor: 'var(--ink, #1b3a2f)',
                color: 'var(--gold, #c49818)',
                border: '1px solid var(--gold, #c49818)',
                opacity: carregando || bloqueado ? 0.5 : 1,
                cursor: carregando || bloqueado ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (carregando || bloqueado) return
                e.currentTarget.style.backgroundColor = 'var(--gold, #c49818)'
                e.currentTarget.style.color = 'var(--ink, #1b3a2f)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--ink, #1b3a2f)'
                e.currentTarget.style.color = 'var(--gold, #c49818)'
              }}
            >
              {carregando ? 'Entrando...' : bloqueado ? `Aguarde ${formatarContagem(segundosRestantes)}` : 'Entrar'}
            </button>
          </form>

          {/* Link de volta ao site */}
          <p className="text-center mt-6 text-sm font-light">
            <a
              href="/"
              className="hover:underline transition-colors"
              style={{ color: 'var(--sepia, #7a9e88)' }}
            >
              ← Voltar ao site
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
