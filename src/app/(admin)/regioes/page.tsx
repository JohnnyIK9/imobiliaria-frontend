'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

const MapaLeaflet = dynamic(() => import('@/components/admin/MapaLeaflet'), { ssr: false })

type FormData = {
  nome: string
  estado: string
  cidade: string
}

const FORM_VAZIO: FormData = { nome: '', estado: '', cidade: '' }

export default function RegioesPage() {
  const [form, setForm] = useState<FormData>(FORM_VAZIO)
  const [painelAberto, setPainelAberto] = useState(true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'var(--color-green-dark)',
          flexShrink: 0,
        }}
      >
        <h1 style={{ color: 'var(--color-white)', fontSize: '18px', fontWeight: 800, margin: 0 }}>
          Regiões
        </h1>
        {/* Botão toggle painel — visível só em mobile */}
        <button
          onClick={() => setPainelAberto((v) => !v)}
          className="md:hidden"
          style={{
            backgroundColor: 'var(--color-green-mid)',
            color: 'var(--color-white)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {painelAberto ? 'Fechar painel' : 'Abrir painel'}
        </button>
      </div>

      {/* Corpo: mapa + painel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mapa */}
        <div style={{ flex: 1, position: 'relative', zIndex: 0 }}>
          <MapaLeaflet />
        </div>

        {/* Painel lateral — desktop fixo, mobile drawer */}
        <div
          className={painelAberto ? '' : 'hidden md:flex'}
          style={{
            width: '340px',
            flexShrink: 0,
            backgroundColor: 'var(--color-green-dark)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '24px' }}>
            <p style={{ color: 'var(--color-gray-dark)', fontSize: '12px', fontWeight: 300, margin: '0 0 20px 0' }}>
              Preencha os dados e desenhe o polígono no mapa para cadastrar uma nova região.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Nome da região */}
              <Campo
                label="Nome da região"
                placeholder="Ex: Zona Norte"
                value={form.nome}
                onChange={(v) => setForm({ ...form, nome: v })}
              />

              {/* Estado */}
              <Campo
                label="Estado"
                placeholder="Ex: SP"
                value={form.estado}
                onChange={(v) => setForm({ ...form, estado: v })}
              />

              {/* Cidade */}
              <Campo
                label="Cidade"
                placeholder="Ex: Franca"
                value={form.cidade}
                onChange={(v) => setForm({ ...form, cidade: v })}
              />

              {/* Botão salvar */}
              <button
                disabled
                style={{
                  marginTop: '4px',
                  backgroundColor: 'var(--color-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'not-allowed',
                  opacity: 0.4,
                  width: '100%',
                }}
              >
                Salvar região
              </button>
              <p style={{ color: 'var(--color-gray-dark)', fontSize: '11px', fontWeight: 300, margin: 0, textAlign: 'center' }}>
                O botão será habilitado após desenhar o polígono no mapa.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Campo({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label
        style={{ display: 'block', color: 'var(--color-white)', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          backgroundColor: 'var(--color-green-mid)',
          color: 'var(--color-white)',
          border: '1px solid transparent',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-blue)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      />
    </div>
  )
}
