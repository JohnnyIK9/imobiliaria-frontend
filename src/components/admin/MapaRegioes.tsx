'use client'

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import type { Map as LeafletMap, Polygon, CircleMarker, LatLng } from 'leaflet'
import type L from 'leaflet'

export type Ponto = [number, number]

export type RegiaoMapa = {
  id: number
  nome: string
  coordenadas: Ponto[]
}

export type MapaRegioesRef = {
  ativarDesenho: () => void
  desativarDesenho: () => void
  finalizarDesenho: () => void
  limparDesenho: () => void
  getPontos: () => Ponto[]
  moverParaCidade: (lat: number, lng: number, zoom: number) => void
  renderizarRegioes: (regioes: RegiaoMapa[], selecionada: number | null) => void
  ativarEdicao: (pontos: Ponto[], onChange: (pontos: Ponto[]) => void) => void
  atualizarPontoEdicao: (index: number, lat: number, lng: number) => void
  excluirPontoEdicao: (index: number) => void
  desativarEdicao: () => void
}

type Props = {
  onDesenhoAtualizado?: (pontos: Ponto[]) => void
  onDesenhoFinalizado?: () => void
  onReady?: () => void
}

const MapaRegioes = forwardRef<MapaRegioesRef, Props>(function MapaRegioes(
  { onDesenhoAtualizado, onDesenhoFinalizado, onReady },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const LRef = useRef<typeof L | null>(null)

  // Desenho
  const desenhando = useRef(false)
  const pontosDesenho = useRef<Ponto[]>([])
  const poligonoTemp = useRef<Polygon | null>(null)
  const marcadoresDesenho = useRef<CircleMarker[]>([])

  // Edição
  const editando = useRef(false)
  const marcadoresEdicao = useRef<CircleMarker[]>([])
  const poligonoEdicao = useRef<Polygon | null>(null)
  const pontosEdicao = useRef<Ponto[]>([])
  const onChangeEdicao = useRef<((pontos: Ponto[]) => void) | null>(null)
  const arrastando = useRef(false) // impede que o mouseup do drag dispare um click

  // Regiões cadastradas
  const poligonosCadastrados = useRef<Polygon[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const container = containerRef.current
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((container as any)._leaflet_id) return

    async function iniciar() {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      LRef.current = L

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
        if (desenhando.current) {
          const { lat, lng } = e.latlng
          pontosDesenho.current.push([lat, lng])
          atualizarDesenho(map, L)
          onDesenhoAtualizado?.([...pontosDesenho.current])
          return
        }
        if (editando.current) {
          if (arrastando.current) { arrastando.current = false; return }
          const { lat, lng } = e.latlng
          pontosEdicao.current.push([lat, lng])
          atualizarPoligonoEdicao(L, map)
          renderizarMarcadoresEdicao(L, map)
          onChangeEdicao.current?.([...pontosEdicao.current])
        }
      })

      map.on('dblclick', () => {
        if (!desenhando.current) return
        if (pontosDesenho.current.length >= 3) {
          desenhando.current = false
          if (containerRef.current) containerRef.current.style.cursor = ''
          onDesenhoFinalizado?.()
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
      poligonoTemp.current = L.polygon(pts as unknown as LatLng[], {
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

  function atualizarPoligonoEdicao(Lsafe: typeof L, mapSafe: LeafletMap) {
    const pts = pontosEdicao.current
    if (pts.length < 2) {
      poligonoEdicao.current?.remove()
      poligonoEdicao.current = null
      return
    }
    // Atualiza o polígono existente em vez de recriar — evita que fique por cima dos marcadores
    if (poligonoEdicao.current) {
      poligonoEdicao.current.setLatLngs(pts as unknown as LatLng[])
    } else {
      poligonoEdicao.current = Lsafe.polygon(pts as unknown as LatLng[], {
        color: '#40A6F4',
        fillColor: '#40A6F4',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6 4',
        interactive: false,
      }).addTo(mapSafe)
    }
  }

  function renderizarMarcadoresEdicao(Lsafe: typeof L, mapSafe: LeafletMap) {
    marcadoresEdicao.current.forEach((m) => m.remove())
    marcadoresEdicao.current = []

    pontosEdicao.current.forEach((p, i) => {
      const m = Lsafe.circleMarker(p as unknown as LatLng, {
        radius: 7,
        color: '#40A6F4',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(mapSafe)

      // Arrastar move o ponto — mouse e touch
      function iniciarArrasto(clientX: number, clientY: number) {
        mapSafe.dragging.disable()
        let moveu = false

        function mover(cx: number, cy: number) {
          moveu = true
          const rect = containerRef.current!.getBoundingClientRect()
          const latlng = mapSafe.containerPointToLatLng([cx - rect.left, cy - rect.top])
          pontosEdicao.current[i] = [latlng.lat, latlng.lng]
          m.setLatLng(latlng as unknown as LatLng)
          atualizarPoligonoEdicao(Lsafe, mapSafe)
          onChangeEdicao.current?.(pontosEdicao.current)
        }

        function onMouseMove(e: MouseEvent) { mover(e.clientX, e.clientY) }
        function onTouchMove(e: TouchEvent) { e.preventDefault(); mover(e.touches[0].clientX, e.touches[0].clientY) }

        function terminar() {
          mapSafe.dragging.enable()
          if (moveu) arrastando.current = true
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', terminar)
          document.removeEventListener('touchmove', onTouchMove)
          document.removeEventListener('touchend', terminar)
        }

        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', terminar)
        document.addEventListener('touchmove', onTouchMove, { passive: false })
        document.addEventListener('touchend', terminar)

        void clientX; void clientY
      }

      m.on('mousedown', (ev) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(ev as any).originalEvent?.stopPropagation()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oe = (ev as any).originalEvent as MouseEvent
        iniciarArrasto(oe.clientX, oe.clientY)
      })

      // Touch: listener nativo direto no elemento para interceptar antes do Leaflet
      const el = m.getElement()
      if (el) {
        el.addEventListener('touchstart', (e: Event) => {
          const te = e as TouchEvent
          te.stopPropagation()
          te.preventDefault()
          iniciarArrasto(te.touches[0].clientX, te.touches[0].clientY)
        }, { passive: false })
      }

      marcadoresEdicao.current.push(m)
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

    finalizarDesenho() {
      if (!desenhando.current || pontosDesenho.current.length < 3) return
      desenhando.current = false
      if (containerRef.current) containerRef.current.style.cursor = ''
      onDesenhoFinalizado?.()
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
        const poly = L.polygon(r.coordenadas as unknown as LatLng[], {
          color: isSel ? '#fff' : '#40A6F4',
          fillColor: '#40A6F4',
          fillOpacity: 0.15,
          weight: isSel ? 2.5 : 1.5,
        }).addTo(map)

        poly.bindTooltip(
          `<strong>${r.nome}</strong>`,
          { permanent: true, direction: 'center', className: 'leaflet-tooltip-regiao' }
        )

        poligonosCadastrados.current.push(poly)
      })
    },

    ativarEdicao(pontos, onChange) {
      const L = LRef.current
      const map = mapRef.current
      if (!L || !map) return

      editando.current = true
      pontosEdicao.current = [...pontos]
      onChangeEdicao.current = onChange

      atualizarPoligonoEdicao(L, map)
      renderizarMarcadoresEdicao(L, map)
    },

    atualizarPontoEdicao(index, lat, lng) {
      const L = LRef.current
      const map = mapRef.current
      if (!L || !map) return
      pontosEdicao.current[index] = [lat, lng]
      marcadoresEdicao.current[index]?.setLatLng([lat, lng] as unknown as LatLng)
      atualizarPoligonoEdicao(L, map)
      onChangeEdicao.current?.(pontosEdicao.current)
    },

    excluirPontoEdicao(index) {
      const L = LRef.current
      const map = mapRef.current
      if (!L || !map || pontosEdicao.current.length <= 3) return
      pontosEdicao.current.splice(index, 1)
      onChangeEdicao.current?.(pontosEdicao.current)
      atualizarPoligonoEdicao(L, map)
      renderizarMarcadoresEdicao(L, map)
    },

    desativarEdicao() {
      editando.current = false
      poligonoEdicao.current?.remove()
      poligonoEdicao.current = null
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
