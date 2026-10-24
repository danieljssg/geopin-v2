import { describe, expect, it } from 'vitest'
import { getConfigBlob, urlDeBlob } from './blob'

const SAS = 'https://cuenta.blob.core.windows.net/tiles?sv=2021-08-06&sig=abc123&se=2030-01-01'

describe('getConfigBlob', () => {
  it('devuelve null sin la SAS', () => {
    expect(getConfigBlob({})).toBeNull()
    expect(getConfigBlob({ BLOB_SAS_URL: '   ' })).toBeNull()
  })

  it('devuelve la SAS cuando está', () => {
    expect(getConfigBlob({ BLOB_SAS_URL: SAS })?.sasUrl).toBe(SAS)
  })
})

describe('urlDeBlob', () => {
  it('pone la ruta antes de la cadena de consulta', () => {
    const url = urlDeBlob(SAS, 'tiles/12/1/2.png')
    // Si la ruta fuera después de la consulta, la firma de la SAS quedaría
    // rota y el blob rechazaría la petición.
    expect(url).toBe(
      'https://cuenta.blob.core.windows.net/tiles/tiles/12/1/2.png?sv=2021-08-06&sig=abc123&se=2030-01-01',
    )
    expect(url.indexOf('?')).toBeGreaterThan(url.indexOf('tiles/12/1/2.png'))
  })

  it('quita la barra final del contenedor', () => {
    const url = urlDeBlob('https://cuenta.blob.core.windows.net/tiles/', 'tiles/1/2/3.png')
    expect(url).toBe('https://cuenta.blob.core.windows.net/tiles/tiles/1/2/3.png')
  })

  it('tolera una SAS sin cadena de consulta', () => {
    expect(urlDeBlob('https://cuenta.blob.core.windows.net/tiles', 'a.png')).toBe(
      'https://cuenta.blob.core.windows.net/tiles/a.png',
    )
  })

  it('no duplica la barra inicial de la ruta', () => {
    const url = urlDeBlob(SAS, '/tiles/12/1/2.png')
    expect(url).toContain('/tiles/tiles/12/1/2.png?')
  })
})
