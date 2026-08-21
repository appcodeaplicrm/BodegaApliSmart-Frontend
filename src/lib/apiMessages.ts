/**
 * Mapa de endpoints → mensaje del toast.
 *
 * Se aplica cuando api.* dispara el toast automático en éxito.
 * El orden importa: las primeras reglas tienen prioridad (van de
 * más específicas a más genéricas).
 *
 * El matcher usa una regex contra la ruta del endpoint (con el
 * método como prefijo virtual para resolver el verbo). Para rutas
 * con IDs dinámicos, el placeholder `:id` matchea cualquier segmento.
 *
 * Si no hay match, se usa el fallback genérico según verbo:
 *   POST   → "Guardado"
 *   PATCH  → "Actualizado"
 *   PUT    → "Actualizado"
 *   DELETE → "Eliminado"
 */

type Verb = 'POST' | 'PATCH' | 'PUT' | 'DELETE'

type Rule = {
  /** Regex contra `${method} ${path}` (path con :id para IDs). */
  match: RegExp
  /** Mensaje a mostrar. Soporta {{entity}} como placeholder. */
  message: string
}

const RULES: Rule[] = [
  // ── Pedidos / Despachos ────────────────────────────────
  { match: /^POST \/pedidos\b/, message: 'Pedido creado' },
  { match: /^PATCH \/pedidos\/[^/]+\/estado\b/, message: 'Estado del pedido actualizado' },
  { match: /^PATCH \/pedidos\/[^/]+\/entregas\b/, message: 'Entrega registrada' },
  { match: /^PATCH \/pedidos\/[^/]+/, message: 'Pedido actualizado' },
  { match: /^DELETE \/pedidos\/[^/]+/, message: 'Pedido eliminado' },

  // ── Despachos ──────────────────────────────────────────
  { match: /^POST \/despachos\b/, message: 'Despacho creado' },
  { match: /^PATCH \/despachos\/[^/]+/, message: 'Despacho actualizado' },
  { match: /^DELETE \/despachos\/[^/]+/, message: 'Despacho eliminado' },

  // ── Devoluciones ───────────────────────────────────────
  { match: /^POST \/devoluciones\b/, message: 'Devolución registrada' },
  { match: /^PATCH \/devoluciones\/[^/]+/, message: 'Devolución actualizada' },
  { match: /^DELETE \/devoluciones\/[^/]+/, message: 'Devolución eliminada' },

  // ── Movimientos / Stock ────────────────────────────────
  { match: /^POST \/movimientos\b/, message: 'Movimiento registrado' },
  { match: /^POST \/productos\/[^/]+\/movimiento\b/, message: 'Stock actualizado' },

  // ── Productos / Catálogo ───────────────────────────────
  { match: /^POST \/productos\b/, message: 'Producto creado' },
  { match: /^PATCH \/productos\/[^/]+/, message: 'Producto actualizado' },
  { match: /^DELETE \/productos\/[^/]+/, message: 'Producto eliminado' },

  // ── Kits ───────────────────────────────────────────────
  { match: /^POST \/kits\b/, message: 'Kit creado' },
  { match: /^PATCH \/kits\/[^/]+/, message: 'Kit actualizado' },
  { match: /^DELETE \/kits\/[^/]+/, message: 'Kit eliminado' },

  // ── Alertas ────────────────────────────────────────────
  { match: /^PATCH \/alertas\/[^/]+/, message: 'Alerta actualizada' },
  { match: /^POST \/alertas\/[^/]+\/resolver\b/, message: 'Alerta resuelta' },

  // ── Proveedores / Categorías ───────────────────────────
  { match: /^POST \/proveedores\b/, message: 'Proveedor creado' },
  { match: /^PATCH \/proveedores\/[^/]+/, message: 'Proveedor actualizado' },
  { match: /^DELETE \/proveedores\/[^/]+/, message: 'Proveedor eliminado' },
  { match: /^POST \/categorias\b/, message: 'Categoría creada' },
  { match: /^PATCH \/categorias\/[^/]+/, message: 'Categoría actualizada' },
  { match: /^DELETE \/categorias\/[^/]+/, message: 'Categoría eliminada' },

  // ── Clientes ───────────────────────────────────────────
  { match: /^POST \/clientes\b/, message: 'Cliente creado' },
  { match: /^PATCH \/clientes\/[^/]+/, message: 'Cliente actualizado' },
  { match: /^DELETE \/clientes\/[^/]+/, message: 'Cliente eliminado' },

  // ── Proyectos (Capa 9) ──────────────────────────────────
  { match: /^POST \/proyectos\b/, message: 'Proyecto creado' },

  // ── Usuarios / Roles / Permisos ────────────────────────
  { match: /^POST \/usuarios\b/, message: 'Usuario creado' },
  { match: /^PATCH \/usuarios\/[^/]+/, message: 'Usuario actualizado' },
  { match: /^DELETE \/usuarios\/[^/]+/, message: 'Usuario eliminado' },
  { match: /^POST \/roles\b/, message: 'Rol creado' },
  { match: /^PATCH \/roles\/[^/]+/, message: 'Rol actualizado' },
  { match: /^DELETE \/roles\/[^/]+/, message: 'Rol eliminado' },
  { match: /^POST \/permisos\b/, message: 'Permiso actualizado' },

  // ── Perfil ─────────────────────────────────────────────
  { match: /^POST \/perfil\/password\b/, message: 'Contraseña actualizada' },
  { match: /^PATCH \/perfil\b/, message: 'Perfil actualizado' },
  { match: /^DELETE \/perfil\/sesiones\b/, message: 'Sesiones cerradas' },
  { match: /^DELETE \/perfil\/sesiones\/[^/]+/, message: 'Sesión cerrada' },

  // ── Bodegas ────────────────────────────────────────────
  { match: /^POST \/bodegas\b/, message: 'Bodega creada' },
  { match: /^PATCH \/bodegas\/[^/]+/, message: 'Bodega actualizada' },
  { match: /^DELETE \/bodegas\/[^/]+/, message: 'Bodega eliminada' },

  // ── Proyectos (Capa 9) ──────────────────────────────────
  // Los nodos del recorrido se crean en un loop (al crear un
  // proyecto con ruta planificada) y disparar un toast por
  // cada uno satura la UI. Lo manejamos en `mensajeExito()`
  // con un check explícito de la URL para devolver `null`.
  // (Las reglas de abajo son para los endpoints que SÍ queremos
  // que muestren toast.)
  { match: /^POST \/proyectos\/[^/]+\/ruta\/planificar\b/, message: 'Recorrido planificado' },
  // POST /proyectos/:id/nodos y POST /proyectos/ruta/planificar-preview
  // → silenciados (ver lógica en `mensajeExito()`).

  // ── Checklist ──────────────────────────────────────────
  { match: /^POST \/checklist\/plantillas\b/, message: 'Plantilla creada' },
  { match: /^PATCH \/checklist\/plantillas\/[^/]+/, message: 'Plantilla actualizada' },
  { match: /^DELETE \/checklist\/plantillas\/[^/]+/, message: 'Plantilla eliminada' },
  { match: /^POST \/checklist\/asignaciones\b/, message: 'Checklist asignado' },
  { match: /^PATCH \/checklist\/asignaciones\/[^/]+/, message: 'Checklist actualizado' },

  // ── SuperAdmin ─────────────────────────────────────────
  { match: /^POST \/admin\/tenants\/[^/]+\/subscription\b/, message: 'Plan actualizado' },
  { match: /^PATCH \/admin\/tenants\/[^/]+\/status\b/, message: 'Estado de la empresa actualizado' },
  { match: /^PATCH \/admin\/plans\/[^/]+/, message: 'Plan actualizado' },
  { match: /^PUT \/admin\/plans\/[^/]+\/features\b/, message: 'Features del plan actualizadas' },
  { match: /^PUT \/admin\/plans\/[^/]+\/permissions\b/, message: 'Permisos del plan actualizados' },
  { match: /^POST \/admin\/plans\/[^/]+\/archive\b/, message: 'Plan archivado' },
  { match: /^POST \/admin\/plans\/[^/]+\/publish\b/, message: 'Plan publicado' },
  { match: /^POST \/admin\/tenants\b/, message: 'Empresa creada' },
  { match: /^PATCH \/admin\/tenants\/[^/]+/, message: 'Empresa actualizada' },
  { match: /^DELETE \/admin\/tenants\/[^/]+/, message: 'Empresa eliminada' },
]

