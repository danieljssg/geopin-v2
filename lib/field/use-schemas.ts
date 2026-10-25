'use client'

import { useEffect, useState } from 'react'
import type { ModuleSchema } from '@/lib/domain/types'
import { cacheEsquemas, getCachedEsquemas } from './cache'
import { redirigirSiNoHaySesion } from './sesion'

/**
 * Esquemas publicados, con respaldo en la caché local.
 *
 * La app de campo necesita los esquemas para dibujar el formulario. Si no
 * hay red, usa los últimos que descargó: un levantador con el esquema viejo
 * puede capturar; uno sin esquema no puede hacer nada.
 */
export interface UseSchemasResult {
  esquemas: ModuleSchema[]
  cargando: boolean
  /** Se está usando la copia local porque la red falló. */
  desdeCache: boolean
  error?: string
  recargar: () => void
}

export function useSchemas(): UseSchemasResult {
  const [esquemas, setEsquemas] = useState<ModuleSchema[] | null>(null)
  const [desdeCache, setDesdeCache] = useState(false)
  const [error, setError] = useState<string | undefined>()
  // El estado de carga se deriva de los datos: poner la bandera en estado
  // obligaba a un setState dentro del efecto (render en cascada).
  const cargando = esquemas === null && error === undefined
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let vivo = true

    async function cargar(mostrarCarga = true) {
      if (mostrarCarga) setError(undefined)

      try {
        const respuesta = await fetch('/api/esquemas', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })

        // Sin sesión no tiene sentido mostrar un error de esquemas: se va al
        // login. La raíz es estática para que el shell funcione offline, así
        // que la comprobación va acá.
        if (redirigirSiNoHaySesion(respuesta.status)) return
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)

        const { esquemas: lista } = (await respuesta.json()) as { esquemas: ModuleSchema[] }
        if (!vivo) return

        setEsquemas(lista)
        setDesdeCache(false)
        await cacheEsquemas(lista)
      } catch (caught) {
        const cache = await getCachedEsquemas()
        if (!vivo) return

        setEsquemas(cache.map((entrada) => entrada.schema))
        setDesdeCache(cache.length > 0)
        setError(
          cache.length > 0
            ? 'Sin conexión: se usan los esquemas guardados en el dispositivo.'
            : caught instanceof Error
              ? caught.message
              : 'No se pudieron cargar los esquemas.',
        )
      } finally {
        // Sin estado de carga: se deriva de los datos.
      }
    }

    void cargar(false)
    return () => {
      vivo = false
    }
  }, [tick])

  return {
    esquemas: esquemas ?? [],
    cargando,
    desdeCache,
    error,
    recargar: () => setTick((valor) => valor + 1),
  }
}
