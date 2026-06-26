# Mis Pronósticos — Panel Admin

Frontend Next.js del panel administrativo. Consume el **mismo backend Express** (`mispronosticosBackend`) vía `/api/admin/*`.

## Desarrollo local

1. Backend en puerto **3000** (`mispronosticosBackend`):

```bash
cd ../mispronosticosBackend && npm start
```

2. Copia `.env.example` → `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

3. En el backend `.env`:

```env
ADMIN_PANEL_PASSWORD=tu-clave-segura
JWT_SECRET=...
ADMIN_PANEL_ORIGIN=http://localhost:3001
```

4. Panel en puerto **3001**:

```bash
npm run dev
```

Abre [http://localhost:3001/login](http://localhost:3001/login)

## Despliegue producción

**Backend:** sigue en DigitalOcean App Platform (`mispronosticosBackend`).

**Panel admin:** Vercel (recomendado) o segundo componente en DO.

Guía completa: **[DEPLOY.md](./DEPLOY.md)**

Variables producción: **[.env.production.example](./.env.production.example)**

## Pantallas

| Ruta | Descripción |
|------|-------------|
| `/login` | Acceso admin |
| `/partidos` | Ligas destacadas, árbitros, stats |
| `/pronosticos-ia` | Revisión pronósticos IA |

## Migración HBS

Ver `mispronosticosBackend/docs/ADMIN_PANEL_MIGRATION.md`. La web pública no se toca hasta completar Fase A.
