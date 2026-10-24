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
  const [capas, setCapas] = useState<CapaMapa[] | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [error, setError] = useState<string | undefined>()
  // El estado de carga se deriva de los datos (render en cascada evitado).
  const cargando = capas === null && error === undefined
  const [baseActiva, setBaseActiva] = useState('')
  const [overlaysVisibles, setOverlaysVisibles] = useState<string[]>([])
  const [opacidades, setOpacidades] = useState<Record<string, number>>({})

  useEffect(() => {
    let vivo = true

    async function cargar(mostrarCarga = true) {
      if (mostrarCarga) setError(undefined)

      try {
        const respuesta = await fetch('/api/capas', { credentials: 'same-origin' })
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)

        const { capas: lista, avisos: listaAvisos } = (await respuesta.json()) as {
          capas: CapaMapa[]
          avisos: string[]
        }
        if (!vivo) return

        setCapas(lista)
        setAvisos(listaAvisos ?? [])

        const primeraBase = lista.find((capa) => capa.tipo === 'base')
        setBaseActiva((previa) => previa || primeraBase?.id || '')

        const iniciales: Record<string, number> = {}
        for (const capa of lista) iniciales[capa.id] = capa.opacity
        setOpacidades(iniciales)
      } catch {
        if (vivo) {
          setError('No se pudo cargar la configuración de capas.')
          setAvisos(['No se pudo cargar la configuración de capas.'])
        }
      } finally {
        // Sin estado de carga: se deriva de los datos.
      }
    }

    void cargar(false)
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
    capas: capas ?? [],
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
