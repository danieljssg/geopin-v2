'use client'

import { useState } from 'react'
import type { Pin } from '@/lib/types'
import { CATEGORIAS } from '@/lib/categories'
import { getUrbanDetails } from '@/lib/urban-options'
import ExportModal from './ExportModal'

interface PinsListProps {
  pins: Pin[]
  onDelete: (id: string) => void
  onExport: () => void
  onExportStart?: () => void
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function PinsList({ pins, onDelete, onExport, onExportStart }: PinsListProps) {
  const [showExportModal, setShowExportModal] = useState(false)

  const handleOpenExport = () => {
    onExportStart?.()
    setShowExportModal(true)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Pins guardados ({pins.length})
        </h2>
        {pins.length > 0 && (
          <button
            type="button"
            onClick={handleOpenExport}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            title="Elegir formato de exportación"
          >
            <DownloadIcon />
            Exportar
          </button>
        )}
      </div>

      {/* Empty state */}
      {pins.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            No hay pins guardados aun.
            <br />
            Marca una ubicacion y guardala.
          </p>
        </div>
      )}

      {/* List */}
      {pins.length > 0 && (
        <ul className="flex flex-col gap-2" role="list">
          {pins.map((pin) => {
            const cat = CATEGORIAS[pin.categoria]
            const urbanDetails = getUrbanDetails(pin)
            return (
              <li
                key={pin.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
              >
                {/* Category dot */}
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                  style={{
                    width: 30,
                    height: 30,
                    background: cat.color,
                    fontSize: cat.abbr.length > 2 ? 8 : cat.abbr.length > 1 ? 9 : 12,
                    marginTop: 1,
                  }}
                  aria-hidden="true"
                >
                  {cat.abbr}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                      {pin.nombre}
                    </span>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0"
                      style={{ backgroundColor: cat.bgColor, color: cat.color }}
                    >
                      {cat.label}
                    </span>
                  </div>

                  {pin.descripcion && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-1">
                      {pin.descripcion}
                    </p>
                  )}

                  {urbanDetails.length > 0 && (
                    <details className="mb-1 text-xs text-slate-600">
                      <summary className="cursor-pointer rounded py-1 font-medium text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                        Ver datos urbanísticos
                      </summary>
                      <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-l-2 border-slate-100 pl-2">
                        {urbanDetails.map((detail) => (
                          <div key={detail.label} className="contents">
                            <dt className="text-slate-500">{detail.label}</dt>
                            <dd className="text-right font-medium text-slate-700">{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}

                  <p className="text-xs font-mono text-slate-400">
                    {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">{formatDate(pin.creadoEn)}</p>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onDelete(pin.id)}
                  className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors p-1 rounded"
                  aria-label={`Eliminar ${pin.nombre}`}
                  title="Eliminar pin"
                >
                  <TrashIcon />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Export Modal */}
      <ExportModal isOpen={showExportModal} pins={pins} onClose={() => setShowExportModal(false)} />
    </div>
  )
}
