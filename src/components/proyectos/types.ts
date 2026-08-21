/**
 * Tipos del submódulo Proyectos.
 *
 * Matchean la respuesta del back (`proyectos.service.ts`).
 * Los Decimals se devuelven como `number` (ya casteados en
 * `decorateListado` / `decorateDetalle`).
 */

export type ProyectoEstado = {
  id: string
  nombre: string
  colorHex: string | null
}

export type ProyectoRol = {
  id: string
  nombre: string
  key: string
  descripcion?: string
}

export type ProyectoTecnicoListado = {
  id: string
  tecnicoId: string
  rolEnProyecto: string | null
  fechaAsignacion: string
}

export type ProyectoTecnicoDetalle = ProyectoTecnicoListado & {
  fechaDesasignacion: string | null
  tecnico: { id: string; nombre: string; email: string }
}

export type ProyectoListItem = {
  id: string
  codigo: string
  nombreProyecto: string
  descripcion: string | null
  kmATrabajar: number
  kmAvanzados: number
  fechaInicio: string
  fechaFinEstimada: string | null
  fechaFinReal: string | null
  costoTotal: number
  adminId: string
  bodegaId: string
  creadoPorId: string
  encargadoId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  estado: ProyectoEstado
  bodega: { id: string; nombre: string }
  creadoPor: { id: string; nombre: string }
  encargado: { id: string; nombre: string; email: string } | null
  rolesDirigidos: Array<{ id: string; rol: ProyectoRol }>
  tecnicos: ProyectoTecnicoListado[]
  tecnicosActivos: number
  totalProductosIniciales: number
  totalSolicitudes: number
  totalAvances: number
}

export type ProyectoDetalle = Omit<ProyectoListItem, 'tecnicos'> & {
  tecnicos: ProyectoTecnicoDetalle[]
  /** % de avance en km (0-100). Calculado en el back, no persistido. */
  porcentajeAvance: number
  /** Nodos del recorrido (estudio previo), ordenados por `orden`. */
  nodos: ProyectoNodo[]
}

export type ProyectoUsuarioAsignable = {
  id: string
  nombre: string
  email: string
  roles: ProyectoRol[]
  /** Si está en otro proyecto activo: {id, codigo, nombreProyecto} | null */
  ocupadoEnProyecto: { id: string; codigo: string; nombreProyecto: string } | null
}

export type CrearProyectoInput = {
  nombreProyecto: string
  descripcion?: string
  kmATrabajar: number
  fechaInicio: string
  fechaFinEstimada?: string
  bodegaId: string
  estadoId: string
  rolesDirigidos: string[]
  encargadoId?: string
  tecnicosIds?: string[]
  /**
   * Productos iniciales (dotación) que se asignan al crear el
   * proyecto. Se crean en la misma transacción que el proyecto
   * y descuentan stock de la bodega.
   */
  productosIniciales?: ProductoInicialParaCrear[]
}

export type EditarProyectoInput = Partial<Omit<CrearProyectoInput, 'tecnicosIds'>> & {
  encargadoId?: string | null
}

export type AsignarTecnicosInput = {
  tecnicosIds?: string[]
  desasignarIds?: string[]
  rolEnProyecto?: string
}

export type ListProyectosQuery = {
  bodegaId?: string
  estadoNombre?: string
  tecnicoId?: string
  buscar?: string
  page: number
  pageSize: number
}

// ─────────────────────────────────────────────────────────────
//  Productos iniciales (dotación al proyecto)
// ─────────────────────────────────────────────────────────────

export type ProyectoProductoInicial = {
  id: string
  proyectoId: string
  productoId: string
  cantidadAsignada: number
  costoUnitarioAlMomento: number
  subtotal: number
  tecnicoReceptorId: string | null
  fechaEntrega: string
  movimientoInventarioId: string | null
  producto: {
    id: string
    codigo: string
    nombre: string
    unidadMedida: { id: string; abreviatura: string }
  }
  tecnicoReceptor: { id: string; nombre: string } | null
  movimientoInventario: { id: string; fecha: string } | null
}

export type ProductoInicialInput = {
  productoId: string
  cantidad: number
  tecnicoReceptorId?: string
}

export type AsignarProductosInicialesInput = {
  items: ProductoInicialInput[]
}

export type ProductoInicialParaCrear = {
  productoId: string
  cantidad: number
  tecnicoReceptorId?: string
}

/**
 * Row unificada de la tab "Productos" del detalle.
 * Mezcla productos iniciales + productos que llegaron vía solicitudes
 * a bodega entregadas. Cada ENTREGA es una row (si el mismo producto
 * entró en 2 solicitudes, se ve 2 veces).
 *
 * `origen`:
 *  - 'inicial'    → dotación al crear / asignada después.
 *  - 'solicitud'  → vino de una solicitud a bodega entregada.
 */
export type ProductoDelProyecto = {
  id: string
  origen: 'inicial' | 'solicitud'
  /** null si origen='inicial', PSB-YYYY-NNNN si origen='solicitud'. */
  origenCodigo: string | null
  origenId: string
  producto: {
    id: string
    codigo: string
    nombre: string
    unidadMedida: { id: string; abreviatura: string }
  }
  cantidad: number
  costoUnitario: number
  subtotal: number
  tecnicoReceptor: { id: string; nombre: string } | null
  fechaEntrega: string
  fechaSolicitud: string | null
  solicitudId: string | null
  solicitudEstado: string | null
}

