export type Category =
  | 'vivienda'
  | 'edificio'
  | 'hospital'
  | 'restaurante'
  | 'abasto'
  | 'clinica'
  | 'escuela'
  | 'cancha_deportiva'
  | 'auditorio'
  | 'estadio'
  | 'centro_deportivo'
  | 'gimnasio'
  | 'bodega'
  | 'kiosko'
  | 'centro_comercial'
  | 'local_comercial'
  | 'taller'
  | 'garaje'
  | 'hotel'
  | 'posada'
  | 'otro'

export interface Pin {
  id: string
  lat: number
  lng: number
  nombre: string
  descripcion: string
  categoria: Category
  creadoEn: string
}

export interface PinFormData {
  lat: number
  lng: number
  nombre: string
  descripcion: string
  categoria: Category
}
