import type { Pin } from './types'
import { normalizeCategory } from './categories'
import {
  ESTADOS_CONSTRUCCION,
  MATERIALES,
  USOS_ESPECIFICOS,
  USOS_GENERALES,
  getOptionLabel,
  parsePoblacionRango,
} from './urban-options'
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

  const headers = [
    'ID',
    'Nombre',
    'Categoría',
    'Descripción',
    'Uso general',
    'Uso específico',
    'Pisos de la construcción',
    'Estado de la construcción',
    'Material',
    'Hectáreas por parcela',
    'Población (rango)',
    'Población (promedio)',
    'Drenaje',
    'Metros cuadrados de la parcela',
    'Metros cuadrados de la manzana',
    'Latitud',
    'Longitud',
    'Creado',
  ]
  const rows = pins.map((pin) => [
    pin.id,
    pin.nombre,
    normalizeCategory(pin.categoria),
    pin.descripcion ?? '',
    getOptionLabel(USOS_GENERALES, pin.usoGeneral) ?? '',
    getOptionLabel(USOS_ESPECIFICOS, pin.usoEspecifico) ?? '',
    pin.pisosConstruccion ?? '',
    getOptionLabel(ESTADOS_CONSTRUCCION, pin.estadoConstruccion) ?? '',
    getOptionLabel(MATERIALES, pin.material) ?? '',
    pin.hectareasParcela ?? '',
    pin.poblacionRango ?? '',
    pin.poblacionPromedio ?? parsePoblacionRango(pin.poblacionRango)?.promedio ?? pin.poblacion ?? '',
    pin.drenaje ?? '',
    pin.metrosCuadradosParcela ?? '',
    pin.metrosCuadradosManzana ?? '',
    pin.lat,
    pin.lng,
    pin.creadoEn,
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, generateFileName('csv'))
}

export function exportAsExcel(pins: Pin[]): void {
  if (pins.length === 0) return

  const data = pins.map((pin) => ({
    ID: pin.id,
    Nombre: pin.nombre,
    Categoría: normalizeCategory(pin.categoria),
    Descripción: pin.descripcion,
    'Uso general': getOptionLabel(USOS_GENERALES, pin.usoGeneral) ?? '',
    'Uso específico': getOptionLabel(USOS_ESPECIFICOS, pin.usoEspecifico) ?? '',
    'Pisos de la construcción': pin.pisosConstruccion ?? '',
    'Estado de la construcción': getOptionLabel(ESTADOS_CONSTRUCCION, pin.estadoConstruccion) ?? '',
    Material: getOptionLabel(MATERIALES, pin.material) ?? '',
    'Hectáreas por parcela': pin.hectareasParcela ?? '',
    'Población (rango)': pin.poblacionRango ?? '',
    'Población (promedio)':
      pin.poblacionPromedio ?? parsePoblacionRango(pin.poblacionRango)?.promedio ?? pin.poblacion ?? '',
    Drenaje: pin.drenaje ?? '',
    'Metros cuadrados de la parcela': pin.metrosCuadradosParcela ?? '',
    'Metros cuadrados de la manzana': pin.metrosCuadradosManzana ?? '',
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
    { wch: 20 }, // Uso general
    { wch: 26 }, // Uso específico
    { wch: 24 }, // Pisos de la construcción
    { wch: 27 }, // Estado de la construcción
    { wch: 18 }, // Material
    { wch: 23 }, // Hectáreas por parcela
    { wch: 20 }, // Población (rango)
    { wch: 24 }, // Población (promedio)
    { wch: 24 }, // Drenaje
    { wch: 32 }, // Metros cuadrados de la parcela
    { wch: 32 }, // Metros cuadrados de la manzana
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
