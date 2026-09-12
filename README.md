# Status Financiero

Sistema de rendición de gastos: sube resúmenes de tarjeta en PDF (Visa y Amex Santander, Mastercard Black y Visa de Galicia), los parsea automáticamente, aplica reglas de clasificación editables (empresa / personal / impuesto / excluido) y muestra un dashboard con el historial mensual y proyecciones de cuotas pendientes.

Reemplaza el proceso manual de armar los Excel "Rendición de Gastos" tarjeta por tarjeta.

## Stack

- **Backend**: Node.js + Express + Prisma + JWT (monorepo workspace `backend/`)
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind v4 (monorepo workspace `frontend/`)
- **DB**: PostgreSQL
- **Deploy**: Railway (3 servicios: Postgres, backend, frontend)

## Setup local

```bash
npm install

# Backend
cp backend/.env.example backend/.env
# editar backend/.env con tu DATABASE_URL local

cd backend
npm run db:push
npm run db:seed   # crea usuario admin + tarjetas + reglas iniciales
cd ..

# Frontend
cp frontend/.env.example frontend/.env

npm run dev   # levanta frontend (3000) y backend (4000) juntos
```

Usuario admin por defecto tras el seed: `admin@status-financiero.com` / `Admin1234!` (configurable con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` antes de correr el seed).

## Deploy en Railway

1. Crear un proyecto en Railway con 3 servicios: **Postgres** (plugin nativo), **backend** y **frontend**, ambos apuntando a este repo.
2. **backend**: Root Directory `backend`. Variables: `DATABASE_URL` (la de Railway Postgres), `JWT_SECRET`, `FRONTEND_URL` (URL pública del servicio frontend). `railway.toml` ya define el `releaseCommand` (`prisma db push`) y el healthcheck.
3. **frontend**: Root Directory `frontend`. Variables: `API_URL` (URL pública del servicio backend + `/api`).
4. Correr el seed una vez (`npm run db:seed --workspace=backend`, vía Railway shell) para crear el usuario admin y las tarjetas/reglas iniciales.
5. Montar un volumen persistente en el backend (ej. `/data/statements`) y setear `STATEMENTS_DIR=/data/statements`, para que los PDFs originales sobrevivan a los redeploys.

## Bancos soportados

| Tarjeta | bank_profile | Parser |
|---|---|---|
| Visa 2773 (Santander) | `VISA_SANTANDER` | `backend/src/lib/parsers/visaSantander.js` |
| Amex 1296 (Santander) | `AMEX_SANTANDER` | `backend/src/lib/parsers/amexSantander.js` |
| Mastercard Black (Galicia) | `MASTERCARD_GALICIA` | `backend/src/lib/parsers/mastercardGalicia.js` |
| Visa Galicia 4902/4910 | `VISA_GALICIA` | `backend/src/lib/parsers/visaGalicia.js` |

Cada banco cambia el formato de su PDF de tanto en tanto — si un resumen nuevo no parsea bien, revisar el regex del parser correspondiente contra el texto extraído (`pdf-parse`).

## Motor de reglas

Las reglas de clasificación (`ClassificationRule`) viven en la base y son editables desde `/rules`. Cada regla matchea por substring (case-insensitive) contra la descripción de la transacción; la de mayor `priority` gana. Si ninguna regla matchea, la transacción queda en `PERSONAL` por default. Casos ambiguos puntuales (un mismo concepto cobrando en dos tarjetas el mismo mes, cargos sin concepto asignado) se reclasifican a mano desde el detalle de cada resumen (`/statements/[id]`) — no todo se resuelve con reglas globales.
