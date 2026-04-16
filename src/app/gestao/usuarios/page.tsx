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

      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6 pb-6" style={{ borderBottom: '1px solid var(--gold, #c49818)' }}>
        <div>
          <h1 className="font-extrabold" style={{ fontSize: '36px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
            Usuários
          </h1>
          <p className="font-bold mt-2" style={{ fontSize: '18px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
            Gerencie os acessos ao painel
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--ink, #1b3a2f)', color: 'var(--gold, #c49818)', border: '1px solid var(--gold, #c49818)', borderRadius: '8px' }}
        >
          <span className="text-base leading-none">+</span> Novo usuário
        </button>
      </div>

      {/* Tabela — Desktop */}
      <div
        className="hidden md:block overflow-hidden"
        style={{ border: '1px solid var(--gold, #c49818)', borderRadius: '12px' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--gold, #c49818)', backgroundColor: 'var(--paper-2, #eae6d4)' }}>
              {['Nome', 'E-mail', 'Papel', 'Status', 'Último acesso', ''].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-3.5 font-bold text-xs uppercase tracking-wide"
                  style={{ color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ backgroundColor: 'var(--paper, #f4f1e6)' }}>
            {carregando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--paper-3, #dddac8)' }}>
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
                <td colSpan={6} className="px-5 py-10 text-center text-sm font-bold" style={{ color: 'var(--ink, #1b3a2f)' }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--paper-3, #dddac8)' }}>
                  <td className="px-5 py-4 font-bold" style={{ color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>{u.nome}</td>
                  <td className="px-5 py-4 font-bold" style={{ color: 'var(--ink, #1b3a2f)' }}>{u.email}</td>
                  <td className="px-5 py-4">
                    <PapelBadge papel={u.papel} />
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge ativo={u.ativo} />
                  </td>
                  <td className="px-5 py-4 font-bold text-xs" style={{ color: 'var(--ink, #1b3a2f)' }}>
                    {formatarData(u.ultimoAcesso)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => abrirEditar(u)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors hover:brightness-95"
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
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--paper, #f4f1e6)', border: '1px solid var(--gold, #c49818)' }}>
              <div className="h-4 w-32 rounded mb-2" style={{ backgroundColor: 'var(--paper-3, #dddac8)' }} />
              <div className="h-3 w-48 rounded" style={{ backgroundColor: 'var(--paper-3, #dddac8)' }} />
            </div>
          ))
        ) : usuarios.length === 0 ? (
          <p className="text-center py-10 text-sm font-bold" style={{ color: 'var(--ink, #1b3a2f)' }}>
            Nenhum usuário encontrado.
          </p>
        ) : (
          usuarios.map((u) => (
            <div key={u.id} className="rounded-xl p-4 relative" style={{ backgroundColor: 'var(--paper, #f4f1e6)', border: '1px solid var(--gold, #c49818)' }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>{u.nome}</p>
                  <p className="text-xs font-bold truncate mt-0.5" style={{ color: 'var(--ink, #1b3a2f)' }}>{u.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <PapelBadge papel={u.papel} />
                    <StatusBadge ativo={u.ativo} />
                  </div>
                  <p className="text-xs font-bold mt-2" style={{ color: 'var(--ink, #1b3a2f)' }}>
                    Último acesso: {formatarData(u.ultimoAcesso)}
                  </p>
                </div>
                <div className="relative ml-3">
                  <button
                    onClick={() => setMenuAberto(menuAberto === u.id ? null : u.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold leading-none"
                    style={{ color: 'var(--ink, #1b3a2f)', backgroundColor: 'var(--paper-3, #dddac8)' }}
                  >
                    ⋮
                  </button>
                  {menuAberto === u.id && (
                    <div
                      className="absolute right-0 top-10 z-20 rounded-xl shadow-xl overflow-hidden min-w-[130px]"
                      style={{ backgroundColor: 'var(--paper-2, #eae6d4)', border: '1px solid var(--gold, #c49818)' }}
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
                          style={{ color: '#F87171', borderTop: '1px solid var(--paper-3, #dddac8)' }}
                        >
                          Desativar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAtivar(u)}
                          className="w-full text-left px-4 py-3 text-sm font-bold hover:brightness-95 transition-colors"
                          style={{ color: '#27ae60', borderTop: '1px solid var(--paper-3, #dddac8)' }}
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
            className="w-full max-w-md p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--paper, #f4f1e6)', border: '1px solid var(--gold, #c49818)', borderTop: '3px solid var(--gold, #c49818)', borderRadius: '12px' }}
          >
            {/* Header modal */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-extrabold" style={{ fontSize: '22px', color: 'var(--ink, #1b3a2f)', fontFamily: "'Playfair Display', serif" }}>
                {editando ? 'Editar usuário' : 'Novo usuário'}
              </h2>
              <button
                onClick={fecharModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors hover:brightness-95"
                style={{ backgroundColor: 'var(--paper-3, #dddac8)', color: 'var(--ink, #1b3a2f)' }}
              >
                ✕
              </button>
            </div>

            {/* Divisor ornamental */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0 20px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
              <span style={{ color: 'var(--gold, #c49818)', fontSize: '10px' }}>◆</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--paper-3, #dddac8)' }} />
            </div>

            <form onSubmit={handleSalvar} className="space-y-4">
              <CampoTexto
                label="Nome"
                value={form.nome}
                onChange={(v) => setForm({ ...form, nome: v })}
                required
                placeholder="Nome completo"
              />

              <CampoTexto
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
                required
                placeholder="email@exemplo.com"
              />

              {editando ? (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        backgroundColor: alterarSenha ? 'var(--gold, #c49818)' : 'var(--paper-3, #dddac8)',
                        border: `1.5px solid ${alterarSenha ? 'var(--gold, #c49818)' : 'var(--paper-3, #dddac8)'}`,
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
                    <span className="text-sm font-bold" style={{ color: 'var(--ink, #1b3a2f)' }}>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink, #1b3a2f)' }}>
                    Papel
                  </label>
                  <select
                    value={form.papel}
                    onChange={(e) => setForm({ ...form, papel: e.target.value as 'adm' | 'editor' })}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none font-bold"
                    style={{ backgroundColor: 'var(--paper-2, #eae6d4)', color: 'var(--ink, #1b3a2f)', border: '1px solid var(--paper-3, #dddac8)' }}
                  >
                    <option value="editor">Editor</option>
                    <option value="adm">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink, #1b3a2f)' }}>
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, ativo: !form.ativo })}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-bold transition-colors"
                    style={{ backgroundColor: 'var(--paper-2, #eae6d4)', color: form.ativo ? '#16a34a' : '#dc2626', border: '1px solid var(--paper-3, #dddac8)' }}
                  >
                    <span>{form.ativo ? 'Ativo' : 'Inativo'}</span>
                    <div
                      className="w-9 h-5 rounded-full relative transition-colors"
                      style={{ backgroundColor: form.ativo ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.15)' }}
                    >
                      <div
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                        style={{ backgroundColor: form.ativo ? '#16a34a' : '#dc2626', left: form.ativo ? '18px' : '2px' }}
                      />
                    </div>
                  </button>
                </div>
              </div>

              {erro && (
                <div className="rounded-lg px-4 py-3 text-sm font-bold" style={{ backgroundColor: '#3B1F1F', color: '#F87171' }}>
                  {erro}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharModal}
                  className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors hover:brightness-95"
                  style={{ backgroundColor: 'var(--paper-3, #dddac8)', color: 'var(--ink, #1b3a2f)' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-2.5 text-sm font-bold transition-all"
                  style={{
                    backgroundColor: 'var(--ink, #1b3a2f)',
                    color: 'var(--gold, #c49818)',
                    border: '1px solid var(--gold, #c49818)',
                    borderRadius: '8px',
                    opacity: salvando ? 0.6 : 1,
                  }}
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
      <label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink, #1b3a2f)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-bold outline-none transition-all placeholder:font-light"
        style={{ backgroundColor: 'var(--paper-2, #eae6d4)', color: 'var(--ink, #1b3a2f)', border: '1px solid var(--paper-3, #dddac8)' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold, #c49818)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--paper-3, #dddac8)')}
      />
    </div>
  )
}

function PapelBadge({ papel }: { papel: 'adm' | 'editor' }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold"
      style={{
        backgroundColor: papel === 'adm' ? 'rgba(196,152,24,0.15)' : 'var(--paper-3, #dddac8)',
        color: papel === 'adm' ? 'var(--gold, #c49818)' : 'var(--ink, #1b3a2f)',
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
        style={{ backgroundColor: ativo ? '#16a34a' : '#6B7280' }}
      />
      <span style={{ color: ativo ? '#16a34a' : '#6B7280' }}>{ativo ? 'Ativo' : 'Inativo'}</span>
    </span>
  )
}
