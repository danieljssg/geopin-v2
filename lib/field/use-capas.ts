'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CapaMapa } from '@/lib/map/capas'

/**
 * Configuración de las capas del mapa.
 *
 * Viene del servidor, no del bundle: agregar una ortofoto municipal es
 * cambiar una variable de entorno, sin recompilar.
 */
export interface UseCapasResult {
  capas: CapaMapa[]
  avisos: string[]
  cargando: boolean
  baseActiva: string
  overlaysVisibles: string[]
  opacidades: Record<string, number>
  setBaseActiva: (id: string) => void
  toggleOverlay: (id: string) => void
  setOpacidad: (id: string, valor: number) => void
}

export function useCapas(): UseCapasResult {
  const [capas, setCapas] = useState<CapaMapa[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [baseActiva, setBaseActiva] = useState('')
  const [overlaysVisibles, setOverlaysVisibles] = useState<string[]>([])
  const [opacidades, setOpacidades] = useState<Record<string, number>>({})

  useEffect(() => {
    let vivo = true

    async function cargar() {
      try {
        const respuesta = await fetch('/api/capas', { credentials: 'same-origin' })
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)

        const cuerpo = (await respuesta.json()) as { capas: CapaMapa[]; avisos: string[] }
        if (!vivo) return

        setCapas(cuerpo.capas)
        setAvisos(cuerpo.avisos ?? [])

        const primeraBase = cuerpo.capas.find((capa) => capa.tipo === 'base')
        setBaseActiva((previa) => previa || primeraBase?.id || '')

        const iniciales: Record<string, number> = {}
        for (const capa of cuerpo.capas) iniciales[capa.id] = capa.opacity
        setOpacidades(iniciales)
      } catch {
        if (vivo) setAvisos(['No se pudo cargar la configuración de capas.'])
      } finally {
        if (vivo) setCargando(false)
      }
    }

    void cargar()
    return () => {
      vivo = false
    }
  }, [])

  const toggleOverlay = useCallback((id: string) => {
    setOverlaysVisibles((previas) =>
      previas.includes(id) ? previas.filter((otra) => otra !== id) : [...previas, id],
    )
  }, [])

  const setOpacidad = useCallback((id: string, valor: number) => {
    setOpacidades((previas) => ({ ...previas, [id]: valor }))
  }, [])

  return {
    capas,
    avisos,
    cargando,
    baseActiva,
    overlaysVisibles,
    opacidades,
    setBaseActiva,
    toggleOverlay,
    setOpacidad,
  }
}
