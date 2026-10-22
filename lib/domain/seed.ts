import type { FieldDef, ModuleSchema } from './types'
import {
  ESTADOS_CONSTRUCCION,
  MATERIALES,
  USOS_ESPECIFICOS,
  USOS_GENERALES,
} from '@/lib/urban-options'

/**
 * Esquemas semilla de los tres módulos temáticos del plan.
 *
 * Las opciones de edificación se reutilizan de `lib/urban-options.ts` — la
 * fuente de verdad actual — para que el administrador de esquemas arranque
 * con exactamente las listas que ya valida el formulario en producción.
 */

function opciones(
  list: ReadonlyArray<{ readonly value: string; readonly label: string }>,
): string[] {
  return list.map((option) => option.label)
}

const SIN_DATO = 'Sin dato'

const EDIFICACION_CAMPOS: FieldDef[] = [
  { key: 'uso_general', label: 'Uso general', tipo: 'lista', opciones: opciones(USOS_GENERALES), orden: 1 },
  { key: 'uso_especifico', label: 'Uso específico', tipo: 'lista', opciones: opciones(USOS_ESPECIFICOS), orden: 2 },
  { key: 'pisos_construccion', label: 'Pisos de la construcción', tipo: 'entero', orden: 3 },
  { key: 'estado_construccion', label: 'Estado de la construcción', tipo: 'lista', opciones: opciones(ESTADOS_CONSTRUCCION), orden: 4 },
  { key: 'material', label: 'Material', tipo: 'lista', opciones: opciones(MATERIALES), orden: 5 },
  { key: 'hectareas_parcela', label: 'Hectáreas por parcela', tipo: 'decimal', orden: 6 },
  { key: 'metros_cuadrados_parcela', label: 'Metros cuadrados de la parcela', tipo: 'decimal', orden: 7 },
  { key: 'metros_cuadrados_manzana', label: 'Metros cuadrados de la manzana', tipo: 'decimal', orden: 8 },
  { key: 'poblacion_rango', label: 'Población', tipo: 'texto', orden: 9 },
]

const INFRAESTRUCTURA_CAMPOS: FieldDef[] = [
  {
    key: 'acueducto',
    label: 'Acueducto',
    tipo: 'lista',
    opciones: ['Conectado', 'No conectado', 'Parcial', SIN_DATO],
    orden: 1,
  },
  {
    key: 'drenaje',
    label: 'Drenaje',
    tipo: 'lista',
    opciones: ['A cielo abierto', 'Subterráneo', 'Mixto', SIN_DATO],
    orden: 2,
  },
  {
    key: 'cloaca',
    label: 'Cloacas',
    tipo: 'lista',
    opciones: ['Conectado', 'No conectado', 'Parcial', SIN_DATO],
    orden: 3,
  },
  {
    key: 'electricidad',
    label: 'Electricidad',
    tipo: 'lista',
    opciones: ['Conectado', 'No conectado', 'Parcial', SIN_DATO],
    orden: 4,
  },
]

const EQUIPAMIENTO_CAMPOS: FieldDef[] = [
  {
    key: 'equipamientos',
    label: 'Equipamiento urbano',
    tipo: 'lista',
    opciones: [
      'Escuela',
      'Comercio',
      'Parada',
      'Área recreativa',
      'Arborización',
      'Iglesia',
      'Estación de servicio',
      'Terminal',
      SIN_DATO,
    ],
    orden: 1,
  },
  {
    key: 'vialidad',
    label: 'Vialidad',
    tipo: 'lista',
    opciones: ['Asfalto', 'Adoquín', 'Tierra', 'Sin pavimento', SIN_DATO],
    orden: 2,
  },
  {
    key: 'telecomunicaciones',
    label: 'Telecomunicaciones',
    tipo: 'lista',
    opciones: [
      'Fibra óptica',
      'Cable coaxial',
      'Telefonía fija',
      'Banda ancha móvil',
      SIN_DATO,
    ],
    orden: 3,
  },
  {
    key: 'aseo_urbano',
    label: 'Aseo urbano',
    tipo: 'lista',
    opciones: ['Recolección municipal', 'Recolección privada', 'Sin servicio', SIN_DATO],
    orden: 4,
  },
]

/**
 * Esquemas semilla, listos para insertarse en la colección `schemas`.
 * `actualizadoPor` queda en `seed` hasta que un administrador los edite.
 */
export const SEED_SCHEMAS: ModuleSchema[] = [
  {
    moduleId: 'edificacion',
    modulo: 'edificacion',
    version: 1,
    campos: EDIFICACION_CAMPOS,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoPor: 'seed',
  },
  {
    moduleId: 'infraestructura',
    modulo: 'infraestructura',
    version: 1,
    campos: INFRAESTRUCTURA_CAMPOS,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoPor: 'seed',
  },
  {
    moduleId: 'equipamiento',
    modulo: 'equipamiento',
    version: 1,
    campos: EQUIPAMIENTO_CAMPOS,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoPor: 'seed',
  },
]

/**
 * Los siete servicios que el plan exige habilitar. La Fase 2 los pide
 * explícitamente: acueductos, drenajes, cloacas, electricidad, vialidad,
 * telecomunicaciones y aseo urbano.
 */
export const SERVICIOS_REQUERIDOS = [
  'acueducto',
  'drenaje',
  'cloaca',
  'electricidad',
  'vialidad',
  'telecomunicaciones',
  'aseo_urbano',
] as const
