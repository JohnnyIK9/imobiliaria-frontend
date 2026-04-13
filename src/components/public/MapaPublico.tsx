'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Polygon } from 'leaflet'
import type L from 'leaflet'

export type RegiaoMapa = {
  id: number
  nome: string
  coordenadas: [number, number][]
  totalImoveis: number
}

type Props = {
  lat: number
  lng: number
  zoom: number
  regioes: RegiaoMapa[]
  regiaoSelecionada: number | null
  onRegiaoClick: (regiaoId: number) => void
  onReady?: () => void
}

export default function MapaPublico({
  lat,
  lng,
  zoom,
  regioes,
  regiaoSelecionada,
  onRegiaoClick,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const LRef = useRef<typeof L | null>(null)
  const poligonosRef = useRef<Polygon[]>([])
  const [mapaInit, setMapaInit] = useState(false)

  // Inicializa o mapa uma vez
  useEffect(() => {
    if (!containerRef.current) return
    let cancelado = false

    import('leaflet').then((Lmod) => {
      if (cancelado || !containerRef.current) return
      if (mapRef.current) return

      const L = Lmod.default ?? Lmod
      LRef.current = L

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      mapRef.current = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(mapRef.current)

      setMapaInit(true)
      onReady?.()
    })

    return () => {
      cancelado = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recentra quando cidade muda
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setView([lat, lng], zoom)
  }, [lat, lng, zoom])

  // Renderiza polígonos das regiões
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return

    // Remove polígonos anteriores
    poligonosRef.current.forEach((p) => p.remove())
    poligonosRef.current = []

    regioes.forEach((regiao) => {
      const temImoveis = regiao.totalImoveis > 0
      const selecionada = regiaoSelecionada === regiao.id

      const poligono = L.polygon(regiao.coordenadas, {
        color: '#40A6F4',
        weight: selecionada ? 2.5 : 1.5,
        fillColor: '#40A6F4',
        fillOpacity: selecionada ? 0.35 : temImoveis ? 0.22 : 0.06,
        dashArray: temImoveis ? undefined : '6 4',
      }).addTo(map)

      poligono.bindTooltip(
        `<strong style="font-family:Lato,sans-serif;font-size:13px">${regiao.nome}</strong><br/><span style="font-family:Lato,sans-serif;font-size:11px;color:#40A6F4">${regiao.totalImoveis} imóvel${regiao.totalImoveis !== 1 ? 's' : ''}</span>`,
        { permanent: true, direction: 'center', className: 'tooltip-regiao' }
      )

      poligono.on('mouseover', () => {
        poligono.setStyle({ fillOpacity: selecionada ? 0.45 : 0.35 })
      })
      poligono.on('mouseout', () => {
        poligono.setStyle({ fillOpacity: selecionada ? 0.35 : temImoveis ? 0.22 : 0.06 })
      })
      poligono.on('click', () => {
        onRegiaoClick(regiao.id)
      })

      poligonosRef.current.push(poligono)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regioes, regiaoSelecionada, mapaInit])

  return (
    <>
      <style>{`
        .tooltip-regiao {
          background: rgba(29,30,32,0.88);
          border: 1px solid rgba(64,166,244,0.3);
          border-radius: 8px;
          padding: 5px 10px;
          color: #fff;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        }
        .tooltip-regiao::before { display: none; }
        .leaflet-container { font-family: 'Lato', sans-serif; }
      `}</style>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
