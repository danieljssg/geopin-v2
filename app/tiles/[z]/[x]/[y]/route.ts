import { NextResponse } from 'next/server'
import { leerBlob } from '@/lib/server/blob'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ z: string; x: string; y: string }>
}

/**
 * Sirve un tile desde el blob storage.
 *
 * El service worker cachea estas respuestas con la política de tiles propios,
 * así que una vez descargada el área, el mapa funciona sin conexión.
 */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { z, x, y } = await context.params

  // La app pide `/tiles/12/1/2.png`; el enrutador entrega "2.png" como `y`.
  const fila = y.replace(/\.png$/i, '')

  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(fila)) {
    return NextResponse.json({ error: 'Coordenadas de tesela inválidas.' }, { status: 400 })
  }

  const nivel = Number(z)
  const maximo = 2 ** nivel

  if (nivel < 0 || nivel > 22 || Number(x) >= maximo || Number(fila) >= maximo) {
    return NextResponse.json({ error: 'Tesela fuera de rango.' }, { status: 400 })
  }

  let blob: Response | null
  try {
    blob = await leerBlob(`tiles/${z}/${x}/${fila}.png`)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo leer el tile.' },
      { status: 502 },
    )
  }

  if (!blob) {
    return NextResponse.json({ error: 'El tile no existe.' }, { status: 404 })
  }

  return new NextResponse(blob.body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
