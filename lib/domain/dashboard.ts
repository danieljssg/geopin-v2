import type { Parcela, ParcelaEstado } from './types'

/**
 * Análisis del levantamiento.
 *
 * Trabaja sobre `Parcela` del modelo v2, leyendo los datos de los módulos.
 * Es puro: la API le pasa las parcelas y devuelve los números, así que el
 * motor se prueba con datos conocidos y sin base de datos.
 *
 * Reemplaza a `lib/dashboard-analytics.ts`, que analiza el `Pin` plano del
 * prototipo. Los dos conviven hasta que el v1 se retire.
 */

/** Servicio del levantamiento y qué valores cuentan como cobertura. */
export interface ServicioDef {
  key: string
  moduleId: string
  label: string
  /** Valores que significan que la parcela tiene el servicio. */
  cubierto: readonly string[]
  /** Valores que significan que no lo tiene. */
  descubierto: readonly string[]
}

/**
 * Los siete servicios que el plan exige medir.
 *
 * La regla es explícita por servicio porque "cubierto" no significa lo mismo
 * en todos: en acueducto es "Conectado", en drenaje es que sea subterráneo,
 * en vialidad es que haya pavimento. Dejar todo lo que no es "Sin dato" como
 * cubierto haría que "A cielo abierto" contara como buena cobertura de
 * drenaje.
 */
export const SERVICIOS: readonly ServicioDef[] = [
  {
    key: 'acueducto',
    moduleId: 'infraestructura',
    label: 'Acueducto',
    cubierto: ['Conectado'],
    descubierto: ['No conectado'],
  },
  {
    key: 'drenaje',
    moduleId: 'infraestructura',
    label: 'Drenaje',
    cubierto: ['Subterráneo', 'Mixto'],
    descubierto: ['A cielo abierto'],
  },
  {
    key: 'cloaca',
    moduleId: 'infraestructura',
    label: 'Cloacas',
    cubierto: ['Conectado'],
    descubierto: ['No conectado'],
  },
  {
    key: 'electricidad',
    moduleId: 'infraestructura',
    label: 'Electricidad',
    cubierto: ['Conectado'],
    descubierto: ['No conectado'],
  },
  {
    key: 'vialidad',
    moduleId: 'equipamiento',
    label: 'Vialidad',
    cubierto: ['Asfalto', 'Adoquín'],
    descubierto: ['Tierra', 'Sin pavimento'],
  },
  {
    key: 'telecomunicaciones',
    moduleId: 'equipamiento',
    label: 'Telecomunicaciones',
    cubierto: ['Fibra óptica', 'Cable coaxial', 'Banda ancha móvil', 'Telefonía fija'],
    descubierto: [],
  },
  {
    key: 'aseo_urbano',
    moduleId: 'equipamiento',
    label: 'Aseo urbano',
    cubierto: ['Recolección municipal', 'Recolección privada'],
    descubierto: ['Sin servicio'],
  },
]

/** Valor que los esquemas semilla usan para "no se levantó este dato". */
export const SIN_DATO = 'Sin dato'

export interface ResumenLevantamiento {
  totalEsperado: number
  levantadas: number
  completadas: number
  pendientes: number
  enRevision: number
  /** Levantadas sobre el total esperado, en porcentaje. */
  avancePct: number
  /** Falta levantar, según el total esperado. */
  faltantes: number
}

/**
 * Resumen de avance.
 *
 * `totalEsperado` es lo que permite el "163 de 283" del plan. Si no se
 * declara, se usa la cantidad de parcelas levantadas y el avance queda en
 * 100%: sin un objetivo no hay contra qué medir.
 */
export function resumirLevantamiento(
  parcelas: readonly Parcela[],
  totalEsperado?: number,
): ResumenLevantamiento {
  const levantadas = parcelas.length
  const completadas = parcelas.filter((p) => p.estado === 'completa').length
  const pendientes = parcelas.filter((p) => p.estado === 'pendiente').length
  const enRevision = parcelas.filter((p) => p.estado === 'en_revision').length

  const esperado = totalEsperado && totalEsperado > 0 ? totalEsperado : levantadas
  const faltantes = Math.max(esperado - levantadas, 0)

  return {
    totalEsperado: esperado,
    levantadas,
    completadas,
    pendientes,
    enRevision,
    avancePct: esperado === 0 ? 0 : redondear((levantadas / esperado) * 100),
    faltantes,
  }
}

export interface CoberturaServicio {
  key: string
  label: string
  cubiertas: number
  descubiertas: number
  sinDato: number
  /** Parcelas que declararon algo sobre el servicio. */
  declaradas: number
  /** Cobertura sobre las declaradas, en porcentaje. */
  coberturaPct: number
  /** Déficit sobre las declaradas, en porcentaje. */
  deficitPct: number
  /** El servicio está por debajo del umbral de cobertura. */
  enDeficit: boolean
}

/** Cobertura mínima aceptable por servicio, en porcentaje. */
export const UMBRAL_COBERTURA_PCT = 80

function leerServicio(parcela: Parcela, servicio: ServicioDef): 'cubierta' | 'descubierta' | 'sin-dato' {
  const modulo = parcela.modulos?.[servicio.moduleId]
  const valor = modulo?.datos?.[servicio.key]

  if (typeof valor !== 'string') return 'sin-dato'

  const limpio = valor.trim()
  if (limpio === '' || limpio === SIN_DATO) return 'sin-dato'
  if (servicio.descubierto.includes(limpio)) return 'descubierta'
  if (servicio.cubierto.includes(limpio)) return 'cubierta'

  // Un valor que no está en ninguna lista es un dato nuevo del esquema: no
  // se inventa cobertura ni déficit.
  return 'sin-dato'
}

