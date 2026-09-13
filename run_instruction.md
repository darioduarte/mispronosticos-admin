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

```bash
npm run test:engine
npm run lint
npm run build
```

Pantallas y deploy: `README.md` y `docs/DEPLOY.md`.
