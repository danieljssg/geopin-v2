'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { MapViewProps } from '@/components/MapView'
import FormularioParcela from '@/components/field/FormularioParcela'
import SyncStatus from '@/components/field/SyncStatus'
import { useSync } from '@/components/field/SyncProvider'
import { useSchemas } from '@/lib/field/use-schemas'

/**
 * Página de campo v2.
 *
 * Sustituye al formulario hardcodeado: los campos salen del esquema
 * publicado, cada módulo es una pestaña, y al guardar la parcela entra en la
 * cola local en vez de esperar a la red. La sincronización la dispara el
 * SyncProvider.
 *
 * La posición se toma del mismo `MapView` que usa el prototipo: el mapa no
 * cambia, lo que cambia es de dónde salen los campos.
 */

const MapView = dynamic<MapViewProps>(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100">
      <p className="text-sm text-slate-500 font-medium">Cargando mapa…</p>
    </div>
  ),
})

export default function CampoPage() {
  const { esquemas, cargando, desdeCache, error, recargar } = useSchemas()
  const { encolar } = useSync()

  const [ubicacion, setUbicacion] = useState({ lat: 10.4806, lng: -66.9036 })
  const [gps, setGps] = useState<{ fuente: 'sensor' | 'manual'; precision?: number }>({
    fuente: 'manual',
  })

  async function onGuardar(payload: ParcelaCreateRequest) {
    await encolar(payload)
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 px-3 py-3 shadow-sm z-20 shrink-0 sm:px-5" style={{ background: '#1e3a5f' }}>
        <div>
          <h1 className="font-bold text-base leading-none text-white tracking-tight">GeoPin</h1>
          <p className="hidden text-xs leading-none mt-0.5 sm:block" style={{ color: '#93c5fd' }}>
            Captura de parcela
          </p>
        </div>
        <SyncStatus />
        <a href="/admin/esquema" className="ml-auto text-xs text-white underline">
          Esquemas
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <aside className="w-full md:w-[400px] shrink-0 overflow-y-auto p-4" style={{ borderRight: '1px solid #e2e8f0' }}>
          {cargando && <p className="text-sm text-slate-500">Cargando formulario…</p>}

          {!cargando && (desdeCache || error) && (
            <div className="mb-3 rounded-md px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>
              <p>{error}</p>
              <button type="button" onClick={recargar} className="mt-1 font-semibold underline">
                Reintentar
              </button>
            </div>
          )}

          {!cargando && (
            <FormularioParcela
              esquemas={esquemas}
              ubicacion={ubicacion}
              gps={gps}
              onGuardar={onGuardar}
            />
          )}
        </aside>

        <div className="flex-1 relative min-h-[50vh]">
          <MapView
            lat={ubicacion.lat}
            lng={ubicacion.lng}
            categoria="vivienda"
            savedPins={[]}
            onPositionChange={(lat, lng) => {
              setUbicacion({ lat, lng })
              setGps((previo) => ({ ...previo, fuente: 'manual' }))
            }}
            onGPSStatus={(status) => {
              if (status === 'found') setGps((previo) => ({ ...previo, fuente: 'sensor' }))
            }}
            onDeletePin={() => {}}
            onEditPin={() => {}}
          />
        </div>
      </div>
    </main>
  )
}
