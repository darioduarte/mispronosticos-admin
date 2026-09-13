# run_instruction.md

Cómo compilar y ejecutar el panel admin (Next.js 16).
No es un segundo API: necesita el backend en el puerto 3000.

## Requisitos

- Node.js 20+
- `mispronosticosBackend` corriendo en `http://localhost:3000`

## Compilar / arrancar

```bash
cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm install
npm run dev
```

Abre `http://localhost:3001/login`.

Build de producción: `npm run build` · `npm start`.

En el backend (`.env` del API, no de este repo): `ADMIN_PANEL_PASSWORD`, `JWT_SECRET`,
`ADMIN_PANEL_ORIGIN=http://localhost:3001`.

## Pruebas

Suite de funciones puras (`src/lib/*.test.ts`, node:test + tsx). Sin red, sin
backend, sin `.env` reales.

```bash
npm run test:engine
npm run lint
npm run build
```

CI en GitHub Actions (push/PR a `main`): `.github/workflows/ci.yml`
(`npm ci`, `npm run lint -- src/lib`, `test:engine`, `build` con
`NEXT_PUBLIC_API_BASE_URL` dummy). El lint de todo el panel (`npm run lint`)
tiene hallazgos previos en UI; CI cubre `src/lib`.

Pantallas y deploy: `README.md` y `docs/DEPLOY.md`.
