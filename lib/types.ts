import type { UrbanData } from './urban-options'

export type Category =
  | 'vivienda'
  | 'salud'
  | 'educacion'
  | 'comercio'
  | 'entretenimiento'
  | 'cultura'
  | 'industria'
  | 'agricola'
  | 'otro'

export interface Pin extends UrbanData {
  id: string
  lat: number
  lng: number
  nombre: string
  descripcion: string
  categoria: string
  creadoEn: string
}
