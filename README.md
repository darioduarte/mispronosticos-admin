# MisPronósticos — Panel Admin

Consola operativa en **Next.js 16** (App Router, TypeScript, React 19) que consume
el backend Express existente mediante `/api/admin/*` (JWT admin + CORS por origen).

No es un segundo API: la lógica de negocio vive en `mispronosticosBackend`.

## Stack

- Next.js 16 · React 19 · TypeScript
- TanStack Query · Tailwind CSS 4
- Auth: password admin (+ Google OAuth opcional)
- Deploy típico: Vercel (frontend) + DigitalOcean (API)

## Estructura

```text
src/app/
  login/                 Acceso
  (dashboard)/           Pantallas operativas
  api/auth/login/        Proxy/login hacia el backend
src/components/          Vistas y paneles por dominio
src/lib/                 Cliente API, auth, tipos, motores
docs/DEPLOY.md           Despliegue Vercel / DO
```

## Arranque local

1. Backend en el puerto **3000** (`mispronosticosBackend`).
2. Copia `.env.example` → `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

3. En el backend (`.env`):

```env
ADMIN_PANEL_PASSWORD=tu-clave-segura
JWT_SECRET=...
ADMIN_PANEL_ORIGIN=http://localhost:3001
```

4. Panel:

```bash
npm install
npm run dev
```

Abre [http://localhost:3001/login](http://localhost:3001/login).

Variables de producción: [`.env.production.example`](./.env.production.example).  
Guía de despliegue: [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## Pantallas

| Ruta | Descripción |
|------|-------------|
| `/login` | Acceso admin |
| `/dashboard` | Resumen operativo |
| `/partidos` | Sync, stats, árbitros, pre-match |
| `/ligas` / `/ligas-destacadas` | Catálogo y destacadas |
| `/pronosticos-ia` / `/pronosticos-ia-vivo` | Revisión IA prepartido / live |
| `/predictions-table` | Tabla de predicciones |
| `/control-crons` / `/control-analisis-vivo` | Jobs y live pipeline |
| `/parametros-en-vivo` / `/monitoreo` | Runtime live y métricas |
| `/suscripciones` / `/trials` / `/webhooks-pago` | Acceso y pagos |
| `/errores` / `/errores-pago` / `/errores-cuota-ia` | Incidentes |
| `/notificaciones` / `/sugerencias` / `/historias` / `/arbitros` | Ops auxiliares |

## Pruebas

```bash
npm run test:engine   # motor de selección de picks
npm run lint
npm run build
```

## Seguridad

- No versionar `.env.local` ni secretos (ver `.gitignore`).
- El panel solo habla con orígenes/backends configurados; la autorización la impone el backend (`requireAdmin` / JWT admin).
