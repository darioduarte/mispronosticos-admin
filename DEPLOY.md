# Despliegue del panel admin

El panel **no es otro API**: es Next.js estático/SSR que llama a tu backend Express existente en DigitalOcean (`/api/admin/*`).

```
App móvil  ──────────►  mispronosticosBackend (DO)  ◄───  Panel admin (Vercel o DO)
Web HBS    ──────────►  mispronosticos.com
```

---

## Opción A — Vercel (recomendada)

No cambias tu App Platform actual. Solo añades el frontend del admin.

### 1. Subir el repo a GitHub

```bash
cd mispronosticos-admin
git remote add origin git@github.com:TU_USUARIO/mispronosticos-admin.git
git add .
git commit -m "Panel admin Next.js"
git push -u origin main
```

### 2. Importar en Vercel

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository → `mispronosticos-admin`
2. Framework: **Next.js** (auto)
3. Root Directory: `./`
4. **Environment Variables** (Production):

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://mispronosticos.com` |

5. Deploy

### 3. Dominio

En Vercel → Settings → Domains → añade:

`admin.mispronosticos.com`

En tu DNS (DigitalOcean, Cloudflare, etc.):

| Tipo | Nombre | Valor |
|------|--------|--------|
| CNAME | `admin` | `cname.vercel-dns.com` (Vercel te lo indica) |

### 4. Variables en DigitalOcean (backend)

App Platform → tu app **backend** → Settings → App-Level Environment Variables:

```env
ADMIN_PANEL_ORIGIN=https://admin.mispronosticos.com
ADMIN_PANEL_PASSWORD=contraseña_larga_y_segura
JWT_SECRET=...   # el que ya uses en prod
```

Opcional (previews de Vercel):

```env
ADMIN_PANEL_ORIGIN=https://admin.mispronosticos.com,https://mispronosticos-admin.vercel.app
```

**Redeploy** el backend después de cambiar variables.

### 5. Verificar

1. `https://admin.mispronosticos.com/login`
2. Email admin + `ADMIN_PANEL_PASSWORD`
3. Network tab: peticiones a `https://mispronosticos.com/api/admin/...` con status 200

Health del API admin: `GET https://mispronosticos.com/api/admin/health`

---

## Opción B — Segundo componente en DigitalOcean

Todo en DO, dos servicios en la misma App (o dos Apps).

Ver plantilla: `mispronosticosBackend/.do/app.yaml.example`

Resumen:

1. Crea repo `mispronosticos-admin` en GitHub
2. DO → Apps → Add Component → Web Service → repo admin
3. Build: `npm install && npm run build`
4. Run: `npm start`
5. Env admin: `NEXT_PUBLIC_API_BASE_URL=https://mispronosticos.com`
6. Env backend: `ADMIN_PANEL_ORIGIN=https://admin.tu-dominio.com`

Coste aproximado: +$5–12/mes por el componente admin.

---

## Checklist producción

- [ ] `ADMIN_PANEL_PASSWORD` distinta a la de desarrollo
- [ ] `JWT_SECRET` definido en DO
- [ ] `ADMIN_PANEL_ORIGIN` = URL exacta del panel (https, sin `/` final)
- [ ] `NEXT_PUBLIC_API_BASE_URL` = URL del backend (https://mispronosticos.com)
- [ ] Redeploy backend tras cambiar env
- [ ] Probar login y una pantalla (`/partidos`, `/pronosticos-ia`)

---

## Desarrollo local (referencia)

```bash
# Terminal 1
cd mispronosticosBackend && npm start   # :3000

# Terminal 2
cd mispronosticos-admin && npm run dev  # :3001
```

Backend `.env`:

```env
ADMIN_PANEL_ORIGIN=http://localhost:3001
ADMIN_PANEL_PASSWORD=...
JWT_SECRET=...
```

Admin `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```
