import type { Category } from './types'

export interface CategoryConfig {
  label: string
  abbr: string
  color: string
  bgColor: string
}

export const CATEGORIAS: Record<Category, CategoryConfig> = {
  vivienda: { label: 'Vivienda', abbr: 'V', color: '#16a34a', bgColor: '#dcfce7' },
  salud: { label: 'Salud', abbr: 'S', color: '#dc2626', bgColor: '#fee2e2' },
  educacion: { label: 'Educación', abbr: 'Ed', color: '#2563eb', bgColor: '#dbeafe' },
  comercio: { label: 'Comercio', abbr: 'Co', color: '#ea580c', bgColor: '#ffedd5' },
  entretenimiento: { label: 'Entretenimiento', abbr: 'En', color: '#0891b2', bgColor: '#cffafe' },
  cultura: { label: 'Cultura', abbr: 'Cu', color: '#7c3aed', bgColor: '#ede9fe' },
  industria: { label: 'Industria', abbr: 'In', color: '#475569', bgColor: '#e2e8f0' },
  agricola: { label: 'Agrícola', abbr: 'Ag', color: '#4d7c0f', bgColor: '#ecfccb' },
  otro: { label: 'Otro', abbr: 'Ot', color: '#6b7280', bgColor: '#f3f4f6' },
}

const LEGACY_CATEGORIES: Record<string, Category> = {
  hospital: 'salud',
  clinica: 'salud',
  escuela: 'educacion',
  restaurante: 'comercio',
  abasto: 'comercio',
  bodega: 'comercio',
  kiosko: 'comercio',
  centro_comercial: 'comercio',
  local_comercial: 'comercio',
  taller: 'comercio',
  garaje: 'comercio',
  hotel: 'comercio',
  posada: 'comercio',
  cancha_deportiva: 'entretenimiento',
  estadio: 'entretenimiento',
  centro_deportivo: 'entretenimiento',
  gimnasio: 'entretenimiento',
  auditorio: 'cultura',
  edificio: 'otro',
}

export function normalizeCategory(value: unknown): Category {
  if (typeof value !== 'string') return 'otro'
  const normalized = value.trim().toLowerCase()
  if (normalized in CATEGORIAS) return normalized as Category
  return LEGACY_CATEGORIES[normalized] ?? 'otro'
}

export function getCategoryConfig(value: unknown): CategoryConfig {
  return CATEGORIAS[normalizeCategory(value)]
}

export const CATEGORIAS_LIST = Object.entries(CATEGORIAS).map(([value, config]) => ({
  value: value as Category,
  ...config,
}))
