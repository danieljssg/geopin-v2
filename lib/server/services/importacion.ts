import * as XLSX from 'xlsx'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import { parseCSV } from '@/lib/domain/csv'
import {
  claveDeIdempotencia,
  filaAParcela,
  mapearEncabezados,
  mapearFila,
} from '@/lib/domain/import'
import {
  BUFFER_DUPLICADOS_M,
  detectarDuplicadosPorCodigo,
  distanciaMetros,
  type DuplicadoCandidato,
} from '@/lib/domain/dedup'
import { aplicarCambios, proponerMerge, type CampoEnConflicto } from '@/lib/domain/merge'
import type { Parcela } from '@/lib/domain/types'
import { findParcelasParaDashboard } from '../repositories/levantamientos'
import { findParcela, saveParcela } from '../repositories/parcelas'

/**
 * Importación de archivos de campo.
 *
 * El flujo tiene dos pasos y una regla que no se negocia:
 *
 * 1. **Previsualización.** Se analiza el archivo y se reporta qué se crearía,
 *    qué actualizará, qué son duplicados y qué tiene errores. **No se
 *    escribe nada.**
 * 2. **Aplicación.** Solo se crean las parcelas nuevas. Las que ya existen
 *    **no se sobrescriben**: sus diferencias quedan como conflictos para que
 *    el administrador resuelva campo por campo.
 *
 * Esa regla es la que hace segura la importación: reimportar el mismo
 * archivo no duplica nada, y cruzar dos archivos de、设备 distintos no pisa
 * el trabajo del otro.
 */

export type AccionFila = 'nueva' | 'actualizada' | 'duplicada' | 'error'

export interface FilaAnalizada {
  fila: number
  accion: AccionFila
  codigo?: string
  nombre?: string
  errores: string[]
  conflictos: CampoEnConflicto[]
  /** Id de la parcela que ya existe con ese código. */
  parcelaExistenteId?: string
}

export interface ResultadoImportacion {
  resumen: {
    filas: number
    nuevas: number
    actualizadas: number
    duplicadas: number
    conErrores: number
  }
  filas: FilaAnalizada[]
  columnasDesconocidas: string[]
  duplicados: DuplicadoCandidato[]
  avisos: string[]
  /** Cuántas parcelas se crearon realmente. */
  creadas: number
  /** Ids de las parcelas creadas, para poder referringlas o deshacer. */
  idsCreadas: string[]
}

interface ArchivoParseado {
  encabezados: string[]
  filas: Array<Record<string, string>>
  errores: string[]
}

function parsearArchivo(contenidoBase64: string, formato: 'csv' | 'xlsx'): ArchivoParseado {
  if (formato === 'csv') {
    const texto = Buffer.from(contenidoBase64, 'base64').toString('utf-8')
    return parseCSV(texto)
  }

  const buffer = Buffer.from(contenidoBase64, 'base64')
  const libro = XLSX.read(buffer, { type: 'buffer' })
  const nombreHoja = libro.SheetNames[0]

  if (!nombreHoja) {
    return { encabezados: [], filas: [], errores: ['El archivo no tiene hojas.'] }
  }

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombreHoja], {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (matriz.length === 0) {
    return { encabezados: [], filas: [], errores: ['La hoja está vacía.'] }
  }

  const encabezados = (matriz[0] ?? []).map((valor) => String(valor ?? '').trim())
  const filas = matriz.slice(1).map((valores) => {
    const registro: Record<string, string> = {}
    encabezados.forEach((encabezado, posicion) => {
      registro[encabezado] = String(valores[posicion] ?? '').trim()
    })
    return registro
  })

  return { encabezados, filas, errores: [] }
}

/**
 * Analiza el archivo y devuelve el informe, sin escribir nada.
 */
