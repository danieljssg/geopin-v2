'use client'

import { useId, useState } from 'react'
import type { PinFormData, Category } from '@/lib/types'
import { CATEGORIAS_LIST } from '@/lib/categories'
import {
  ESTADOS_CONSTRUCCION,
  MATERIALES,
  USOS_ESPECIFICOS,
  USOS_GENERALES,
  type EstadoConstruccion,
  type Material,
  type UsoEspecifico,
  type UsoGeneral,
} from '@/lib/urban-options'

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

interface SelectFieldProps {
  id: string
  label: string
  value: string | undefined
  options: readonly { readonly value: string; readonly label: string }[]
  onChange: (value: string | undefined) => void
}

function SelectField({ id, label, value, options, onChange }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={`${inputClass} appearance-none pr-8 cursor-pointer`}
        >
          <option value="">Seleccionar...</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}

interface NumberFieldProps {
  id: string
  label: string
  value: number | undefined
  step: number | 'any'
  invalid: boolean
  onChange: (value: number | undefined) => void
}

function NumberField({ id, label, value, step, invalid, onChange }: NumberFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(Number.isNaN(e.target.valueAsNumber) ? undefined : e.target.valueAsNumber)}
        aria-invalid={invalid}
        className={inputClass}
      />
    </div>
  )
}

