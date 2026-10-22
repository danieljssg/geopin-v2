/**
 * Roles y permisos de la plataforma.
 *
 * Módulo puro: lo usan igual el cliente (para ocultar acciones en la UI) y el
 * servidor (para decidir). La decisión real siempre la toma el servidor.
 */

export const USER_ROLES = ['encuestador', 'admin'] as const

export type UserRole = (typeof USER_ROLES)[number]

/**
 * Rol con el que nace todo usuario registrado.
 *
 * Nadie se registra como administrador: el rol se promueve a mano desde la
 * base de datos (ver `scripts/create-admin.ts`) o desde la gestión de
 * usuarios del panel.
 */
export const DEFAULT_ROLE: UserRole = 'encuestador'

export const PERMISSIONS = [
  'parcela:crear',
  'parcela:editar',
  'parcela:eliminar',
  'esquema:leer',
  'esquema:editar',
  'importar:ejecutar',
  'conflictos:resolver',
  'levantamiento:gestionar',
  'usuarios:gestionar',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  encuestador: [
    'parcela:crear',
    'parcela:editar',
    'parcela:eliminar',
    'esquema:leer',
  ],
  admin: PERMISSIONS,
}

export const ROLE_LABELS: Record<UserRole, string> = {
  encuestador: 'Encuestador',
  admin: 'Administrador',
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

/**
 * Convierte cualquier valor en un rol válido.
 *
 * Un rol desconocido o ausente cae en `encuestador`, que es el rol de mínimo
 * privilegio. La dirección del fallback importa: un campo de rol corrupto
 * deja al usuario sin permisos de administración, nunca con ellos.
 */
export function normalizeRole(value: unknown): UserRole {
  return isUserRole(value) ? value : DEFAULT_ROLE
}

export function isAdmin(role: unknown): boolean {
  return normalizeRole(role) === 'admin'
}

/** ¿El rol tiene el permiso pedido? */
export function hasPermission(role: unknown, permission: Permission): boolean {
  return ROLE_PERMISSIONS[normalizeRole(role)].includes(permission)
}

/** Lista de permisos de un rol, para la UI. */
export function permissionsFor(role: unknown): readonly Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)]
}
