'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Pin, PinFormData } from '@/lib/types'
import PinForm from '@/components/PinForm'
import PinsList from '@/components/PinsList'
import type { MapViewProps } from '@/components/MapView'

// Leaflet requires a browser environment — load with ssr:false
const MapView = dynamic<MapViewProps>(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex flex-col items-center justify-center bg-slate-100 gap-3">
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #1d4ed8',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <p className="text-sm text-slate-500 font-medium">Cargando mapa...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  ),
})

const DEFAULT_FORM: PinFormData = {
  lat: 0,
  lng: 0,
  nombre: '',
  descripcion: '',
  categoria: 'vivienda',
}

type GPSStatus = 'idle' | 'searching' | 'found' | 'error' | 'denied'

export default function Page() {
  const [formData, setFormData] = useState<PinFormData>(DEFAULT_FORM)
  const [savedPins, setSavedPins] = useState<Pin[]>([])
  const [gpsStatus, setGpsStatus] = useState<GPSStatus>('idle')

  // Load existing pins on mount
  useEffect(() => {
    fetch('/api/pins')
      .then((r) => r.json())
      .then((data: Pin[]) => setSavedPins(data))
      .catch(() => {})
  }, [])

  const handlePositionChange = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, lat, lng }))
  }, [])

  const handleFormChange = useCallback((data: Partial<PinFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }, [])

  const handleSubmit = useCallback(async (data: PinFormData) => {
    const res = await fetch('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed to save pin')
    const newPin: Pin = await res.json()
    setSavedPins((prev) => [...prev, newPin])
    // Keep coordinates and category; reset only text fields
    setFormData((prev) => ({ ...prev, nombre: '', descripcion: '' }))
  }, [])

  const handleDeletePin = useCallback(async (id: string) => {
    const res = await fetch('/api/pins', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setSavedPins((prev) => prev.filter((p) => p.id !== id))
    }
  }, [])

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(savedPins, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `geopin-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [savedPins])

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* ── Top header ──────────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-5 py-3 shadow-sm z-20 flex-shrink-0"
        style={{ background: '#1e3a5f' }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <div>
          <h1 className="font-bold text-base leading-none text-white tracking-tight">GeoPin</h1>
          <p className="text-xs leading-none mt-0.5" style={{ color: '#93c5fd' }}>
            Sistema de marcado de establecimientos
          </p>
        </div>

        {/* GPS status pill */}
        {gpsStatus !== 'idle' && (
          <span
            className="ml-auto flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
            style={{
              background:
                gpsStatus === 'found'
                  ? '#14532d'
                  : gpsStatus === 'searching'
                    ? '#1e3a8a'
                    : '#7f1d1d',
              color:
                gpsStatus === 'found'
                  ? '#86efac'
                  : gpsStatus === 'searching'
                    ? '#93c5fd'
                    : '#fca5a5',
            }}
          >
            {gpsStatus === 'searching' && (
              <span
                style={{
                  width: 9,
                  height: 9,
                  border: '1.5px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}
            {gpsStatus !== 'searching' && (
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'currentColor',
                  display: 'inline-block',
                }}
              />
            )}
            {gpsStatus === 'found' && 'GPS activo'}
            {gpsStatus === 'searching' && 'Buscando GPS...'}
            {gpsStatus === 'error' && 'GPS no disponible'}
            {gpsStatus === 'denied' && 'GPS denegado'}
          </span>
        )}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </header>

      {/* ── Split layout ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — form + list */}
        <aside
          className="flex flex-col overflow-hidden flex-shrink-0"
          style={{ width: 360, borderRight: '1px solid #e2e8f0' }}
        >
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 flex flex-col gap-5">
              {/* Form section */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    style={{
                      width: 4,
                      height: 16,
                      background: '#1d4ed8',
                      borderRadius: 2,
                    }}
                    aria-hidden="true"
                  />
                  <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                    Nuevo pin
                  </h2>
                </div>
                <PinForm
                  formData={formData}
                  onChange={handleFormChange}
                  onSubmit={handleSubmit}
                  gpsStatus={gpsStatus}
                />
              </section>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

              {/* Pins list section */}
              <section>
                <PinsList
                  pins={savedPins}
                  onDelete={handleDeletePin}
                  onExport={handleExport}
                />
              </section>
            </div>
          </div>
        </aside>

        {/* Right panel — map */}
        <div className="flex-1 relative overflow-hidden">
          <MapView
            lat={formData.lat}
            lng={formData.lng}
            categoria={formData.categoria}
            savedPins={savedPins}
            onPositionChange={handlePositionChange}
            onGPSStatus={(s) => setGpsStatus(s as GPSStatus)}
            onDeletePin={handleDeletePin}
          />

          {/* Map hint overlay */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium pointer-events-none z-[1000]"
            style={{
              background: 'rgba(15,23,42,.72)',
              color: '#e2e8f0',
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}
          >
            Haz clic en el mapa o arrastra el marcador para posicionar el pin
          </div>
        </div>
      </div>
    </main>
  )
}
