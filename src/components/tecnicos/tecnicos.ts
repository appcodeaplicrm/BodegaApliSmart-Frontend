import type { LucideIcon } from 'lucide-react'
import {
  Wrench,
  BellRing,
  PackageOpen,
  Undo2,
  HardHat,
  FolderKanban,
} from 'lucide-react'

export type TecnicoSubKey =
  | 'tecnicos:herramientas'
  | 'tecnicos:alertas'
  | 'tecnicos:solicitudes'
  | 'tecnicos:devoluciones'
  | 'tecnicos:asignadas'
  | 'tecnicos:proyectos'

export type Submodulo = {
  key: TecnicoSubKey
  label: string
  descripcion: string
  icon: LucideIcon
  accion: string
  kpis: { label: string; value: string; accent: 'text-primary' | 'text-secondary' | 'text-muted-foreground' }[]
}

export const SUBMODULOS_TECNICOS: Submodulo[] = [
  {
    key: 'tecnicos:herramientas',
    label: 'Herramientas Obligatorias',
    descripcion: 'Lista maestra de herramientas que cada técnico debe portar.',
    icon: Wrench,
    accion: 'Nueva herramienta',
    kpis: [
      { label: 'Total registradas', value: '0', accent: 'text-primary' },
      { label: 'Asignadas hoy', value: '0', accent: 'text-secondary' },
      { label: 'Sin asignar', value: '0', accent: 'text-muted-foreground' },
    ],
  },
  {
    key: 'tecnicos:alertas',
    label: 'Alertas de Kit',
    descripcion: 'Notificaciones cuando un kit está incompleto o próximo a vencer.',
    icon: BellRing,
    accion: 'Configurar alerta',
    kpis: [
      { label: 'Alertas activas', value: '0', accent: 'text-primary' },
      { label: 'Críticas', value: '0', accent: 'text-primary' },
      { label: 'Resueltas hoy', value: '0', accent: 'text-secondary' },
    ],
  },
  {
    key: 'tecnicos:solicitudes',
    label: 'Solicitudes de Recursos',
    descripcion: 'Pedidos de recursos adicionales enviados por los técnicos.',
    icon: PackageOpen,
    accion: 'Nueva solicitud',
    kpis: [
      { label: 'Pendientes', value: '0', accent: 'text-primary' },
      { label: 'En revisión', value: '0', accent: 'text-muted-foreground' },
      { label: 'Aprobadas hoy', value: '0', accent: 'text-secondary' },
    ],
  },
  {
    key: 'tecnicos:devoluciones',
    label: 'Devoluciones',
    descripcion: 'Registro de herramientas devueltas al finalizar obra o turno.',
    icon: Undo2,
    accion: 'Registrar devolución',
    kpis: [
      { label: 'Devoluciones hoy', value: '0', accent: 'text-primary' },
      { label: 'Pendientes', value: '0', accent: 'text-muted-foreground' },
      { label: 'Con daños', value: '0', accent: 'text-primary' },
    ],
  },
  {
    key: 'tecnicos:asignadas',
    label: 'Herramientas Asignadas',
    descripcion: 'Trazabilidad de qué herramienta tiene cada técnico hoy.',
    icon: HardHat,
    accion: 'Asignar herramienta',
    kpis: [
      { label: 'Activas', value: '0', accent: 'text-secondary' },
      { label: 'Técnicos con kit', value: '0', accent: 'text-primary' },
      { label: 'Vencen hoy', value: '0', accent: 'text-primary' },
    ],
  },
  {
    key: 'tecnicos:proyectos',
    label: 'Proyectos',
    descripcion: 'Obras y proyectos activos con sus técnicos y herramientas asignadas.',
    icon: FolderKanban,
    accion: 'Nuevo proyecto',
    kpis: [
      { label: 'Activos', value: '0', accent: 'text-secondary' },
      { label: 'Técnicos asignados', value: '0', accent: 'text-primary' },
      { label: 'Por iniciar', value: '0', accent: 'text-muted-foreground' },
    ],
  },
]

export function getSubmodulo(key: string): Submodulo | undefined {
  return SUBMODULOS_TECNICOS.find((s) => s.key === key)
}