/**
 * Cobertura por servicio.
 *
 * La base del porcentaje son las parcelas **declaradas**, no el total: si de
 * 283 parcelas solo 40 declararon el acueducto, decir "14% de cobertura"
 * sería engañoso. El porcentaje dice "de las que sabemos, cuántas tienen el
 * servicio", y `sinDato` queda aparte para que se vea cuánto falta levantar.
 */
export function coberturaServicios(
  parcelas: readonly Parcela[],
  umbralPct: number = UMBRAL_COBERTURA_PCT,
): CoberturaServicio[] {
  return SERVICIOS.map((servicio) => {
    let cubiertas = 0
    let descubiertas = 0
    let sinDato = 0

    for (const parcela of parcelas) {
      const estado = leerServicio(parcela, servicio)
      if (estado === 'cubierta') cubiertas += 1
      else if (estado === 'descubierta') descubiertas += 1
      else sinDato += 1
    }

    const declaradas = cubiertas + descubiertas
    const coberturaPct = declaradas === 0 ? 0 : redondear((cubiertas / declaradas) * 100)

    return {
      key: servicio.key,
      label: servicio.label,
      cubiertas,
      descubiertas,
      sinDato,
      declaradas,
      coberturaPct,
      deficitPct: declaradas === 0 ? 0 : redondear((descubiertas / declaradas) * 100),
      // Sin datos no se declara déficit: no se puede afirmar que falte un
      // servicio que nadie relevó.
      enDeficit: declaradas > 0 && coberturaPct < umbralPct,
    }
  })
}

export interface EquipamientoResumen {
  tipo: string
  cantidad: number
  /** Parcelas por unidad de equipamiento. `null` si no hay ninguna. */
  parcelasPorUnidad: number | null
  saturado: boolean
}

/**
 * Umbral de saturación: parcelas por unidad de equipamiento.
 *
 * Es una heurística declarada, no una norma urbanística. Sirve para que el
 * dashboard marque "hay muchas parcelas para las escuelas que hay" sin
 * pretender reemplazar el cálculo normativo del municipio.
 */
export const UMBRAL_PARCELAS_POR_EQUIPAMIENTO = 100

/** Conteo de equipamiento urbano y saturación por tipo. */
export function equipamientoResumen(
  parcelas: readonly Parcela[],
  umbral: number = UMBRAL_PARCELAS_POR_EQUIPAMIENTO,
): EquipamientoResumen[] {
  const conteo = new Map<string, number>()

  for (const parcela of parcelas) {
    const valor = parcela.modulos?.equipamiento?.datos?.equipamientos
    if (typeof valor !== 'string') continue
    const tipo = valor.trim()
    if (tipo === '' || tipo === SIN_DATO) continue
    conteo.set(tipo, (conteo.get(tipo) ?? 0) + 1)
  }

  return [...conteo.entries()]
    .map(([tipo, cantidad]) => {
      const parcelasPorUnidad = cantidad === 0 ? null : redondear(parcelas.length / cantidad, 1)
      return {
        tipo,
        cantidad,
        parcelasPorUnidad,
        saturado: parcelasPorUnidad !== null && parcelasPorUnidad > umbral,
      }
    })
    .sort((a, b) => b.cantidad - a.cantidad)
}

export interface DensidadCelda {
  lat: number
  lng: number
  count: number
}

/**
 * Celdas de densidad para el mapa de calor.
 *
 * Se agrupan las parcelas en una grilla de `cellDegrees` y se devuelve el
 * centroide de cada celda con su conteo. Es un mapa de calor sin plugin: con
 * menos de 500 parcelas, un círculo por celda cuyo radio y opacidad dependen
 * del conteo se lee igual de bien que un heatmap interpolado, y no suma una
 * dependencia.
 *
 * `cellDegrees` de 0,001° son unos 111 m en latitud: una manzana.
 */
export function densidadCeldas(
  parcelas: readonly Parcela[],
  cellDegrees = 0.001,
): DensidadCelda[] {
  if (cellDegrees <= 0) return []

  const celdas = new Map<string, { sumLat: number; sumLng: number; count: number }>()

  for (const parcela of parcelas) {
    const [lng, lat] = parcela.ubicacion.coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const keyLat = Math.floor(lat / cellDegrees)
    const keyLng = Math.floor(lng / cellDegrees)
    const key = `${keyLat}:${keyLng}`

    const actual = celdas.get(key) ?? { sumLat: 0, sumLng: 0, count: 0 }
    actual.sumLat += lat
    actual.sumLng += lng
    actual.count += 1
    celdas.set(key, actual)
  }

  return [...celdas.values()].map((celda) => ({
    lat: celda.sumLat / celda.count,
    lng: celda.sumLng / celda.count,
    count: celda.count,
  }))
}

/** Distribución por estado, para las tarjetas del dashboard. */
export function distribucionEstados(parcelas: readonly Parcela[]): Array<{
  estado: ParcelaEstado
  label: string
  cantidad: number
}> {
  const etiquetas: Record<ParcelaEstado, string> = {
    pendiente: 'Pendientes',
    completa: 'Completas',
    en_revision: 'En revisión',
  }

  return (['completa', 'pendiente', 'en_revision'] as ParcelaEstado[]).map((estado) => ({
    estado,
    label: etiquetas[estado],
    cantidad: parcelas.filter((p) => p.estado === estado).length,
  }))
}

function redondear(valor: number, decimales = 1): number {
  const factor = 10 ** decimales
  return Math.round(valor * factor) / factor
}
