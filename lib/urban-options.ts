export const USOS_GENERALES = [
  { value: 'residencial', label: 'Residencial' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'equipamiento', label: 'Equipamiento' },
  { value: 'espacio público', label: 'Espacio público' },
  { value: 'infraestructura', label: 'Infraestructura' },
  { value: 'sin uso', label: 'Sin uso' },
] as const

export const USOS_ESPECIFICOS = [
  { value: 'unifamiliar', label: 'Unifamiliar' },
  { value: 'bifamiliar', label: 'Bifamiliar' },
  { value: 'multifamiliar', label: 'Multifamiliar' },
  { value: 'comercio formal', label: 'Comercio formal' },
  { value: 'comercio informal', label: 'Comercio informal' },
  { value: 'asistencial', label: 'Asistencial' },
  { value: 'educativo', label: 'Educativo' },
  { value: 'recreación y deportivo', label: 'Recreación y deportivo' },
  { value: 'área verde', label: 'Área verde' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'seguridad y administrativo', label: 'Seguridad y administrativo' },
] as const

export const ESTADOS_CONSTRUCCION = [
  { value: 'excelente', label: 'Excelente' },
  { value: 'bueno', label: 'Bueno' },
  { value: 'regular', label: 'Regular' },
  { value: 'en obra', label: 'En obra' },
  { value: 'malo', label: 'Malo' },
] as const

export const MATERIALES = [
  { value: 'bloque', label: 'Bloque' },
  { value: 'láminas de zinc', label: 'Láminas de zinc' },
  { value: 'madera', label: 'Madera' },
  { value: 'adobe', label: 'Adobe' },
] as const

export type UsoGeneral = (typeof USOS_GENERALES)[number]['value']
export type UsoEspecifico = (typeof USOS_ESPECIFICOS)[number]['value']
export type EstadoConstruccion = (typeof ESTADOS_CONSTRUCCION)[number]['value']
export type Material = (typeof MATERIALES)[number]['value']

export interface UrbanData {
  usoGeneral?: UsoGeneral
  usoEspecifico?: UsoEspecifico
  pisosConstruccion?: number
  estadoConstruccion?: EstadoConstruccion
  material?: Material
  hectareasParcela?: number
  poblacion?: number
  drenaje?: string
  metrosCuadradosParcela?: number
  metrosCuadradosManzana?: number
}

type UrbanOption = { readonly value: string; readonly label: string }

export function getOptionLabel(
  options: readonly UrbanOption[],
  value: string | undefined,
): string | undefined {
  return value ? options.find((option) => option.value === value)?.label : undefined
}

export function getUrbanDetails(data: UrbanData): Array<{ label: string; value: string }> {
  const details = [
    { label: 'Uso general', value: getOptionLabel(USOS_GENERALES, data.usoGeneral) },
    { label: 'Uso específico', value: getOptionLabel(USOS_ESPECIFICOS, data.usoEspecifico) },
    {
      label: 'Pisos de la construcción',
      value: data.pisosConstruccion?.toLocaleString('es-VE'),
    },
    {
      label: 'Estado de la construcción',
      value: getOptionLabel(ESTADOS_CONSTRUCCION, data.estadoConstruccion),
    },
    { label: 'Material', value: getOptionLabel(MATERIALES, data.material) },
    {
      label: 'Hectáreas por parcela',
      value:
        data.hectareasParcela === undefined
          ? undefined
          : `${data.hectareasParcela.toLocaleString('es-VE')} ha`,
    },
    {
      label: 'Población',
      value: data.poblacion?.toLocaleString('es-VE'),
    },
    { label: 'Drenaje', value: data.drenaje?.trim() || undefined },
    {
      label: 'Metros cuadrados de la parcela',
      value:
        data.metrosCuadradosParcela === undefined
          ? undefined
          : `${data.metrosCuadradosParcela.toLocaleString('es-VE')} m²`,
    },
    {
      label: 'Metros cuadrados de la manzana',
      value:
        data.metrosCuadradosManzana === undefined
          ? undefined
          : `${data.metrosCuadradosManzana.toLocaleString('es-VE')} m²`,
    },
  ]

  return details.filter((detail): detail is { label: string; value: string } => Boolean(detail.value))
}
