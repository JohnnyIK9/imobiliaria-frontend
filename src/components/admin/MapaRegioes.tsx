'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import type { Map as LeafletMap, Polygon, CircleMarker, LatLng } from 'leaflet'
import type L from 'leaflet'

export type Ponto = [number, number]

export type RegiaoMapa = {
  id: number
  nome: string
  coordenadas: Ponto[]
  totalImoveis: number
}

export type MapaRegioesRef = {
  ativarDesenho: () => void
  desativarDesenho: () => void
  limparDesenho: () => void
  getPontos: () => Ponto[]
  moverParaCidade: (lat: number, lng: number, zoom: number) => void
  renderizarRegioes: (regioes: RegiaoMapa[], selecionada: number | null) => void
  ativarEdicao: (pontos: Ponto[], onChange: (pontos: Ponto[]) => void) => void
  desativarEdicao: () => void
}

type Props = {
  onDesenhoAtualizado?: (pontos: Ponto[]) => void
  onReady?: () => void
}

const MapaRegioes = forwardRef<MapaRegioesRef, Props>(function MapaRegioes({ onDesenhoAtualizado, onReady }, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const LRef = useRef<typeof L | null>(null)

  // Estado de desenho
  const desenhando = useRef(false)
  const pontosDesenho = useRef<Ponto[]>([])
  const poligonoTemp = useRef<Polygon | null>(null)
  const marcadoresDesenho = useRef<CircleMarker[]>([])

  // Estado de edição
  const editando = useRef(false)
  const marcadoresEdicao = useRef<CircleMarker[]>([])
  const pontosEdicao = useRef<Ponto[]>([])
  const onChangeEdicao = useRef<((pontos: Ponto[]) => void) | null>(null)

  // Polígonos de regiões cadastradas
  const poligonosCadastrados = useRef<Polygon[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Guard contra double-mount do StrictMode
    const container = containerRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((container as any)._leaflet_id) return

    async function iniciar() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      LRef.current = L

      // Verifica novamente após o await (pode ter montado duas vezes)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((container as any)._leaflet_id) return

      const map = L.map(container, {
        center: [-20.5386, -47.4008],
        zoom: 13,
        zoomControl: true,
        doubleClickZoom: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      map.on('click', (e) => {
        if (!desenhando.current) return
        const { lat, lng } = e.latlng
        pontosDesenho.current.push([lat, lng])
        atualizarDesenho(map, L)
        onDesenhoAtualizado?.(pontosDesenho.current)
      })

      map.on('dblclick', () => {
        if (!desenhando.current) return
        if (pontosDesenho.current.length >= 3) {
          desenhando.current = false
          if (containerRef.current) containerRef.current.style.cursor = ''
        }
      })

      mapRef.current = map
      onReady?.()
    }

    iniciar()

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  function atualizarDesenho(map: LeafletMap, L: typeof import('leaflet')) {
    poligonoTemp.current?.remove()
    marcadoresDesenho.current.forEach((m) => m.remove())
    marcadoresDesenho.current = []

    const pts = pontosDesenho.current
    if (pts.length === 0) return

    if (pts.length >= 2) {
      poligonoTemp.current = L.polygon(pts as unknown as unknown as LatLng[], {
        color: '#40A6F4',
        fillColor: '#40A6F4',
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '6 4',
      }).addTo(map)
    }

    pts.forEach((p, i) => {
      const m = L.circleMarker(p as unknown as LatLng, {
        radius: 6,
        color: '#40A6F4',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map)
      m.bindTooltip(`Ponto ${i + 1}`, { permanent: false })
      marcadoresDesenho.current.push(m)
    })
  }

  useImperativeHandle(ref, () => ({
    ativarDesenho() {
      desenhando.current = true
      if (containerRef.current) containerRef.current.style.cursor = 'crosshair'
    },

    desativarDesenho() {
      desenhando.current = false
      if (containerRef.current) containerRef.current.style.cursor = ''
    },

    limparDesenho() {
      desenhando.current = false
      pontosDesenho.current = []
      poligonoTemp.current?.remove()
      poligonoTemp.current = null
      marcadoresDesenho.current.forEach((m) => m.remove())
      marcadoresDesenho.current = []
      if (containerRef.current) containerRef.current.style.cursor = ''
      onDesenhoAtualizado?.([])
    },

    getPontos() {
      return [...pontosDesenho.current]
    },

    moverParaCidade(lat, lng, zoom) {
      mapRef.current?.setView([lat, lng], zoom)
    },

    renderizarRegioes(regioes, selecionada) {
      const L = LRef.current
      const map = mapRef.current
      if (!L || !map) return

      poligonosCadastrados.current.forEach((p) => p.remove())
      poligonosCadastrados.current = []

      regioes.forEach((r) => {
        const isSel = r.id === selecionada
        const poly = L.polygon(r.coordenadas as unknown as unknown as LatLng[], {
          color: isSel ? '#fff' : '#40A6F4',
          fillColor: '#40A6F4',
          fillOpacity: r.totalImoveis > 0 ? 0.22 : 0.06,
          weight: isSel ? 2.5 : 1.5,
          dashArray: r.totalImoveis > 0 ? undefined : '6 4',
        }).addTo(map)

        poly.bindTooltip(
          `<strong>${r.nome}</strong><br/>${r.totalImoveis} imóvel(is)`,
          { permanent: true, direction: 'center', className: 'leaflet-tooltip-regiao' }
        )

        poligonosCadastrados.current.push(poly)
      })
    },

    ativarEdicao(pontos, onChange) {
      const L = LRef.current
      const map = mapRef.current
      if (!L || !map) return

      const Lsafe = L
      const mapSafe = map
      editando.current = true
      pontosEdicao.current = [...pontos]
      onChangeEdicao.current = onChange

      function renderizarMarcadoresEdicao() {
        marcadoresEdicao.current.forEach((m) => m.remove())
        marcadoresEdicao.current = []

        pontosEdicao.current.forEach((p, i) => {
          const m = Lsafe.circleMarker(p as unknown as LatLng, {
            radius: 8,
            color: '#40A6F4',
            fillColor: '#fff',
            fillOpacity: 1,
            weight: 2,
          }).addTo(mapSafe)

          m.on('mousedown', () => {
            mapSafe.dragging.disable()

            function onMouseMove(e: MouseEvent) {
              const rect = containerRef.current!.getBoundingClientRect()
              const x = e.clientX - rect.left
              const y = e.clientY - rect.top
              const latlng = mapSafe.containerPointToLatLng([x, y])
              pontosEdicao.current[i] = [latlng.lat, latlng.lng]
              m.setLatLng(latlng)
              onChangeEdicao.current?.(pontosEdicao.current)
            }

            function onMouseUp() {
              mapSafe.dragging.enable()
              document.removeEventListener('mousemove', onMouseMove)
              document.removeEventListener('mouseup', onMouseUp)
            }

            document.addEventListener('mousemove', onMouseMove)
            document.addEventListener('mouseup', onMouseUp)
          })

          marcadoresEdicao.current.push(m)
        })
      }

      renderizarMarcadoresEdicao()
    },

    desativarEdicao() {
      editando.current = false
      marcadoresEdicao.current.forEach((m) => m.remove())
      marcadoresEdicao.current = []
      onChangeEdicao.current = null
    },
  }))

  return (
    <>
      <style>{`
        .leaflet-tooltip-regiao {
          background: rgba(29,30,32,0.85);
          border: 1px solid rgba(64,166,244,0.4);
          color: #fff;
          font-family: 'Lato', sans-serif;
          font-size: 12px;
          font-weight: 700;
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow: none;
        }
        .leaflet-tooltip-regiao::before { display: none; }
      `}</style>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
})

export default MapaRegioes