export async function analizarImportacion(
  contenidoBase64: string,
  formato: 'csv' | 'xlsx',
): Promise<ResultadoImportacion> {
  const archivo = parsearArchivo(contenidoBase64, formato)
  const { mapa, desconocidas } = mapearEncabezados(archivo.encabezados)

  const existentes = (await findParcelasParaDashboard()).map((documento) => {
    const { _id, ...resto } = documento
    return resto as unknown as Parcela
  })

  const porCodigo = new Map<string, Parcela>()
  for (const parcela of existentes) {
    const clave = claveDeIdempotencia(parcela.codigo)
    if (clave) porCodigo.set(clave, parcela)
  }

  const filas: FilaAnalizada[] = []
  const avisos = [...archivo.errores]

  const candidatas: Array<{ fila: number; parcela: Omit<ParcelaCreateRequest, 'id'> }> = []

  archivo.filas.forEach((registro, indice) => {
    const numeroFila = indice + 2
    const mapeada = mapearFila(registro, mapa, numeroFila)
    const conversion = filaAParcela(mapeada.datos, numeroFila, mapeada.errores)

    if (!conversion.parcela) {
      filas.push({
        fila: numeroFila,
        accion: 'error',
        errores: conversion.errores,
        conflictos: [],
      })
      return
    }

    candidatas.push({ fila: numeroFila, parcela: conversion.parcela })
  })

  // Cruce: cada fila contra las parcelas que ya existen.
  for (const candidata of candidatas) {
    const clave = claveDeIdempotencia(candidata.parcela.codigo)

    if (clave) {
      const existente = porCodigo.get(clave)

      if (existente) {
        const propuesta = proponerMerge(existente, {
          ...candidata.parcela,
          id: existente.id,
        } as ParcelaCreateRequest)

        filas.push({
          fila: candidata.fila,
          accion: 'actualizada',
          codigo: candidata.parcela.codigo,
          nombre: candidata.parcela.nombre,
          errores: [],
          conflictos: propuesta.conflictos,
          parcelaExistenteId: existente.id,
        })
        continue
      }
    }

    // Proximidad: una parcela nueva que cae encima de otra ya levantada es un
    // duplicado candidato, no una parcela nueva.
    const punto = { lat: candidata.parcela.ubicacion.lat, lng: candidata.parcela.ubicacion.lng }
    const cercano = existentes.find((existente) => {
      const otro = {
        lat: existente.ubicacion.coordinates[1],
        lng: existente.ubicacion.coordinates[0],
      }
      return distanciaMetros(punto, otro) <= BUFFER_DUPLICADOS_M
    })

    if (cercano) {
      filas.push({
        fila: candidata.fila,
        accion: 'duplicada',
        codigo: candidata.parcela.codigo,
        nombre: candidata.parcela.nombre,
        errores: [`Está a menos de ${BUFFER_DUPLICADOS_M} m de la parcela "${cercano.nombre}".`],
        conflictos: [],
        parcelaExistenteId: cercano.id,
      })
      continue
    }

    filas.push({
      fila: candidata.fila,
      accion: 'nueva',
      codigo: candidata.parcela.codigo,
      nombre: candidata.parcela.nombre,
      errores: [],
      conflictos: [],
    })
  }

  // Duplicados dentro del propio archivo.
  const comoParcelas: Parcela[] = candidatas.map(({ fila, parcela }) => ({
    id: `fila-${fila}`,
    nombre: parcela.nombre,
    descripcion: parcela.descripcion,
    categoria: parcela.categoria,
    codigo: parcela.codigo,
    ubicacion: {
      type: 'Point',
      coordinates: [parcela.ubicacion.lng, parcela.ubicacion.lat],
    },
    gps: parcela.gps,
    estado: parcela.estado,
    modulos: {},
    version: 1,
    creadoEn: '',
    creadoPor: '',
    actualizadoEn: '',
    actualizadoPor: '',
  }))

  const duplicados = detectarDuplicadosPorCodigo(comoParcelas)

  if (duplicados.length > 0) {
    avisos.push(
      `El archivo tiene ${duplicados.length} código(s) repetido(s). Solo se aplica la primera fila de cada uno.`,
    )
  }

  filas.sort((a, b) => a.fila - b.fila)

  return {
    resumen: {
      filas: filas.length,
      nuevas: filas.filter((f) => f.accion === 'nueva').length,
      actualizadas: filas.filter((f) => f.accion === 'actualizada').length,
      duplicadas: filas.filter((f) => f.accion === 'duplicada').length,
      conErrores: filas.filter((f) => f.accion === 'error').length,
    },
    filas,
    columnasDesconocidas: desconocidas,
    duplicados,
    avisos,
    creadas: 0,
    idsCreadas: [],
  }
}

/**
 * Aplica la importación: crea las parcelas nuevas y deja las demás para
 * resolución manual.
 */
export async function aplicarImportacion(
  contenidoBase64: string,
  formato: 'csv' | 'xlsx',
  actor: { id: string; nombre: string },
): Promise<ResultadoImportacion> {
  const analisis = await analizarImportacion(contenidoBase64, formato)
  const archivo = parsearArchivo(contenidoBase64, formato)
  const { mapa } = mapearEncabezados(archivo.encabezados)

  let creadas = 0
  const idsCreadas: string[] = []
  const codigosVistos = new Set<string>()

  for (const [indice, registro] of archivo.filas.entries()) {
    const numeroFila = indice + 2
    const analisisFila = analisis.filas.find((f) => f.fila === numeroFila)

    if (!analisisFila || analisisFila.accion !== 'nueva') continue

    const mapeada = mapearFila(registro, mapa, numeroFila)
    const conversion = filaAParcela(mapeada.datos, numeroFila, mapeada.errores)
    if (!conversion.parcela) continue

    // Un código repetido dentro del mismo archivo: solo aplica la primera.
    const clave = claveDeIdempotencia(conversion.parcela.codigo)
    if (clave) {
      if (codigosVistos.has(clave)) continue
      codigosVistos.add(clave)
    }

    const ahora = new Date().toISOString()
    const id = crypto.randomUUID()

    const documento = {
      ...conversion.parcela,
      id,
      ubicacion: {
        type: 'Point' as const,
        coordinates: [conversion.parcela.ubicacion.lng, conversion.parcela.ubicacion.lat] as [
          number,
          number,
        ],
      },
      gps: { ...conversion.parcela.gps, fijadoEn: ahora },
      modulos: {},
      version: 1,
      creadoEn: ahora,
      creadoPor: actor.id,
      actualizadoEn: ahora,
      actualizadoPor: actor.id,
      _id: id,
    }

    await saveParcela(documento)
    idsCreadas.push(id)
    creadas += 1
  }

  return { ...analisis, creadas, idsCreadas }
}

/**
 * Aplica la resolución de un conflicto: el administrador eligió el valor
 * final de cada campo en disputa.
 */
export async function fusionarParcela(
  parcelaId: string,
  cambios: Record<string, unknown>,
  actor: { id: string; nombre: string },
): Promise<Parcela | null> {
  const existente = await findParcela(parcelaId)
  if (!existente) return null

  const fusionada = aplicarCambios(
    existente as unknown as Parcela,
    cambios,
    new Date().toISOString(),
    actor.id,
  )

  const { _id, ...cuerpo } = { ...fusionada } as Parcela & { _id: string }
  await saveParcela({ ...cuerpo, _id })

  return fusionada
}