// ─────────────────────────────────────────────────────────────
//  Solicitudes a bodega (Capa 6)
// ─────────────────────────────────────────────────────────────

export type SolicitudEstado = 'pendiente' | 'aprobada' | 'rechazada' | 'entregada'

export type SolicitudProducto = {
  id: string
  solicitudId: string
  productoId: string
  cantidadSolicitada: number
  cantidadEntregada: number
  unidadSolicitadaId?: string | null
  factorConversion?: number | null
  cantidadSolicitadaBase?: number | null
  cantidadEntregadaBase?: number | null
  costoUnitarioAlMomento: number
  subtotal: number
  producto: {
    id: string
    codigo: string
    nombre: string
    unidadMedida: { id: string; abreviatura: string }
  }
}

export type SolicitudListItem = {
  id: string
  codigo: string
  proyectoId: string
  estado: SolicitudEstado
  fechaSolicitud: string
  fechaAprobacion: string | null
  fechaEntrega: string | null
  fechaRechazo: string | null
  comentario: string | null
  motivoRechazo: string | null
  adminId: string
  bodegaId: string
  solicitadoPorId: string
  aprobadoPorId: string | null
  entregadoPorId: string | null
  rechazadoPorId: string | null
  proyecto: {
    id: string
    codigo: string
    nombreProyecto: string
    estado?: { id: string; nombre: string; colorHex: string | null }
  }
  solicitadoPor: { id: string; nombre: string }
  aprobadoPor: { id: string; nombre: string } | null
  entregadoPor: { id: string; nombre: string } | null
  rechazadoPor: { id: string; nombre: string } | null
  totalItems: number
}

export type SolicitudDetalle = SolicitudListItem & {
  detalles: SolicitudProducto[]
}

export type CrearSolicitudInput = {
  items: Array<{ productoId: string; cantidadSolicitada: number; unidadMedidaId?: string }>
  comentario?: string
}

export type AprobarSolicitudInput = CrearSolicitudInput
export type EntregarSolicitudInput = {
  items: Array<{ productoId: string; cantidadEntregada: number; unidadMedidaId?: string }>
  comentario?: string
}
export type RechazarSolicitudInput = { motivo: string }

export type ListSolicitudesQuery = {
  bodegaId?: string
  proyectoId?: string
  estado?: SolicitudEstado
  page: number
  pageSize: number
}

// ─────────────────────────────────────────────────────────────
//  Nodos del recorrido (mapa)
// ─────────────────────────────────────────────────────────────

/**
 * Nodo del recorrido del proyecto (estudio previo + avances).
 * Cada nodo es un punto (lat, lng) en el orden planificado.
 * El back calcula `kmAcumulado` con Haversine.
 */
export type ProyectoNodo = {
  id: string
  proyectoId: string
  latitud: number
  longitud: number
  nombre: string | null
  tipo: 'inicio' | 'intermedio' | 'fin'
  orden: number
  kmAcumulado: number
  notas: string | null
}

export type CreateProyectoNodoInput = {
  latitud: number
  longitud: number
  nombre?: string
  tipo?: 'inicio' | 'intermedio' | 'fin'
  orden?: number
  notas?: string
  /**
   * `kmAcumulado` calculado por el planificador OSRM (distancia
   * REAL recorrida por la polyline). Si está presente, el back
   * lo respeta. Si no, recalcula con Haversine.
   */
  kmAcumulado?: number
}

export type UpdateProyectoNodoInput = Partial<CreateProyectoNodoInput>

// ─────────────────────────────────────────────────────────────
//  Avances (Capa 7)
// ─────────────────────────────────────────────────────────────

export type AvanceFoto = {
  key: string
  url?: string | null
  mimeType?: string | null
  sizeBytes?: number
  orden?: number
}

export type AvanceProducto = {
  id: string
  avanceId: string
  productoId: string
  cantidadUtilizada: number
  costoUnitarioAlMomento: number
  subtotal: number
  producto: {
    id: string
    codigo: string
    nombre: string
    unidadMedida: { id: string; abreviatura: string }
  }
}

export type AvanceListItem = {
  id: string
  proyectoId: string
  adminId: string
  fechaAvance: string
  tecnicoId: string
  kmAvanzadosEnEstaFecha: number
  descripcion: string
  ubicacion: string | null
  fotos: AvanceFoto[]
  fechaRegistro: string
  tecnico: { id: string; nombre: string }
  totalProductosUsados: number
  nodo?: ProyectoNodo | null
}

export type AvanceDetalle = AvanceListItem & {
  productosUtilizados: AvanceProducto[]
}

export type CrearAvanceInput = {
  fechaAvance: string
  tecnicoId?: string
  kmAvanzadosEnEstaFecha: number
  descripcion: string
  ubicacion?: string
  /** Nodo del recorrido al que se llegó con este avance. */
  nodoId?: string
  fotos?: AvanceFoto[]
  productosUtilizados?: Array<{
    productoId: string
    cantidadUtilizada: number
  }>
}

export type ListAvancesQuery = {
  proyectoId: string
  page: number
  pageSize: number
}
