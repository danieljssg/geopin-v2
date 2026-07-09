'use client'

import { useState } from 'react'
import type { PinFormData, Category } from '@/lib/types'
import { CATEGORIAS_LIST } from '@/lib/categories'

type GPSStatus = 'idle' | 'searching' | 'found' | 'error' | 'denied'

interface PinFormProps {
  formData: PinFormData
  onChange: (data: Partial<PinFormData>) => void
  onSubmit: (data: PinFormData) => Promise<void>
  gpsStatus: GPSStatus
}

const GPS_STATUS_TEXT: Record<GPSStatus, string> = {
  idle: '',
  searching: 'Buscando ubicacion GPS...',
  found: 'Ubicacion GPS detectada',
  error: 'No se pudo obtener la ubicacion',
  denied: 'Permiso de ubicacion denegado',
}

const GPS_STATUS_COLOR: Record<GPSStatus, string> = {
  idle: '',
  searching: '#2563eb',
  found: '#16a34a',
  error: '#d97706',
  denied: '#dc2626',
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'

const labelClass = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

export default function PinForm({ formData, onChange, onSubmit, gpsStatus }: PinFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  const handleGetLocation = async () => {
    setGettingLocation(true)
    if (!navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador.')
      setGettingLocation(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        onChange({ lat: latitude, lng: longitude })
        setGettingLocation(false)
      },
      () => {
        setError('No se pudo obtener la ubicación. Verifica los permisos.')
        setGettingLocation(false)
      },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formData.nombre.trim()) {
      setError('El nombre es requerido.')
      return
    }
    if (formData.lat === 0 && formData.lng === 0) {
      setError('Selecciona una ubicacion en el mapa o espera la deteccion GPS.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3500)
    } catch {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCat = CATEGORIAS_LIST.find((c) => c.value === formData.categoria)

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* GPS status banner */}
      {gpsStatus !== 'idle' && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: GPS_STATUS_COLOR[gpsStatus] + '18',
            color: GPS_STATUS_COLOR[gpsStatus],
            border: `1px solid ${GPS_STATUS_COLOR[gpsStatus]}30`,
          }}
        >
          {gpsStatus === 'searching' && (
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                border: '2px solid currentColor',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                flexShrink: 0,
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          {gpsStatus !== 'searching' && (
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'currentColor',
                flexShrink: 0,
              }}
            />
          )}
          {GPS_STATUS_TEXT[gpsStatus]}
        </div>
      )}

      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Latitud</label>
          <input
            type="number"
            step="any"
            value={formData.lat !== 0 ? formData.lat : ''}
            onChange={(e) => onChange({ lat: parseFloat(e.target.value) || 0 })}
            placeholder="0.000000"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Longitud</label>
          <input
            type="number"
            step="any"
            value={formData.lng !== 0 ? formData.lng : ''}
            onChange={(e) => onChange({ lng: parseFloat(e.target.value) || 0 })}
            placeholder="0.000000"
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-slate-400 -mt-2 leading-relaxed">
        Haz clic en el mapa o arrastra el marcador para actualizar las coordenadas.
      </p>

      {/* Get location button */}
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={gettingLocation}
        className="w-full py-2 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
        style={{
          background: gettingLocation ? '#e2e8f0' : '#0f172a',
          color: gettingLocation ? '#64748b' : '#f1f5f9',
          cursor: gettingLocation ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!gettingLocation)
            (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'
        }}
        onMouseLeave={(e) => {
          if (!gettingLocation)
            (e.currentTarget as HTMLButtonElement).style.background = '#0f172a'
        }}
      >
        {gettingLocation ? (
          <>
            <span
              style={{
                width: 12,
                height: 12,
                border: '2px solid currentColor',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Obteniendo ubicación...
          </>
        ) : (
          <>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Obtener ubicación actual
          </>
        )}
      </button>

      {/* Name */}
      <div>
        <label className={labelClass}>
          Nombre <span className="text-red-400 normal-case font-normal">*</span>
        </label>
        <input
          type="text"
          value={formData.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          placeholder="Nombre del establecimiento"
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Descripcion</label>
        <textarea
          value={formData.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Descripcion del lugar, referencias, notas..."
          rows={3}
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </div>

      {/* Category */}
      <div>
        <label className={labelClass}>
          Categoria <span className="text-red-400 normal-case font-normal">*</span>
        </label>
        <div className="relative">
          <select
            value={formData.categoria}
            onChange={(e) => onChange({ categoria: e.target.value as Category })}
            className={`${inputClass} appearance-none pr-8 cursor-pointer`}
          >
            {CATEGORIAS_LIST.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {/* Chevron */}
          <svg
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Category badge preview */}
        {selectedCat && (
          <span
            className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: selectedCat.bgColor, color: selectedCat.color }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: selectedCat.color,
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {selectedCat.abbr}
            </span>
            {selectedCat.label}
          </span>
        )}
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-semibold flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Pin guardado correctamente.
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        style={{ background: submitting ? '#93c5fd' : '#1d4ed8' }}
        onMouseEnter={(e) => {
          if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#1e40af'
        }}
        onMouseLeave={(e) => {
          if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8'
        }}
      >
        {submitting ? 'Guardando...' : 'Guardar Pin'}
      </button>

      {/* Spin keyframe (injected inline) */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </form>
  )
}
