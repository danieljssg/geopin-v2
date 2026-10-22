import { SEED_SCHEMAS } from '@/lib/domain/seed'
import { getAuth } from './auth'
import { schemasCollection, usuariosCollection } from './collections'
import { closeMongo } from './cosmos'

/**
 * Siembra de la base de datos.
 *
 * Es el único camino por el que se crea un administrador: el rol no se puede
 * asignar en el registro (el campo tiene `input: false`), así que el primer
 * admin se crea acá y los siguientes se promueven desde acá o desde la gestión
 * de usuarios del panel.
 */

export type AdminOutcome = 'creado' | 'promovido' | 'omitido'

export interface SeedSummary {
  schemasInserted: number
  schemasUpdated: number
  schemasPreserved: number
  admin: AdminOutcome
}

/**
 * Siembra los esquemas de los módulos.
 *
 * Regla de seguridad: un esquema que ya fue editado por un administrador
 * (`actualizadoPor` distinto de `seed`) no se toca. La siembra solo crea lo
 * que falta y actualiza lo que sigue siendo suyo.
 */
export async function seedSchemas(): Promise<{
  inserted: number
  updated: number
  preserved: number
}> {
  const collection = schemasCollection()
  let inserted = 0
  let updated = 0
  let preserved = 0

  for (const schema of SEED_SCHEMAS) {
    const existing = await collection.findOne({ _id: schema.moduleId })

    if (!existing) {
      await collection.updateOne(
        { _id: schema.moduleId },
        { $set: { ...schema } },
        { upsert: true },
      )
      inserted += 1
      continue
    }

    if (existing.actualizadoPor !== 'seed') {
      preserved += 1
      continue
    }

    if (existing.version !== schema.version) {
      await collection.updateOne(
        { _id: schema.moduleId },
        { $set: { ...schema } },
        { upsert: true },
      )
      updated += 1
    }
  }

  return { inserted, updated, preserved }
}

/**
 * Crea el administrador inicial o promueve el rol de uno que ya existe.
 *
 * El rol se escribe directo en la colección `user` porque `input: false`
 * impide que el registro lo acepte.
 */
export async function ensureAdmin(input: {
  email: string
  password: string
  name?: string
}): Promise<AdminOutcome> {
  const auth = getAuth()
  const collection = usuariosCollection()

  let userId: string
  let outcome: AdminOutcome = 'creado'

  try {
    const created = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.name ?? input.email,
      },
    })
    userId = created.user.id
  } catch {
    const existing = await collection.findOne({ email: input.email })
    if (!existing) {
      throw new Error(
        `No se pudo crear el usuario ${input.email} ni promover uno existente.`,
      )
    }
    userId = existing._id
    outcome = 'promovido'
  }

  await collection.updateOne({ _id: userId }, { $set: { role: 'admin' } })

  return outcome
}

/**
 * Siembra completa: esquemas y administrador.
 *
 * Si no hay credenciales de administrador, la siembra de esquemas sigue igual
 * y el administrador se omite: es válido sembrar los datos de campo sin
 * crear todavía el primer usuario administrador.
 */
export async function seed(options: {
  admin?: { email: string; password: string; name?: string }
}): Promise<SeedSummary> {
  const schemas = await seedSchemas()

  let admin: AdminOutcome = 'omitido'
  if (options.admin) {
    admin = await ensureAdmin(options.admin)
  }

  return {
    schemasInserted: schemas.inserted,
    schemasUpdated: schemas.updated,
    schemasPreserved: schemas.preserved,
    admin,
  }
}
