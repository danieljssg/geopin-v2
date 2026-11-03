import type { Collection, IndexDescription, ObjectId } from 'mongodb'
import { getDb } from './cosmos'
import type { Levantamiento, ModuleSchema, Parcela, Workspace, WorkspaceMembership } from '@/lib/domain/types'

/**
 * Colecciones de la base de datos y sus índices.
 *
 * En Cosmos DB for MongoDB el `_id` es la clave de partición implícita: se
 * elige siempre el id de la parcela para que un documento se lea y se escriba
 * en una sola operación (RU/s) y para que la idempotencia del sync sea
 * natural.
 */

export const COLLECTION_PARECLAS = 'parcelas'
export const COLLECTION_SCHEMAS = 'schemas'
export const COLLECTION_LEVANTAMIENTOS = 'levantamientos'
export const COLLECTION_WORKSPACES = 'workspaces'
export const COLLECTION_MEMBERSHIPS = 'workspace_memberships'
export const COLLECTION_MANAGER_REQUESTS = 'manager_requests'
export const COLLECTION_INVITATIONS = 'invitations'
export const COLLECTION_WORKSPACE_FIELDS = 'workspace_fields'
export const COLLECTION_INVITE_ATTEMPTS = 'invite_attempts'

/**
 * Colecciones que administra Better Auth. El adaptador de MongoDB usa
 * nombres singulares porque se configuró con `usePlural: false`.
 */
export const COLLECTION_USERS = 'user'
export const COLLECTION_SESSIONS = 'session'

/**
 * Documento de usuario tal y como lo guarda Better Auth: el `_id` lo
 * genera el driver y es un `ObjectId`, aunque Better Auth devuelva el id
 * como string hexadecimal. De la tabla de usuarios solo nos interesa el
 * rol, y las consultas se hacen por email.
 */
export interface UserDoc {
  _id: ObjectId | string
  email: string
  role?: string
}

/** Documento de parcela tal y como se guarda: `_id` replica el `id` de negocio. */
export type ParcelaDoc = Parcela & { _id: string }

export type SchemaDoc = ModuleSchema & { _id: string }

export type LevantamientoDoc = Levantamiento & { _id: string }
export type WorkspaceDoc = Workspace & { _id: string }
export type MembershipDoc = WorkspaceMembership & { _id: string }

export interface ManagerRequestDoc {
  _id: string
  userId: string
  nombreWorkspace: string
  proposito: string
  participantesEsperados: number
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  creadoEn: string
  revisadoEn?: string
  revisadoPor?: string
  workspaceId?: string
}

export interface InvitationDoc {
  _id: string
  digest: string
  targetType: 'workspace' | 'survey'
  targetId: string
  workspaceId: string
  creadoPor: string
  creadoEn: string
  expiraEn: string
  revocado: boolean
}

export interface WorkspaceFieldDoc {
  _id: string
  workspaceId: string
  field: import('@/lib/domain/types').FieldDef
  creadoPor: string
  creadoEn: string
}

export function parcelasCollection(): Collection<ParcelaDoc> {
  return getDb().collection<ParcelaDoc>(COLLECTION_PARECLAS)
}

export function schemasCollection(): Collection<SchemaDoc> {
  return getDb().collection<SchemaDoc>(COLLECTION_SCHEMAS)
}

export function levantamientosCollection(): Collection<LevantamientoDoc> {
  return getDb().collection<LevantamientoDoc>(COLLECTION_LEVANTAMIENTOS)
}

export function workspacesCollection(): Collection<WorkspaceDoc> {
  return getDb().collection<WorkspaceDoc>(COLLECTION_WORKSPACES)
}

export function membershipsCollection(): Collection<MembershipDoc> {
  return getDb().collection<MembershipDoc>(COLLECTION_MEMBERSHIPS)
}

export function managerRequestsCollection(): Collection<ManagerRequestDoc> {
  return getDb().collection<ManagerRequestDoc>(COLLECTION_MANAGER_REQUESTS)
}

export function invitationsCollection(): Collection<InvitationDoc> {
  return getDb().collection<InvitationDoc>(COLLECTION_INVITATIONS)
}

