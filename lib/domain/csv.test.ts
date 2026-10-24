import { describe, expect, it } from 'vitest'
import { parseCSV } from './csv'

describe('parseCSV', () => {
  it('parsea una tabla simple', () => {
    const resultado = parseCSV('nombre,lat,lng\nCasa,10.48,-66.9')
    expect(resultado.encabezados).toEqual(['nombre', 'lat', 'lng'])
    expect(resultado.filas).toHaveLength(1)
    expect(resultado.filas[0].nombre).toBe('Casa')
  })

  it('ignora el BOM de Excel', () => {
    const resultado = parseCSV('\ufeffnombre\nCasa')
    expect(resultado.encabezados).toEqual(['nombre'])
  })

  it('acepta CRLF', () => {
    const resultado = parseCSV('a,b\r\n1,2\r\n')
    expect(resultado.filas).toHaveLength(1)
    expect(resultado.filas[0].b).toBe('2')
  })

  it('acepta LF', () => {
    const resultado = parseCSV('a,b\n1,2\n')
    expect(resultado.filas).toHaveLength(1)
  })

  it('lee un campo con coma entre comillas', () => {
    const resultado = parseCSV('nombre,lat\n"Casa, con patio",10.48')
    expect(resultado.filas[0].nombre).toBe('Casa, con patio')
  })

  it('duplica las comillas dobles escapadas', () => {
    const resultado = parseCSV('nombre\n"Dijo ""hola"""')
    expect(resultado.filas[0].nombre).toBe('Dijo "hola"')
  })

  it('lee un campo con salto de línea entre comillas', () => {
    const resultado = parseCSV('nombre\n"linea 1\nlinea 2"')
    expect(resultado.filas[0].nombre).toBe('linea 1\nlinea 2')
  })

  it('ignora las filas vacías del final', () => {
    const resultado = parseCSV('nombre\nCasa\n\n\n')
    expect(resultado.filas).toHaveLength(1)
  })

  it('rellena con vacío las columnas que faltan', () => {
    const resultado = parseCSV('a,b\n1')
    expect(resultado.filas[0].b).toBe('')
  })

  it('avisa cuando hay más columnas que encabezados', () => {
    const resultado = parseCSV('a,b\n1,2,3')
    expect(resultado.errores.join(' ')).toMatch(/más columnas/i)
  })

  it('avisa si el archivo está vacío', () => {
    const resultado = parseCSV('')
    expect(resultado.errores.join(' ')).toMatch(/vacío/i)
  })

  it('avisa si termina con una comilla sin cerrar', () => {
    const resultado = parseCSV('nombre\n"Casa')
    expect(resultado.errores.join(' ')).toMatch(/comilla sin cerrar/i)
  })
})
