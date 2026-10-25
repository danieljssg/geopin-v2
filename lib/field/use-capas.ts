'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { CapaMapa } from '@/lib/map/capas'
import { redirigirSiNoHaySesion } from './sesion'

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

/** Capa base preferida con red. */
const BASE_CON_RED = 'osm'
/** Capa base preferida sin conexión: la que vive en el dispositivo. */
const BASE_SIN_RED = 'propio'

/**
 * Conectividad del navegador como store externo.
 *
 * `navigator.onLine` es una aproximación: dice que hay una interfaz de red,
 * no que internet funcione. Alcanza para lo que decide acá, que es qué mapa
 * base arrancar: con red, el estándar; sin red, el del levantamiento, que es
 * el único que puede responder desde el caché.
 */
function suscribirRed(notificar: () => void): () => void {
  window.addEventListener('online', notificar)
  window.addEventListener('offline', notificar)
  return () => {
    window.removeEventListener('online', notificar)
    window.removeEventListener('offline', notificar)
  }
}

const leerRed = () => navigator.onLine
// En el servidor no hay red: se asume que sí, para no prerenderizar el mapa
// propio por defecto.
const leerRedEnServidor = () => true

export function useCapas(): UseCapasResult {
  const [capas, setCapas] = useState<CapaMapa[] | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [error, setError] = useState<string | undefined>()
  // El estado de carga se deriva de los datos (render en cascada evitado).
  const cargando = capas === null && error === undefined
  /**
   * Solo la elección explícita del levantador. El valor efectivo se deriva
   * de la conectividad: con red el mapa estándar, sin red el propio. Así no
   * hace falta un efecto que reaccione a `online`/`offline` con setState.
   */
  const [baseElegida, setBaseElegida] = useState<string | null>(null)
  const online = useSyncExternalStore(suscribirRed, leerRed, leerRedEnServidor)
  const [overlaysVisibles, setOverlaysVisibles] = useState<string[]>([])
  const [opacidades, setOpacidades] = useState<Record<string, number>>({})

  const baseActiva = useMemo(() => {
    const bases = (capas ?? []).filter((capa) => capa.tipo === 'base')
    if (baseElegida && bases.some((capa) => capa.id === baseElegida)) return baseElegida

    const preferida = online ? BASE_CON_RED : BASE_SIN_RED
    if (bases.some((capa) => capa.id === preferida)) return preferida
    return bases[0]?.id ?? ''
  }, [capas, baseElegida, online])


  useEffect(() => {
    let vivo = true

    async function cargar(mostrarCarga = true) {
      if (mostrarCarga) setError(undefined)

      try {
        const respuesta = await fetch('/api/capas', { credentials: 'same-origin' })
        if (redirigirSiNoHaySesion(respuesta.status)) return
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)

        const { capas: lista, avisos: listaAvisos } = (await respuesta.json()) as {
          capas: CapaMapa[]
          avisos: string[]
        }
        if (!vivo) return

        setCapas(lista)
        setAvisos(listaAvisos ?? [])

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
    setBaseActiva: setBaseElegida,
    toggleOverlay,
    setOpacidad,
  }
}