export function workspaceFieldsCollection(): Collection<WorkspaceFieldDoc> {
  return getDb().collection<WorkspaceFieldDoc>(COLLECTION_WORKSPACE_FIELDS)
}

export function inviteAttemptsCollection(): Collection<{ _id: string; attempts: number; expiraEn: Date }> {
  return getDb().collection(COLLECTION_INVITE_ATTEMPTS)
}

export function usuariosCollection(): Collection<UserDoc> {
  return getDb().collection<UserDoc>(COLLECTION_USERS)
}

export interface IndexSpec {
  collection: string
  index: IndexDescription
}

/**
 * Definición de los índices.
 *
 * Cada uno se crea por separado y los fallos se toleran de forma
 * individual: hay dos motores distintos detrás de "Cosmos DB for MongoDB"
 * con capacidades de índice diferentes —la API RU no admite índices
 * `sparse`, vCore sí— y un único índice no soportado no debe tumbar el
 * resto del bootstrap ni el arranque de la aplicación.
 */
export const INDEX_SPECS: IndexSpec[] = [
  {
    collection: COLLECTION_PARECLAS,
    index: {
      key: { ubicacion: '2dsphere' },
      name: 'ubicacion_2dsphere',
    },
  },
  {
    collection: COLLECTION_PARECLAS,
    index: {
      key: { codigo: 1 },
      name: 'codigo_unique',
      unique: true,
      sparse: true,
    },
  },
  {
    collection: COLLECTION_PARECLAS,
    index: {
      key: { estado: 1 },
      name: 'estado',
    },
  },
  {
    collection: COLLECTION_PARECLAS,
    index: {
      key: { levantamientoId: 1 },
      name: 'levantamiento',
    },
  },
  {
    collection: COLLECTION_PARECLAS,
    index: {
      key: { creadoEn: -1 },
      name: 'creadoEn',
    },
  },
  {
    collection: COLLECTION_PARECLAS,
    index: {
      key: { creadoPor: 1 },
      name: 'creadoPor',
    },
  },
  {
    collection: COLLECTION_SCHEMAS,
    index: {
      key: { modulo: 1 },
      name: 'modulo',
    },
  },
  {
    collection: COLLECTION_LEVANTAMIENTOS,
    index: {
      key: { ciudad: 1 },
      name: 'ciudad',
    },
  },
  { collection: COLLECTION_WORKSPACES, index: { key: { managerId: 1 }, name: 'workspace_manager_unique', unique: true } },
  { collection: COLLECTION_MEMBERSHIPS, index: { key: { userId: 1, workspaceId: 1, surveyId: 1 }, name: 'membership_scope' } },
  { collection: COLLECTION_INVITATIONS, index: { key: { digest: 1 }, name: 'invitation_digest_unique', unique: true } },
  { collection: COLLECTION_MANAGER_REQUESTS, index: { key: { userId: 1, estado: 1 }, name: 'manager_request_status' } },
  { collection: COLLECTION_WORKSPACE_FIELDS, index: { key: { workspaceId: 1 }, name: 'workspace_field_scope' } },
  { collection: COLLECTION_INVITE_ATTEMPTS, index: { key: { expiraEn: 1 }, name: 'invite_attempts_ttl', expireAfterSeconds: 0 } },
]

export interface IndexFailure {
  collection: string
  name: string
  message: string
}

/**
 * Crea los índices que falten.
 *
 * `createIndexes` es idempotente en MongoDB: volver a llamarlo con la misma
 * definición no falla, solo no hace nada. Por eso se puede llamar en cada
 * arranque sin miedo.
 *
 * Devuelve la lista de índices que no se pudieron crear, en lugar de
 * lanzar: el llamador decide si eso es tolerable.
 */
export async function ensureIndexes(): Promise<IndexFailure[]> {
  const db = getDb()
  const failures: IndexFailure[] = []

  for (const spec of INDEX_SPECS) {
    try {
      await db.collection(spec.collection).createIndexes([spec.index])
    } catch (error) {
      failures.push({
        collection: spec.collection,
        name: spec.index.name ?? '(sin nombre)',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return failures
}
