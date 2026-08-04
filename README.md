# StockPro — Frontend

React + Vite + TypeScript + Tailwind CSS.

## Stack

- **React 19** + **Vite 6** (dev server + build)
- **TypeScript 5** (estricto)
- **Tailwind CSS 4** (utility-first)
- **react-router-dom 7** (SPA routing)
- **lucide-react** (iconos)
- **Leaflet** + **react-leaflet** (mapa de bodegas)
- **@react-pdf/renderer** (generación de PDFs)

## Estructura

```
src/
├── main.tsx               # bootstrap React
├── App.tsx                # rutas + guards
├── lib/
│   ├── api.ts             # helper fetch con auto-refresh JWT
│   ├── apiBase.ts         # URL pública de archivos subidos
│   ├── routing.ts         # smart redirect según rol
│   └── pdf.tsx            # generación de PDFs (pedidos, devoluciones)
├── store/                 # useSyncExternalStore (sin Zustand, simple)
│   ├── auth.ts            # sesión + permisos efectivos
│   ├── bodegas.ts         # listado de bodegas del tenant
│   ├── bodegaActiva.ts    # bodega activa (localStorage)
│   ├── productos.ts       # CRUD + catálogo
│   ├── pedidos.ts         # + wizard de aprobación
│   ├── devoluciones.ts    # flujo dual operador/bodeguero
│   ├── usuarios.ts        # CRUD + paginación
│   ├── roles.ts           # CRUD + matriz de permisos
│   ├── permisos.ts        # override per-user
│   ├── marcas.ts          # CRUD per-bodega
│   ├── alertas.ts         # badge counter
│   └── ...
├── components/
│   ├── AppLayout.tsx      # shell (sidebar + outlet)
│   ├── Sidebar.tsx        # navegación filtrada por permisos
│   ├── DashboardView.tsx  # KPIs + actividad reciente
│   ├── SelectorBodega.tsx # dropdown + botón "+" crear
│   ├── OnboardingAdmin.tsx# wizard de primera bodega
│   ├── AdminTenants.tsx   # vista de superadmin
│   ├── WizardAprobacion.tsx
│   ├── DevolucionWizard.tsx
│   └── ...
└── types/                 # tipos compartidos
```

## Setup local

```powershell
cd C:\Users\aplir\Desktop\BODEGA\stockpro
npm install
npm run dev
```

El front queda en `http://localhost:5173` y habla con el back en `http://localhost:3001` (vía proxy de Vite).

## Variables de entorno

- `VITE_API_URL` — URL del back (default: `http://localhost:3001`)

## Build de producción

```powershell
npm run build   # genera dist/
npm run preview # sirve dist/ localmente
```

## Conexión al back

El helper `api.get` / `api.post` / etc. (`src/lib/api.ts`) maneja:
- Cookies httpOnly (access + refresh)
- Auto-refresh del access token cuando vence
- Headers JSON / FormData
- Tipado genérico de respuesta
