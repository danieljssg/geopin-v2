import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROLE,
  PERMISSIONS,
  ROLE_LABELS,
  USER_ROLES,
  hasPermission,
  isAdmin,
  isUserRole,
  normalizeRole,
  permissionsFor,
} from '@/lib/auth/roles'

describe('normalizeRole', () => {
  it('deja pasar los roles conocidos', () => {
    expect(normalizeRole('admin')).toBe('admin')
    expect(normalizeRole('encuestador')).toBe('encuestador')
  })

  it('cae en el rol por defecto ante un valor desconocido', () => {
    expect(normalizeRole(undefined)).toBe(DEFAULT_ROLE)
    expect(normalizeRole(null)).toBe(DEFAULT_ROLE)
    expect(normalizeRole('')).toBe(DEFAULT_ROLE)
    expect(normalizeRole('superusuario')).toBe(DEFAULT_ROLE)
    expect(normalizeRole(42)).toBe(DEFAULT_ROLE)
  })
})

describe('isUserRole', () => {
  it('reconoce exactamente los roles declarados', () => {
    for (const role of USER_ROLES) expect(isUserRole(role)).toBe(true)
    expect(isUserRole('root')).toBe(false)
    expect(isUserRole(undefined)).toBe(false)
  })
})

describe('hasPermission', () => {
  it('el encuestador puede capturar pero no tocar el esquema', () => {
    expect(hasPermission('encuestador', 'parcela:crear')).toBe(true)
    expect(hasPermission('encuestador', 'parcela:editar')).toBe(true)
    expect(hasPermission('encuestador', 'esquema:leer')).toBe(true)
    expect(hasPermission('encuestador', 'esquema:editar')).toBe(false)
    expect(hasPermission('encuestador', 'usuarios:gestionar')).toBe(false)
  })

  it('el administrador tiene todos los permisos declarados', () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission('admin', permission)).toBe(true)
    }
  })

  it('un rol desconocido cae en el de mínimo privilegio, nunca en admin', () => {
    expect(hasPermission('inventado', 'parcela:crear')).toBe(true)
    expect(hasPermission(undefined, 'parcela:crear')).toBe(true)
    expect(hasPermission('inventado', 'esquema:editar')).toBe(false)
    expect(hasPermission('inventado', 'usuarios:gestionar')).toBe(false)
    expect(isAdmin('inventado')).toBe(false)
  })

  it('un rol con variantes de mayúsculas o espacios no escala a admin', () => {
    for (const variante of ['Admin', 'ADMIN', ' admin', 'admin ']) {
      expect(isAdmin(variante)).toBe(false)
      expect(hasPermission(variante, 'usuarios:gestionar')).toBe(false)
    }
  })
})

describe('isAdmin', () => {
  it('solo el administrador es admin', () => {
    expect(isAdmin('admin')).toBe(true)
    expect(isAdmin('encuestador')).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
  })
})

describe('permissionsFor', () => {
  it('devuelve un subconjunto de los permisos declarados', () => {
    for (const permission of permissionsFor('encuestador')) {
      expect(PERMISSIONS).toContain(permission)
    }
    expect(permissionsFor('encuestador').length).toBeLessThan(PERMISSIONS.length)
    expect(permissionsFor('admin').length).toBe(PERMISSIONS.length)
  })
})

describe('etiquetas de rol', () => {
  it('cada rol tiene etiqueta en español', () => {
    for (const role of USER_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy()
    }
  })
})

describe('rol por defecto', () => {
  /**
   * El invariante de seguridad del rol se verifica en dos niveles: este fija
   * la política en el módulo de roles y `lib/server/auth.test.ts` verifica
   * que la configuración de Better Auth la respete en la práctica.
   */

  it('no es el rol de administración', () => {
    expect(DEFAULT_ROLE).not.toBe('admin')
  })

  it('es uno de los roles declarados', () => {
    expect(USER_ROLES).toContain(DEFAULT_ROLE)
  })

  it('el rol de administración existe y es distinto del de por defecto', () => {
    expect(USER_ROLES).toContain('admin')
    expect(USER_ROLES.filter((role) => role !== DEFAULT_ROLE)).toEqual(['admin'])
  })
})