export default function PinForm({ formData, onChange, onSubmit, gpsStatus }: PinFormProps) {
  const idPrefix = useId()
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<{ message: string; fieldId?: string } | null>(null)

  const ids = {
    lat: `${idPrefix}-lat`,
    lng: `${idPrefix}-lng`,
    coordinatesHint: `${idPrefix}-coordinates-hint`,
    nombre: `${idPrefix}-nombre`,
    descripcion: `${idPrefix}-descripcion`,
    categoria: `${idPrefix}-categoria`,
    usoGeneral: `${idPrefix}-uso-general`,
    usoEspecifico: `${idPrefix}-uso-especifico`,
    pisosConstruccion: `${idPrefix}-pisos-construccion`,
    estadoConstruccion: `${idPrefix}-estado-construccion`,
    material: `${idPrefix}-material`,
    hectareasParcela: `${idPrefix}-hectareas-parcela`,
    poblacion: `${idPrefix}-poblacion`,
    drenaje: `${idPrefix}-drenaje`,
    metrosCuadradosParcela: `${idPrefix}-metros-cuadrados-parcela`,
    metrosCuadradosManzana: `${idPrefix}-metros-cuadrados-manzana`,
  }

  function showError(message: string, fieldId?: string) {
    setError({ message, fieldId })
    if (fieldId) requestAnimationFrame(() => document.getElementById(fieldId)?.focus())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formData.nombre.trim()) {
      showError('El nombre es requerido.', ids.nombre)
      return
    }
    if (formData.lat === 0 && formData.lng === 0) {
      showError('Selecciona una ubicación en el mapa o espera la detección GPS.', ids.lat)
      return
    }
    if (
      formData.pisosConstruccion !== undefined &&
      (!Number.isInteger(formData.pisosConstruccion) || formData.pisosConstruccion < 0)
    ) {
      showError('Los pisos de la construcción deben ser un número entero no negativo.', ids.pisosConstruccion)
      return
    }
    if (
      formData.poblacion !== undefined &&
      (!Number.isInteger(formData.poblacion) || formData.poblacion < 0)
    ) {
      showError('La población debe ser un número entero no negativo.', ids.poblacion)
      return
    }

    const decimalFields = [
      [formData.hectareasParcela, ids.hectareasParcela, 'Las hectáreas por parcela'],
      [formData.metrosCuadradosParcela, ids.metrosCuadradosParcela, 'Los metros cuadrados de la parcela'],
      [formData.metrosCuadradosManzana, ids.metrosCuadradosManzana, 'Los metros cuadrados de la manzana'],
    ] as const

    for (const [value, fieldId, label] of decimalFields) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        showError(`${label} deben ser un número no negativo.`, fieldId)
        return
      }
    }

    setSubmitting(true)
    try {
      await onSubmit(formData)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3500)
    } catch {
      showError('Error al guardar. Intenta de nuevo.')
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
          role="status"
          aria-live="polite"
          style={{
            backgroundColor: GPS_STATUS_COLOR[gpsStatus] + '18',
            color: GPS_STATUS_COLOR[gpsStatus],
            border: `1px solid ${GPS_STATUS_COLOR[gpsStatus]}30`,
          }}
        >
          {gpsStatus === 'searching' && (
            <span
              className="status-spinner"
              aria-hidden="true"
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
              aria-hidden="true"
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
          <label htmlFor={ids.lat} className={labelClass}>Latitud</label>
          <input
            id={ids.lat}
            type="number"
            step="any"
            value={formData.lat !== 0 ? formData.lat : ''}
            onChange={(e) => onChange({ lat: parseFloat(e.target.value) || 0 })}
            placeholder="0.000000"
            aria-describedby={ids.coordinatesHint}
            aria-invalid={error?.fieldId === ids.lat}
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label htmlFor={ids.lng} className={labelClass}>Longitud</label>
          <input
            id={ids.lng}
            type="number"
            step="any"
            value={formData.lng !== 0 ? formData.lng : ''}
            onChange={(e) => onChange({ lng: parseFloat(e.target.value) || 0 })}
            placeholder="0.000000"
            aria-describedby={ids.coordinatesHint}
            className={`${inputClass} font-mono`}
          />
        </div>
      </div>

      {/* Hint */}
      <p id={ids.coordinatesHint} className="text-xs text-slate-400 -mt-2 leading-relaxed">
        Haz clic en el mapa o arrastra el marcador para actualizar las coordenadas.
      </p>

      {/* Name */}
      <div>
        <label htmlFor={ids.nombre} className={labelClass}>
          Nombre <span className="text-red-400 normal-case font-normal">*</span>
        </label>
        <input
          id={ids.nombre}
          type="text"
          value={formData.nombre}
          onChange={(e) => onChange({ nombre: e.target.value })}
          placeholder="Nombre del establecimiento"
          required
          aria-invalid={error?.fieldId === ids.nombre}
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor={ids.descripcion} className={labelClass}>Descripción / notas adicionales</label>
        <textarea
          id={ids.descripcion}
          value={formData.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Descripción del lugar, referencias, notas..."
          rows={3}
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor={ids.categoria} className={labelClass}>
          Categoría <span className="text-red-400 normal-case font-normal">*</span>
        </label>
        <div className="relative">
          <select
            id={ids.categoria}
            value={formData.categoria}
            onChange={(e) => onChange({ categoria: e.target.value as Category })}
            className={`${inputClass} appearance-none pr-8 cursor-pointer`}
            required
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
            aria-hidden="true"
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

      <fieldset className="flex flex-col gap-4 rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-xs font-bold text-slate-600 uppercase tracking-widest">
          Clasificación urbanística
        </legend>

        <div className="grid grid-cols-1 gap-3">
          <SelectField
            id={ids.usoGeneral}
            label="Uso general"
            value={formData.usoGeneral}
            options={USOS_GENERALES}
            onChange={(value) => onChange({ usoGeneral: value as UsoGeneral | undefined })}
          />
          <SelectField
            id={ids.usoEspecifico}
            label="Uso específico"
            value={formData.usoEspecifico}
            options={USOS_ESPECIFICOS}
            onChange={(value) => onChange({ usoEspecifico: value as UsoEspecifico | undefined })}
          />
        </div>

        <div className="grid grid-cols-2 items-end gap-3">
          <NumberField
            id={ids.pisosConstruccion}
            label="Pisos de la construcción"
            value={formData.pisosConstruccion}
            step={1}
            invalid={error?.fieldId === ids.pisosConstruccion}
            onChange={(value) => onChange({ pisosConstruccion: value })}
          />
          <NumberField
            id={ids.poblacion}
            label="Población"
            value={formData.poblacion}
            step={1}
            invalid={error?.fieldId === ids.poblacion}
            onChange={(value) => onChange({ poblacion: value })}
          />
        </div>

        <SelectField
          id={ids.estadoConstruccion}
          label="Estado de la construcción"
          value={formData.estadoConstruccion}
          options={ESTADOS_CONSTRUCCION}
          onChange={(value) => onChange({ estadoConstruccion: value as EstadoConstruccion | undefined })}
        />
        <SelectField
          id={ids.material}
          label="Material"
          value={formData.material}
          options={MATERIALES}
          onChange={(value) => onChange({ material: value as Material | undefined })}
        />

        <div className="grid grid-cols-2 items-end gap-3">
          <NumberField
            id={ids.hectareasParcela}
            label="Hectáreas por parcela"
            value={formData.hectareasParcela}
            step="any"
            invalid={error?.fieldId === ids.hectareasParcela}
            onChange={(value) => onChange({ hectareasParcela: value })}
          />
          <NumberField
            id={ids.metrosCuadradosParcela}
            label="m² de la parcela"
            value={formData.metrosCuadradosParcela}
            step="any"
            invalid={error?.fieldId === ids.metrosCuadradosParcela}
            onChange={(value) => onChange({ metrosCuadradosParcela: value })}
          />
        </div>

        <NumberField
          id={ids.metrosCuadradosManzana}
          label="m² de la manzana"
          value={formData.metrosCuadradosManzana}
          step="any"
          invalid={error?.fieldId === ids.metrosCuadradosManzana}
          onChange={(value) => onChange({ metrosCuadradosManzana: value })}
        />

        <div>
          <label htmlFor={ids.drenaje} className={labelClass}>Drenaje</label>
          <input
            id={ids.drenaje}
            type="text"
            value={formData.drenaje ?? ''}
            onChange={(e) => onChange({ drenaje: e.target.value || undefined })}
            placeholder="Información sobre el drenaje"
            className={inputClass}
          />
        </div>
      </fieldset>

      {/* Feedback messages */}
      {error && (
        <div
          className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
          role="alert"
        >
          {error.message}
        </div>
      )}
      {success && (
        <div
          className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-semibold flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
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
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.status-spinner{animation:none!important}}`}</style>
    </form>
  )
}
