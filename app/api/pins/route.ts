import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Pin } from '@/lib/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'pins.json')

function readPins(): Pin[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8')
      return []
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as Pin[]
  } catch {
    return []
  }
}

function writePins(pins: Pin[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(pins, null, 2), 'utf-8')
}

export async function GET() {
  const pins = readPins()
  return NextResponse.json(pins)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const newPin: Pin = {
    id: crypto.randomUUID(),
    lat: Number(body.lat),
    lng: Number(body.lng),
    nombre: String(body.nombre ?? '').trim(),
    descripcion: String(body.descripcion ?? '').trim(),
    categoria: body.categoria,
    creadoEn: new Date().toISOString(),
  }

  const pins = readPins()
  pins.push(newPin)
  writePins(pins)

  return NextResponse.json(newPin, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const pins = readPins()
  const filtered = pins.filter((p) => p.id !== id)
  writePins(filtered)
  return NextResponse.json({ success: true })
}
