/**
 * Parser de CSV.
 *
 * Las planillas de campo vienen de Excel y de信息系统 que usan CRLF, comillas
 * dobles y campos con comas adentro. Un `split(',')` rompe todo eso, así que
 * el parser es propio y está testeado con los casos que de verdad aparecen.
 */

export interface ResultadoCSV {
  encabezados: string[]
  filas: Array<Record<string, string>>
  errores: string[]
}

/**
 * Parsea un CSV en filas de objetos.
 *
 * - Ignora el BOM del principio, que Excel mete cuando el archivo tiene
 *   acentos.
 * - Acepta CRLF y LF.
 * - Un campo entre comillas puede contener comas, comillas dobles escapadas
 *   (`""`) y saltos de línea.
 */
export function parseCSV(contenido: string): ResultadoCSV {
  const errores: string[] = []
  const sinBOM = contenido.replace(/^﻿/, '')

  const filas: string[][] = []
  let actual: string[] = []
  let celda = ''
  let enComillas = false
  let indice = 0

  const cerrarCelda = (): void => {
    actual.push(celda)
    celda = ''
  }

  const cerrarFila = (): void => {
    cerrarCelda()
    // Se ignoran las filas totalmente vacías: los archivos de campo suelen
    // terminar con varias.
    if (actual.some((valor) => valor.trim() !== '')) filas.push(actual)
    actual = []
  }

  while (indice < sinBOM.length) {
    const caracter = sinBOM[indice]

    if (enComillas) {
      if (caracter === '"') {
        if (sinBOM[indice + 1] === '"') {
          celda += '"'
          indice += 2
          continue
        }
        enComillas = false
        indice += 1
        continue
      }
      celda += caracter
      indice += 1
      continue
    }

    if (caracter === '"') {
      enComillas = true
      indice += 1
      continue
    }

    if (caracter === ',') {
      cerrarCelda()
      indice += 1
      continue
    }

    if (caracter === '\r') {
      if (sinBOM[indice + 1] === '\n') indice += 1
      cerrarFila()
      indice += 1
      continue
    }

    if (caracter === '\n') {
      cerrarFila()
      indice += 1
      continue
    }

    celda += caracter
    indice += 1
  }

  if (celda !== '' || actual.length > 0) cerrarFila()

  if (enComillas) {
    errores.push('El archivo termina con una comilla sin cerrar.')
  }

  const encabezados = filas.shift() ?? []
  if (encabezados.length === 0) {
    return { encabezados: [], filas: [], errores: [...errores, 'El archivo está vacío.'] }
  }

  const registros = filas.map((valores, indiceFila) => {
    const registro: Record<string, string> = {}

    encabezados.forEach((encabezado, posicion) => {
      registro[encabezado] = valores[posicion] ?? ''
    })

    if (valores.length > encabezados.length) {
      errores.push(`La fila ${indiceFila + 2} tiene más columnas que el encabezado.`)
    }

    return registro
  })

  return { encabezados, filas: registros, errores }
}
