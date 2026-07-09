import type { Category } from './types'

export interface CategoryConfig {
  label: string
  abbr: string
  color: string
  bgColor: string
}

export const CATEGORIAS: Record<Category, CategoryConfig> = {
  vivienda:         { label: 'Vivienda',           abbr: 'V',  color: '#16a34a', bgColor: '#dcfce7' },
  edificio:         { label: 'Edificio',            abbr: 'Ed', color: '#15803d', bgColor: '#bbf7d0' },
  hospital:         { label: 'Hospital',            abbr: 'H',  color: '#dc2626', bgColor: '#fee2e2' },
  restaurante:      { label: 'Restaurante',         abbr: 'R',  color: '#ea580c', bgColor: '#ffedd5' },
  abasto:           { label: 'Abasto',              abbr: 'Ab', color: '#d97706', bgColor: '#fef9c3' },
  clinica:          { label: 'Clínica',             abbr: 'Cl', color: '#b91c1c', bgColor: '#fecaca' },
  escuela:          { label: 'Escuela',             abbr: 'Es', color: '#1d4ed8', bgColor: '#dbeafe' },
  cancha_deportiva: { label: 'Cancha Deportiva',    abbr: 'C',  color: '#0891b2', bgColor: '#cffafe' },
  auditorio:        { label: 'Auditorio',           abbr: 'Au', color: '#b45309', bgColor: '#fef3c7' },
  estadio:          { label: 'Estadio',             abbr: 'St', color: '#0e7490', bgColor: '#e0f2fe' },
  centro_deportivo: { label: 'Centro Deportivo',    abbr: 'CD', color: '#0284c7', bgColor: '#e0f7fa' },
  gimnasio:         { label: 'Gimnasio',            abbr: 'G',  color: '#7c3aed', bgColor: '#ede9fe' },
  bodega:           { label: 'Bodega',              abbr: 'Bo', color: '#57534e', bgColor: '#f5f5f4' },
  kiosko:           { label: 'Kiosko',              abbr: 'K',  color: '#c2410c', bgColor: '#ffedd5' },
  centro_comercial: { label: 'Centro Comercial',    abbr: 'CC', color: '#7e22ce', bgColor: '#f3e8ff' },
  local_comercial:  { label: 'Local Comercial',     abbr: 'LC', color: '#6d28d9', bgColor: '#ede9fe' },
  taller:           { label: 'Taller',              abbr: 'T',  color: '#475569', bgColor: '#f1f5f9' },
  garaje:           { label: 'Garaje',              abbr: 'Gr', color: '#334155', bgColor: '#e2e8f0' },
  hotel:            { label: 'Hotel',               abbr: 'Ho', color: '#be185d', bgColor: '#fce7f3' },
  posada:           { label: 'Posada',              abbr: 'Po', color: '#9d174d', bgColor: '#fce7f3' },
  otro:             { label: 'Otro',                abbr: 'Ot', color: '#6b7280', bgColor: '#f3f4f6' },
}

export const CATEGORIAS_LIST = Object.entries(CATEGORIAS).map(([value, config]) => ({
  value: value as Category,
  ...config,
}))
