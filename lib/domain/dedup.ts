import type { Parcela } from './types'

/**
 * Detección de duplicados por proximidad geográfica.
 *
 * El plan pide un buffer de 2 metros: dos registros a menos de 2 metros son
 * la misma parcela capturada dos veces.
 *
 * El buffer se calcula **en la aplicación** y no con un `ST_BUFFER` de la
 * base: Cosmos no lo tiene. La distancia se mide sobre la esfera con la
 * fórmula de Haversine, que a escala de parcela tiene un error de menos de
 * un centímetro.
 */

/** Buffer del plan, en metros. */
export const BUFFER_DUPLICADOS_M = 2

/** Radio medio de la Tierra, en metros (IUGN). */
const RADIO_TIERRA_M = 6_371_008.8

export interface Punto {
  lat: number
  lng: number
}

/** Distancia en metros entre dos puntos, por Haversine. */
export function distanciaMetros(a: Punto, b: Punto): number {
  const aRad = (a.lat * Math.PI) / 180
  const bRad = (b.lat * Math.PI) / 180
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(aRad) * Math.cos(bRad) * Math.sin(deltaLng / 2) ** 2

  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface DuplicadoCandidato {
  /** Clave estable del grupo. */
  clave: string
  /** Ids de las parcelas del grupo, en orden. */
  ids: string[]
  /** Distancia entre las dos más cercanas del grupo. */
  distanciaM: number
  /** Por qué se consideran duplicadas. */
  motivo: 'proximidad' | 'codigo'
}

/**
 * Agrupa registros que están a menos de `bufferM` metros.
 *
 * La agrupación es **transitiva**: si A está a 1,5 m de B y B está a 1,5 m
 * de C, los tres son un solo grupo aunque A y C estén a 3 m. Es lo que
 * corresponde: si dos personas capturaron la misma esquina desde lados
 * distintos, las tres lecturas son la misma parcela.
 */
export function detectarDuplicados(
  parcelas: readonly Parcela[],
  bufferM: number = BUFFER_DUPLICADOS_M,
): DuplicadoCandidato[] {
  const grupos = new Map<number, number[]>()

  //.Union-find por índice: permite la transitividad sin repetir comparaciones.
  const padre = parcelas.map((_, indice) => indice)
  const buscar = (indice: number): number => {
    let raiz = indice
    while (padre[raiz] !== raiz) raiz = padre[raiz]
    while (padre[indice] !== raiz) {
      const siguiente = padre[indice]
      padre[indice] = raiz
      indice = siguiente
    }
    return raiz
  }
  const unir = (a: number, b: number): void => {
    const raizA = buscar(a)
    const raizB = buscar(b)
    if (raizA !== raizB) padre[raizB] = raizA
  }

  for (let i = 0; i < parcelas.length; i += 1) {
    for (let j = i + 1; j < parcelas.length; j += 1) {
      const distancia = distanciaMetros(
        { lat: parcelas[i].ubicacion.coordinates[1], lng: parcelas[i].ubicacion.coordinates[0] },
        { lat: parcelas[j].ubicacion.coordinates[1], lng: parcelas[j].ubicacion.coordinates[0] },
      )
      if (distancia <= bufferM) unir(i, j)
    }
  }

  const porRaiz = new Map<number, number[]>()
  for (let i = 0; i < parcelas.length; i += 1) {
    const raiz = buscar(i)
    const grupo = porRaiz.get(raiz) ?? []
    grupo.push(i)
    porRaiz.set(raiz, grupo)
  }

  const candidatos: DuplicadoCandidato[] = []

  for (const grupo of porRaiz.values()) {
    if (grupo.length < 2) continue

    const indices = [...grupo].sort((a, b) => a - b)
    const ids = indices.map((indice) => parcelas[indice].id)

    let menor = Number.POSITIVE_INFINITY
    for (let i = 0; i < indices.length - 1; i += 1) {
      for (let j = i + 1; j < indices.length; j += 1) {
        const distancia = distanciaMetros(
          { lat: parcelas[indices[i]].ubicacion.coordinates[1], lng: parcelas[indices[i]].ubicacion.coordinates[0] },
          { lat: parcelas[indices[j]].ubicacion.coordinates[1], lng: parcelas[indices[j]].ubicacion.coordinates[0] },
        )
        if (distancia < menor) menor = distancia
      }
    }

    candidatos.push({
      clave: ids.join('|'),
      ids,
      distanciaM: Math.round(menor * 100) / 100,
      motivo: 'proximidad',
    })
  }

  return candidatos.sort((a, b) => a.distanciaM - b.distanciaM)
}

/**
 * Detecta duplicados por código de parcela.
 *
 * El código es la identidad catastral: dos registros con el mismo código son
 * la misma parcela, estén donde estén.
 */
export function detectarDuplicadosPorCodigo(
  parcelas: readonly Parcela[],
): DuplicadoCandidato[] {
  const porCodigo = new Map<string, string[]>()

  for (const parcela of parcelas) {
    const codigo = parcela.codigo?.trim().toUpperCase()
    if (!codigo) continue

    const grupo = porCodigo.get(codigo) ?? []
    grupo.push(parcela.id)
    porCodigo.set(codigo, grupo)
  }

  return [...porCodigo.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([codigo, ids]) => ({
      clave: `codigo:${codigo}`,
      ids: [...ids].sort(),
      distanciaM: 0,
      motivo: 'codigo' as const,
    }))
}

/** Los dos tipos de duplicado, juntos. */
export function detectarDuplicadosTotales(
  parcelas: readonly Parcela[],
  bufferM: number = BUFFER_DUPLICADOS_M,
): DuplicadoCandidato[] {
  return [
    ...detectarDuplicadosPorCodigo(parcelas),
    ...detectarDuplicados(parcelas, bufferM),
  ]
}
