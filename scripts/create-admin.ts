/**
 * Crea o promueve un usuario administrador.
 *
 * El campo `role` del usuario tiene `input: false` en la configuración de
 * Better Auth: nadie puede asignarse ese rol a sí mismo en el registro. Por
 * eso este script escribe el rol directamente en la colección `user`.
 *
 * Uso:
 *   pnpm auth:create-admin -- admin@example.com "Contraseña" "Nombre Admin"
 */

import { getAuth } from '../lib/server/auth'
import { getMongoClient } from '../lib/server/cosmos'
import { getServerEnv } from '../lib/server/env'
import type { Collection } from 'mongodb'

/**
 * Documento de usuario tal y como lo guarda Better Auth: `_id` es el id del
 * usuario como string, no un ObjectId.
 */
interface UserDoc {
  _id: string
  email: string
  role?: string
}

function userCollection(): Collection<UserDoc> {
  const env = getServerEnv()
  return getMongoClient().db(env.MONGODB_DB).collection<UserDoc>('user')
}

async function main(): Promise<void> {
  const [email, password, name] = process.argv.slice(2)

  if (!email || !password) {
    console.error('Uso: pnpm auth:create-admin -- <email> <contraseña> [nombre]')
    process.exitCode = 1
    return
  }

  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.')
    process.exitCode = 1
    return
  }

  const env = getServerEnv()
  const auth = getAuth()

  let userId: string

  try {
    const created = await auth.api.signUpEmail({
      body: { email, password, name: name ?? email },
    })
    userId = created.user.id
    console.log(`Usuario creado: ${email}`)
  } catch (error) {
    const existing = await userCollection().findOne({ email })

    if (!existing) {
      console.error(`No se pudo crear el usuario: ${(error as Error).message}`)
      process.exitCode = 1
      return
    }

    userId = existing._id
    console.log(`El usuario ya existía: ${email}`)
  }

  await userCollection().updateOne({ _id: userId }, { $set: { role: 'admin' } })

  console.log(`Rol actualizado a "admin" para ${email} (${userId}).`)
}

main()
  .then(async () => {
    const { closeMongo } = await import('../lib/server/cosmos')
    await closeMongo()
    process.exit(process.exitCode ?? 0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
