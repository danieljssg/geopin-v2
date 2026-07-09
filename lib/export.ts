import type { Pin } from './types'
import * as XLSX from 'xlsx'

export type ExportFormat = 'json' | 'csv' | 'excel'

export function generateFileName(format: ExportFormat): string {
  const timestamp = new Date().toISOString().split('T')[0]
  const ext = format === 'excel' ? 'xlsx' : format
  return `pins-${timestamp}.${ext}`
}

export function exportAsJSON(pins: Pin[]): void {
  const dataStr = JSON.stringify(pins, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  downloadFile(blob, generateFileName('json'))
}

export function exportAsCSV(pins: Pin[]): void {
  if (pins.length === 0) return

  const headers = ['ID', 'Nombre', 'Categoría', 'Descripción', 'Latitud', 'Longitud', 'Creado']
  const rows = pins.map((pin) => [
    pin.id,
    `"${pin.nombre.replace(/"/g, '""')}"`, // Escape quotes
    pin.categoria,
    `"${pin.descripcion.replace(/"/g, '""')}"`,
    pin.lat,
    pin.lng,
    pin.creadoEn,
  ])

  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, generateFileName('csv'))
}

export function exportAsExcel(pins: Pin[]): void {
  if (pins.length === 0) return

  const data = pins.map((pin) => ({
    ID: pin.id,
    Nombre: pin.nombre,
    Categoría: pin.categoria,
    Descripción: pin.descripcion,
    Latitud: pin.lat,
    Longitud: pin.lng,
    'Creado en': pin.creadoEn,
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pins')

  // Adjust column widths
  worksheet['!cols'] = [
    { wch: 10 }, // ID
    { wch: 20 }, // Nombre
    { wch: 18 }, // Categoría
    { wch: 30 }, // Descripción
    { wch: 12 }, // Latitud
    { wch: 12 }, // Longitud
    { wch: 19 }, // Creado en
  ]

  XLSX.writeFile(workbook, generateFileName('excel'))
}

function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