const FALLBACK: Record<Verb, string> = {
  POST: 'Guardado',
  PATCH: 'Actualizado',
  PUT: 'Actualizado',
  DELETE: 'Eliminado',
}

/**
 * Devuelve el mensaje de éxito para un (método, path) o null si
 * la operación no debe disparar toast (ej. logout).
 */
export function mensajeExito(method: string, path: string): string | null {
  // No mostramos toast en operaciones internas de auth (logout, login,
  // refresh) — esas tienen su propio flujo de UX.
  if (path.startsWith('/auth/')) return null

  // Silenciar endpoints que se llaman en loop y saturan la UI con
  // toasts duplicados. Si el caller quiere un toast en estos casos,
  // debe mostrarlo manualmente (no usamos `opts.silent` porque
  // sería agregar un parámetro nuevo solo para estos 2 casos).
  if (method.toUpperCase() === 'POST') {
    if (/^\/proyectos\/[^/]+\/nodos\b/.test(path)) return null
    if (/^\/proyectos\/ruta\/planificar-preview\b/.test(path)) return null
  }

  // Silenciar TODO el módulo de chat. Los POSTs del chat son
  // acciones internas (marcarLeido se dispara solo al ver un
  // mensaje del otro, toggleReaccion no necesita confirmación,
  // abrirConversacion no muestra "Conversación creada"). El
  // feedback visual lo da la propia UI del chat (la burbuja
  // aparece, el check de leído se actualiza, etc). Mostrar
  // "Guardado" por cada uno satura la UI cuando llegan muchos
  // mensajes seguidos.
  if (path.startsWith('/chat/')) return null

  // Silenciar todo lo que tenga que ver con la sesión de voz del
  // asistente de IA. La librería @deepgram/agents y nuestro wrapper
  // disparan varios `api.post` internos (sesión, refresh de token,
  // tools, etc.) que NO son acciones del user y NO deben mostrar
  // toast "Guardado". Si el asistente hace algo visible (ej. crear
  // un producto), el back emite un realtime y los stores lo
  // manejan con sus propios flujos.
  if (path.startsWith('/auditoria-inteligente/voz')) return null

  const key = `${method.toUpperCase()} ${path}`
  for (const rule of RULES) {
    if (rule.match.test(key)) return rule.message
  }
  return FALLBACK[method.toUpperCase() as Verb] ?? null
}
