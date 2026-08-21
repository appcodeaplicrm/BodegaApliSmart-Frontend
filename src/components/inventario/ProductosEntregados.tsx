import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarClock, Camera, ClipboardList, ExternalLink, MapPin, PackageCheck, Search, UserRound } from 'lucide-react'
import { PageHeader } from '../PageHeader'
import { api } from '../../lib/api'
import { useBodegaActiva } from '../../store/bodegaActiva'
import { MapaProductosEntregados, type PuntoProductoEntregado } from './MapaProductosEntregados'
import { Modal } from '../Modal'
import { imageUrl } from '../../lib/apiBase'

type Entregado = {
  id: string; serial: string; latitud: number; longitud: number; registradoAt: string
  producto: { id: string; nombre: string; codigo: string }
  reporte: {
    id: string; descripcion: string; enviadoAt: string
    tecnico: { id: string; nombre: string }
    pedido: { id: string; codigo: string }
    evidencias: Array<{ id: string; fotoKey: string; latitud: number; longitud: number; capturadaAt: string }>
  }
}

export function ProductosEntregados() {
  const bodegaId = useBodegaActiva()
  const [items, setItems] = useState<Entregado[]>([])
  const [buscar, setBuscar] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [seleccionado, setSeleccionado] = useState<Entregado | null>(null)
  const [fotoAmpliada, setFotoAmpliada] = useState<{ src: string; titulo: string; fecha: string } | null>(null)

  useEffect(() => {
    if (!bodegaId) return
    setCargando(true); setError('')
    void api.get<{ items: Entregado[] }>(`/pedidos/productos-entregados/mapa?bodegaId=${encodeURIComponent(bodegaId)}`)
      .then((data) => setItems(data.items))
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false))
  }, [bodegaId])

  const visibles = useMemo(() => {
    const q = buscar.trim().toLocaleLowerCase()
    return q ? items.filter((item) => item.serial.toLocaleLowerCase().includes(q)) : items
  }, [items, buscar])
  const puntos: PuntoProductoEntregado[] = useMemo(() => visibles.map((item) => ({
    id: item.id, serial: item.serial, latitud: item.latitud, longitud: item.longitud,
    producto: item.producto, tecnico: item.reporte.tecnico.nombre,
  })), [visibles])
  const seleccionar = useCallback((id: string) => {
    setSeleccionado(items.find((item) => item.id === id) ?? null)
  }, [items])
  const cerrarDetalle = useCallback(() => {
    if (fotoAmpliada) {
      setFotoAmpliada(null)
      return
    }
    setSeleccionado(null)
  }, [fotoAmpliada])

  return <div className="h-full flex flex-col overflow-hidden">
    <PageHeader title="PRODUCTOS ENTREGADOS" subtitle="INVENTARIO · TRAZABILIDAD GEOGRÁFICA" />
    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
      <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
        <section className="border border-border bg-card min-w-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div><h2 className="font-semibold">Seriales ubicados</h2><p className="text-xs text-muted-foreground">{visibles.length} de {items.length} productos</p></div>
              <PackageCheck className="text-primary" size={22} />
            </div>
            <label className="relative block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por serial..." className="w-full h-10 pl-9 pr-3 bg-background border border-border outline-none focus:border-primary text-sm" />
            </label>
          </div>
          <div className="lg:max-h-[calc(100vh-270px)] overflow-y-auto p-2 space-y-2">
            {cargando && <p className="p-5 text-sm text-muted-foreground text-center">Cargando ubicaciones...</p>}
            {error && <p className="p-4 text-sm text-red-400">{error}</p>}
            {!cargando && !error && visibles.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No hay productos reportados con ese serial.</p>}
            {visibles.map((item) => <button type="button" onClick={() => setSeleccionado(item)} key={item.id} className="block w-full text-left border border-border p-3 hover:border-primary/60 hover:bg-primary/5 transition-colors">
              <div className="flex gap-3"><MapPin size={17} className="text-primary mt-0.5 shrink-0" /><div className="min-w-0">
                <div className="font-medium truncate">{item.producto.nombre}</div>
                <div className="text-xs font-mono text-primary mt-0.5">SERIAL · {item.serial}</div>
                <div className="text-xs text-muted-foreground mt-2">{item.reporte.pedido.codigo} · {item.reporte.tecnico.nombre}</div>
                <div className="text-[11px] text-muted-foreground mt-1">{new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(item.registradoAt))}</div>
              </div></div>
            </button>)}
          </div>
        </section>
        <section className="min-w-0"><MapaProductosEntregados key={`${bodegaId}-${buscar}`} puntos={puntos} onSelect={seleccionar} /></section>
      </div>
    </main>
    <Modal
      open={Boolean(seleccionado)}
      onClose={cerrarDetalle}
      title="DETALLE DEL PRODUCTO ENTREGADO"
      description={seleccionado ? `${seleccionado.producto.nombre} · ${seleccionado.serial}` : undefined}
      icon={<PackageCheck size={20} />}
      size="lg"
      footer={<button type="button" onClick={() => setSeleccionado(null)} className="h-10 px-5 border border-border hover:border-primary transition-colors">Cerrar</button>}
    >
      {seleccionado && <div className="p-5 space-y-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <Dato label="Producto" value={seleccionado.producto.nombre} icon={<PackageCheck size={16} />} />
          <Dato label="Código / SKU" value={seleccionado.producto.codigo} />
          <Dato label="Número de serie" value={seleccionado.serial} destacado />
          <Dato label="Solicitud" value={seleccionado.reporte.pedido.codigo} icon={<ClipboardList size={16} />} />
          <Dato label="Técnico responsable" value={seleccionado.reporte.tecnico.nombre} icon={<UserRound size={16} />} />
          <Dato label="Fecha del reporte" value={formatearFecha(seleccionado.reporte.enviadoAt)} icon={<CalendarClock size={16} />} />
        </div>
        <section className="border border-border p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Uso reportado</div>
          <p className="text-sm leading-6 whitespace-pre-wrap">{seleccionado.reporte.descripcion}</p>
        </section>
        <section className="border border-border p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2"><Camera size={16} className="text-primary" /><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Evidencia fotográfica</span></div>
            <span className="text-xs text-muted-foreground">{seleccionado.reporte.evidencias.length} foto{seleccionado.reporte.evidencias.length === 1 ? '' : 's'}</span>
          </div>
          {seleccionado.reporte.evidencias.length === 0 ? (
            <div className="border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Este reporte no tiene fotografías.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {seleccionado.reporte.evidencias.map((foto, index) => {
                const src = imageUrl(foto.fotoKey)
                if (!src) return null
                return <button type="button" key={foto.id} onClick={() => setFotoAmpliada({ src, titulo: `Evidencia ${index + 1} · ${seleccionado.producto.nombre}`, fecha: formatearFecha(foto.capturadaAt) })} className="group relative block w-full aspect-[4/3] overflow-hidden border border-border bg-background text-left">
                  <img src={src} alt={`Evidencia ${index + 1} de ${seleccionado.producto.nombre}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2.5 pt-8 pb-2 text-[10px] text-white">
                    Foto {index + 1} · {formatearFecha(foto.capturadaAt)}
                  </div>
                </button>
              })}
            </div>
          )}
        </section>
        <section className="border border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-3"><MapPin size={18} className="text-primary shrink-0 mt-0.5" /><div><div className="text-sm font-medium">Ubicación registrada</div><div className="text-xs font-mono text-muted-foreground mt-1">{seleccionado.latitud.toFixed(7)}, {seleccionado.longitud.toFixed(7)}</div></div></div>
          <a href={`https://www.google.com/maps?q=${seleccionado.latitud},${seleccionado.longitud}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 px-4 border border-primary text-primary text-sm hover:bg-primary/10"><ExternalLink size={15} /> Abrir en el mapa</a>
        </section>
      </div>}
    </Modal>
    <Modal
      open={Boolean(fotoAmpliada)}
      onClose={() => setFotoAmpliada(null)}
      title={fotoAmpliada?.titulo ?? 'EVIDENCIA FOTOGRÁFICA'}
      description={fotoAmpliada?.fecha}
      icon={<Camera size={20} />}
      size="full"
      scrollBody={false}
      contentClassName="bg-[#111]"
    >
      {fotoAmpliada && <div className="h-[72dvh] w-full flex items-center justify-center bg-[#111] p-2 sm:p-5">
        <img src={fotoAmpliada.src} alt={fotoAmpliada.titulo} className="max-h-full max-w-full object-contain select-none" />
      </div>}
    </Modal>
  </div>
}

function Dato({ label, value, icon, destacado = false }: { label: string; value: string; icon?: ReactNode; destacado?: boolean }) {
  return <div className="border border-border p-3 min-w-0"><div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{icon}{label}</div><div className={`text-sm break-words ${destacado ? 'font-mono text-primary' : 'font-medium'}`}>{value || 'Sin información'}</div></div>
}

function formatearFecha(value: string) {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date(value))
}
