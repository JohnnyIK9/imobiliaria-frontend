'use client'

import { useEffect, useState, useRef } from 'react'
import { getUsuariosApi, criarUsuarioApi, editarUsuarioApi } from '@/lib/api'

type Usuario = {
  id: number
  nome: string
  email: string
  papel: 'adm' | 'editor'
  ativo: boolean
  ultimoAcesso: string | null
}

type FormData = {
  nome: string
  email: string
  senha: string
  papel: 'adm' | 'editor'
  ativo: boolean
}

const FORM_VAZIO: FormData = { nome: '', email: '', senha: '', papel: 'editor', ativo: true }

function formatarData(data: string | null) {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState<FormData>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState<{ msg: string; tipo: 'sucesso' | 'erro' } | null>(null)
  const [menuAberto, setMenuAberto] = useState<number | null>(null)
  const [alterarSenha, setAlterarSenha] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    carregarUsuarios()
  }, [])

  useEffect(() => {
    function fecharMenu(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(null)
      }
    }
    document.addEventListener('mousedown', fecharMenu)
    return () => document.removeEventListener('mousedown', fecharMenu)
  }, [])

  async function carregarUsuarios() {
    setCarregando(true)
    try {
      const res = await getUsuariosApi()
      if (res.ok) {
        const data = await res.json()
        setUsuarios(data)
      }
    } finally {
      setCarregando(false)
    }
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setAlterarSenha(false)
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', papel: u.papel, ativo: u.ativo })
    setAlterarSenha(false)
    setErro('')
    setModalAberto(true)
    setMenuAberto(null)
  }

  function fecharModal() {
    setModalAberto(false)
    setEditando(null)
    setErro('')
  }

  function exibirToast(msg: string, tipo: 'sucesso' | 'erro') {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    try {
      let res: Response

      if (editando) {
        const dados: Parameters<typeof editarUsuarioApi>[1] = {
          nome: form.nome,
          email: form.email,
          papel: form.papel,
          ativo: form.ativo,
        }
        if (form.senha) dados.senha = form.senha
        res = await editarUsuarioApi(editando.id, dados)
      } else {
        res = await criarUsuarioApi({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          papel: form.papel,
          ativo: form.ativo,
        })
      }

      if (res.ok) {
        exibirToast(editando ? 'Usuário atualizado!' : 'Usuário criado!', 'sucesso')
        fecharModal()
        carregarUsuarios()
      } else if (res.status === 400) {
        const data = await res.json()
        setErro(data.erro || 'Dados inválidos.')
      } else if (res.status === 409) {
        setErro('E-mail já cadastrado.')
      } else {
        setErro('Erro ao salvar. Tente novamente.')
      }
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDesativar(u: Usuario) {
    setMenuAberto(null)
    try {
      const dados = { nome: u.nome, email: u.email, papel: u.papel, ativo: false }
      const res = await editarUsuarioApi(u.id, dados)
      if (res.ok) {
        exibirToast('Usuário desativado.', 'sucesso')
        carregarUsuarios()
      } else if (res.status === 400) {
        exibirToast('Não é possível desativar sua própria conta.', 'erro')
      } else {
        exibirToast('Erro ao desativar.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    }
  }

  async function handleAtivar(u: Usuario) {
    setMenuAberto(null)
    try {
      const dados = { nome: u.nome, email: u.email, papel: u.papel, ativo: true }
      const res = await editarUsuarioApi(u.id, dados)
      if (res.ok) {
        exibirToast('Usuário ativado.', 'sucesso')
        carregarUsuarios()
      } else {
        exibirToast('Erro ao ativar.', 'erro')
      }
    } catch {
      exibirToast('Erro de conexão.', 'erro')
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ fontFamily: "'DM Sans', sans-serif" }}>
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold shadow-lg transition-all"
          style={{
            backgroundColor: toast.tipo === 'sucesso' ? '#14532d' : '#3B1F1F',
            color: toast.tipo === 'sucesso' ? '#4ADE80' : '#F87171',
            border: `1px solid ${toast.tipo === 'sucesso' ? '#166534' : '#7f1d1d'}`,
          }}
        >
          {toast.tipo === 'sucesso' ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'var(--color-white)' }}>
            Usuários
          </h1>
          <p className="mt-1 text-sm font-light" style={{ color: 'var(--color-gray-dark)' }}>
            Gerencie os acessos ao painel
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--gold, #c49818)', color: '#fff' }}
        >
          <span className="text-base leading-none">+</span> Novo usuário
        </button>
      </div>

      {/* Tabela — Desktop */}
      <div className="hidden md:block rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--paper, #f4f1e6)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(27,58,47,0.12)' }}>
              {['Nome', 'E-mail', 'Papel', 'Status', 'Último acesso', ''].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-3.5 font-bold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--sepia, #7a9e88)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(27,58,47,0.08)' }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--paper-3, #dddac8)', width: j === 0 ? '120px' : j === 1 ? '180px' : '80px' }} />
                    </td>
                  ))}
                  <td className="px-5 py-4" />
                </tr>
              ))
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-light" style={{ color: 'var(--sepia, #7a9e88)' }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(27,58,47,0.08)' }}>
                  <td className="px-5 py-4 font-bold" style={{ color: 'var(--ink, #1b3a2f)' }}>{u.nome}</td>
                  <td className="px-5 py-4 font-light" style={{ color: 'rgba(27,58,47,0.7)' }}>{u.email}</td>
                  <td className="px-5 py-4">
                    <PapelBadge papel={u.papel} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge ativo={u.ativo} />
                  </td>
                  <td className="px-5 py-4 font-light text-xs" style={{ color: 'var(--sepia, #7a9e88)' }}>
                    {formatarData(u.ultimoAcesso)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:brightness-110"
                        style={{ backgroundColor: 'var(--paper-3, #dddac8)', color: 'var(--ink, #1b3a2f)' }}
                      >
                        Editar
                      </button>
                      {u.ativo ? (
                        <button
                          onClick={() => handleDesativar(u)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:brightness-110"
                          style={{ backgroundColor: '#3B1F1F', color: '#F87171' }}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAtivar(u)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:brightness-110"
                          style={{ backgroundColor: '#14532d', color: '#4ADE80' }}
                        >
                          Ativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — Mobile */}
      <div className="md:hidden space-y-3" ref={menuRef}>
        {carregando ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--paper, #f4f1e6)' }}>
              <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: 'var(--paper-3, #dddac8)' }} />
              <div className="h-3 w-48 rounded" style={{ backgroundColor: 'var(--paper-3, #dddac8)' }} />
            </div>
          ))
        ) : usuarios.length === 0 ? (
          <p className="text-center py-10 text-sm font-light" style={{ color: 'var(--sepia, #7a9e88)' }}>
            Nenhum usuário encontrado.
          </p>
        ) : (
          usuarios.map((u) => (
            <div key={u.id} className="rounded-xl p-4 relative" style={{ backgroundColor: 'var(--paper, #f4f1e6)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--ink, #1b3a2f)' }}>{u.nome}</p>
                  <p className="text-xs font-light truncate mt-0.5" style={{ color: 'rgba(27,58,47,0.6)' }}>{u.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <PapelBadge papel={u.papel} />
                    <StatusBadge ativo={u.ativo} />
                  </div>
                  <p className="text-xs font-light mt-2" style={{ color: 'var(--sepia, #7a9e88)' }}>
                    Último acesso: {formatarData(u.ultimoAcesso)}
                  </p>
                </div>
                {/* Menu ⋮ */}
                <div className="relative ml-3">
                  <button
                    onClick={() => setMenuAberto(menuAberto === u.id ? null : u.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold leading-none"
                    style={{ color: 'var(--sepia, #7a9e88)', backgroundColor: 'var(--paper-3, #dddac8)' }}
                  >
                    ⋮
                  </button>
                  {menuAberto === u.id && (
                    <div
                      className="absolute right-0 top-10 z-20 rounded-xl shadow-xl overflow-hidden min-w-[130px]"
                      style={{ backgroundColor: 'var(--paper-2, #eae6d4)', border: '1px solid var(--paper-3, #dddac8)' }}
                    >
                      <button
                        onClick={() => abrirEditar(u)}
                        className="w-full text-left px-4 py-3 text-sm font-bold hover:brightness-95 transition-colors"
                        style={{ color: 'var(--ink, #1b3a2f)' }}
                      >
                        Editar
                      </button>
                      {u.ativo ? (
                        <button
                          onClick={() => handleDesativar(u)}
                          className="w-full text-left px-4 py-3 text-sm font-bold hover:brightness-95 transition-colors"
                          style={{ color: '#F87171', borderTop: '1px solid rgba(27,58,47,0.08)' }}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAtivar(u)}
                          className="w-full text-left px-4 py-3 text-sm font-bold hover:brightness-95 transition-colors"
                          style={{ color: '#27ae60', borderTop: '1px solid rgba(27,58,47,0.08)' }}
                        >
                          Ativar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--color-green-dark)' }}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-extrabold" style={{ color: 'var(--color-white)' }}>
                {editando ? 'Editar usuário' : 'Novo usuário'}
              </h2>
              <button
                onClick={fecharModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-lg leading-none transition-colors hover:brightness-125"
                style={{ backgroundColor: 'var(--color-green-mid)', color: 'var(--color-gray-dark)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-4">
              {/* Nome */}
              <CampoTexto
                label="Nome"
                value={form.nome}
                onChange={(v) => setForm({ ...form, nome: v })}
                required
                placeholder="Nome completo"
              />

              {/* E-mail */}
              <CampoTexto
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                required
                placeholder="email@exemplo.com"
              />

              {/* Senha */}
              {editando ? (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        backgroundColor: alterarSenha ? 'var(--gold, #c49818)' : 'var(--color-green-mid)',
                        border: `1.5px solid ${alterarSenha ? 'var(--gold, #c49818)' : 'rgba(255,255,255,0.2)'}`,
                      }}
                    >
                      {alterarSenha && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={alterarSenha}
                      onChange={(e) => {
                        setAlterarSenha(e.target.checked)
                        if (!e.target.checked) setForm({ ...form, senha: '' })
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-bold" style={{ color: 'var(--color-white)' }}>
                      Alterar senha
                    </span>
                  </label>
                  {alterarSenha && (
                    <div className="mt-3">
                      <CampoTexto
                        label="Nova senha"
                        type="password"
                        value={form.senha}
                        onChange={(v) => setForm({ ...form, senha: v })}
                        required
                        placeholder="••••••••"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <CampoTexto
                  label="Senha"
                  type="password"
                  value={form.senha}
                  onChange={(v) => setForm({ ...form, senha: v })}
                  required
                  placeholder="••••••••"
                />
              )}

              {/* Papel + Ativo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-white)' }}>
                    Papel
                  </label>
                  <select
                    value={form.papel}
                    onChange={(e) => setForm({ ...form, papel: e.target.value as 'adm' | 'editor' })}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                    style={{ backgroundColor: 'var(--color-green-mid)', color: 'var(--color-white)', border: '1px solid transparent' }}
                  >
                    <option value="editor">Editor</option>
                    <option value="adm">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-white)' }}>
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ativo: !form.ativo })}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition-colors"
                    style={{ backgroundColor: 'var(--color-green-mid)', color: form.ativo ? '#4ADE80' : '#F87171' }}
                  >
                    <span>{form.ativo ? 'Ativo' : 'Inativo'}</span>
                    <div
                      className="w-9 h-5 rounded-full relative transition-colors"
                      style={{ backgroundColor: form.ativo ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.2)' }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                        style={{
                          backgroundColor: form.ativo ? '#4ADE80' : '#F87171',
                          left: form.ativo ? '18px' : '2px',
                        }}
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <div className="rounded-lg px-4 py-3 text-sm font-light" style={{ backgroundColor: '#3B1F1F', color: '#F87171' }}>
                  {erro}
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors hover:brightness-110"
                  style={{ backgroundColor: 'var(--color-green-mid)', color: 'var(--color-white)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-opacity"
                  style={{ backgroundColor: 'var(--gold, #c49818)', color: '#fff', opacity: salvando ? 0.6 : 1 }}
                >
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  )
}

/* Componentes auxiliares */

function CampoTexto({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--color-white)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all placeholder:font-light"
        style={{ backgroundColor: 'var(--color-green-mid)', color: 'var(--color-white)', border: '1px solid transparent' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold, #c49818)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      />
    </div>
  )
}

function PapelBadge({ papel }: { papel: 'adm' | 'editor' }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold"
      style={{
        backgroundColor: papel === 'adm' ? 'rgba(196,152,24,0.15)' : 'rgba(27,58,47,0.08)',
        color: papel === 'adm' ? 'var(--gold, #c49818)' : 'var(--sepia, #7a9e88)',
      }}
    >
      {papel === 'adm' ? 'Administrador' : 'Editor'}
    </span>
  )
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold">
      <span
        className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: ativo ? '#4ADE80' : '#6B7280' }}
      />
      <span style={{ color: ativo ? '#4ADE80' : '#6B7280' }}>{ativo ? 'Ativo' : 'Inativo'}</span>
    </span>
  )
}
