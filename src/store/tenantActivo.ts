import { useSyncExternalStore } from 'react'

/**
 * Tenant activo del superadmin.
 *
 * El superadmin no tiene bodega asignada, pero cuando navega a las páginas
 * comunes (dashboard, inventario, etc) quiere ver los datos de UN tenant
 * específico. Este store guarda el `adminId` (o null = "ninguno") en
 * localStorage para que persista entre recargas.
 *
 * - `null`       → no hay tenant activo (default)
 * - `'__all__'`  → ver todos los tenants (modo cross-tenant)
 * - `'<adminId>'` → ver solo este tenant
 *
 * Por ahora, el back ya filtra por `adminId` cuando el user tiene uno
 * asignado. El superadmin bypasea ese filtro (TenantGuard: esSuperadmin).
 * Lo que guardamos acá es solo un "scope visual" para la UI — el back
 * va a tener que aceptar un header `X-Tenant-Id` cuando expandamos
 * la lógica de "ver como tenant X". Por ahora, lo único que cambia
 * con esto es la UI.
 */
export type TenantActivo = {
  /** 'null' | '__all__' | adminId */
  kind: 'null' | 'all' | 'admin'
  /** El adminId cuando kind === 'admin' */
  adminId?: string
}

const STORAGE_KEY = 'winerysmart:tenant-activo'

let estado: TenantActivo = loadFromStorage()
const listeners = new Set<() => void>()

function loadFromStorage(): TenantActivo {
  if (typeof window === 'undefined') return { kind: 'null' }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { kind: 'null' }
    const parsed = JSON.parse(raw)
    if (parsed?.kind === 'all') return { kind: 'all' }
    if (parsed?.kind === 'admin' && typeof parsed.adminId === 'string') {
      return { kind: 'admin', adminId: parsed.adminId }
    }
    return { kind: 'null' }
  } catch {
    return { kind: 'null' }
  }
}

function saveToStorage(t: TenantActivo) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
  } catch {
    /* ignore */
  }
}

function emit() {
  listeners.forEach((l) => l())
}

export const tenantActivoStore = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  getSnapshot(): TenantActivo {
    return estado
  },
  setNinguno() {
    estado = { kind: 'null' }
    saveToStorage(estado)
    emit()
  },
  setTodos() {
    estado = { kind: 'all' }
    saveToStorage(estado)
    emit()
  },
  setAdmin(adminId: string) {
    estado = { kind: 'admin', adminId }
    saveToStorage(estado)
    emit()
  },
  reset() {
    estado = { kind: 'null' }
    saveToStorage(estado)
    emit()
  },
}

export function useTenantActivo() {
  return useSyncExternalStore(
    tenantActivoStore.subscribe,
    tenantActivoStore.getSnapshot,
    tenantActivoStore.getSnapshot,
  )
}
