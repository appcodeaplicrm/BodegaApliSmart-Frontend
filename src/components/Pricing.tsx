import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Plan público que devuelve `GET /public/plans` (sin auth).
 * Misma forma que el back: `priceAmount` viene en centavos (USD * 100).
 * `features` solo trae las que están `enabled: true` en el plan.
 */
type PublicPlan = {
  id: string
  code: string
  name: string
  description: string | null
  priceAmount: number | null
  currency: string
  billingPeriod: string
  features: {
    code: string
    name: string
    type: string
    unit: string | null
    limitValue: number | null
  }[]
}

type PlanView = {
  id: string
  code: string
  name: string
  desc: string
  price: number | null
  features: string[]
  cta: string
  highlight: boolean
}

const CTA_POR_PLAN: Record<string, string> = {
  starter: 'Empezar',
  inicial: 'Empezar',
  pro: 'Prueba 14 días',
  enterprise: 'Hablar con ventas',
}

const HIGHLIGHT_POR_CODIGO = new Set(['pro'])

/**
 * Traduce los features de un plan (los del catálogo del back) a bullets
 * legibles para el pricing. Ej: `warehouses:limitValue:5` →
 * "hasta 5 bodegas". Si la feature no tiene límite, usamos la versión
 * "ilimitada" del nombre.
 */
function featuresABullets(plan: PublicPlan): string[] {
  const out: string[] = []
  for (const f of plan.features) {
    out.push(featureABullet(f.code, f.limitValue))
  }
  return out
}

function featureABullet(code: string, limit: number | null): string {
  switch (code) {
    case 'users':
      return limit == null ? 'usuarios ilimitados' : `hasta ${limit} usuarios`
    case 'warehouses':
      return limit == null ? 'bodegas ilimitadas' : `hasta ${limit} bodegas`
    case 'products':
      return limit == null ? 'productos ilimitados' : `hasta ${limit} productos`
    case 'custom_roles':
      return limit == null
        ? 'roles personalizados ilimitados'
        : `hasta ${limit} roles personalizados`
    case 'ai.audit':
      return 'auditoría inteligente con IA'
    case 'ai.integrated':
      return 'IA integrada y lista para usar'
    case 'ai.byok':
      return 'panel para configurar tu propia IA'
    default:
      // Feature desconocida: la mostramos tal cual viene del back
      return limit == null ? code : `${code} (máx. ${limit})`
  }
}

export function Pricing() {
  const [planes, setPlanes] = useState<PlanView[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    void api
      .get<PublicPlan[]>('/public/plans')
      .then((data) => {
        if (cancelado) return
        const mapped: PlanView[] = data.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          desc: p.description ?? '',
          price: p.priceAmount == null ? null : Math.round(p.priceAmount / 100),
          features: featuresABullets(p),
          cta: CTA_POR_PLAN[p.code] ?? 'Empezar',
          highlight: HIGHLIGHT_POR_CODIGO.has(p.code),
        }))
        setPlanes(mapped)
      })
      .catch(() => {
        if (cancelado) return
        // Si falla el endpoint público, caemos al fallback hardcoded
        // (mejor mostrar algo que nada). El endpoint requiere que el
        // superadmin haya publicado al menos un plan.
        setPlanes(FALLBACK_PLANS)
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [])

  const visibles = loading ? FALLBACK_PLANS : planes

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <div
            className="text-xs text-muted-foreground uppercase tracking-widest mb-3"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            — PRECIOS
          </div>
          <h2
            className="text-5xl md:text-6xl uppercase text-foreground leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
          >
            planes que <span className="text-primary">crecen contigo</span>
          </h2>
          <p
            className="mt-4 text-sm text-muted-foreground max-w-xl mx-auto"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            sin contratos forzosos, sin letra chica. cancelas cuando quieras y te quedas con tus
            datos exportados.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {visibles.map((p) => (
            <div
              key={p.name}
              className={`relative bg-card border ${
                p.highlight ? 'border-secondary' : 'border-border'
              } p-6 flex flex-col`}
            >
              {p.highlight && (
                <>
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-secondary" />
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-3 py-1 text-xs"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}
                  >
                    POPULAR
                  </div>
                </>
              )}

              <h3
                className="text-2xl text-foreground uppercase"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
              >
                {p.name}
              </h3>

              <p
                className="mt-2 text-sm text-muted-foreground leading-relaxed"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {p.desc}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                {p.price !== null ? (
                  <>
                    <span
                      className="text-5xl text-foreground"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900 }}
                    >
                      ${p.price}
                    </span>
                    <span
                      className="text-sm text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      /mes
                    </span>
                  </>
                ) : (
                  <span
                    className="text-4xl text-foreground"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                  >
                    a medida
                  </span>
                )}
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-foreground"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <span className="text-secondary mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`mt-8 w-full py-3 text-sm font-medium ${
                  p.highlight
                    ? 'bg-secondary text-secondary-foreground hover:opacity-90'
                    : 'border border-border text-foreground hover:border-foreground/40'
                } transition-all`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * Fallback hardcoded para cuando el endpoint público falla (ej: el
 * superadmin aún no publicó ningún plan, o el back está caído). Mejor
 * mostrar algo decente que una pantalla en blanco.
 */
const FALLBACK_PLANS: PlanView[] = [
  {
    id: 'fallback-inicial',
    code: 'inicial',
    name: 'Inicial',
    desc: 'para bodegas que están digitalizando sus primeras operaciones.',
    price: 49,
    features: [
      'hasta 2 usuarios',
      '1.000 sku activos',
      'app móvil incluida',
      'soporte por email',
      'reportes básicos',
    ],
    cta: 'Empezar',
    highlight: false,
  },
  {
    id: 'fallback-pro',
    code: 'pro',
    name: 'Pro',
    desc: 'la opción más elegida por operadores logísticos en crecimiento.',
    price: 149,
    features: [
      'hasta 15 usuarios',
      'sku ilimitados',
      'mapa de bodega 3d',
      'integración con erp',
      'soporte 24/7',
      'auditoría firmada',
    ],
    cta: 'Prueba 14 días',
    highlight: true,
  },
  {
    id: 'fallback-enterprise',
    code: 'enterprise',
    name: 'Enterprise',
    desc: 'multi-bodega, rpa personalizado y sla dedicado.',
    price: null,
    features: [
      'usuarios ilimitados',
      'multi-sede',
      'api dedicada',
      'gerente de cuenta',
      'capacitación on-site',
      'sla 99.9%',
    ],
    cta: 'Hablar con ventas',
    highlight: false,
  },
]
