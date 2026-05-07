# Ciudad Magia — Documentación Técnica

> Versión 1.0 · Mayo 2026
> CRM multi-tenant para clubs de fútbol base

---

## Índice

1. [Stack tecnológico](#1-stack-tecnológico)
2. [Arquitectura general](#2-arquitectura-general)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Patrones de código obligatorios](#4-patrones-de-código-obligatorios)
5. [Autenticación y roles](#5-autenticación-y-roles)
6. [Base de datos — tablas principales](#6-base-de-datos--tablas-principales)
7. [Multi-tenancy](#7-multi-tenancy)
8. [Integraciones Google](#8-integraciones-google)
9. [Gestión de temporadas](#9-gestión-de-temporadas)
10. [Cron jobs](#10-cron-jobs)
11. [Deploy y entornos](#11-deploy-y-entornos)
12. [Variables de entorno](#12-variables-de-entorno)
13. [Migraciones SQL](#13-migraciones-sql)
14. [Gotchas y problemas conocidos](#14-gotchas-y-problemas-conocidos)
15. [Backlog técnico pendiente](#15-backlog-técnico-pendiente)

---

## 1. Stack tecnológico

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| Framework | Next.js App Router | 15.x | Server Actions habilitadas |
| Lenguaje | TypeScript | 5.x | React 19 |
| Base de datos | Supabase (PostgreSQL) | — | Auth + Storage incluidos |
| Estilos | Tailwind CSS | 3.x | Componentes propios estilo shadcn |
| Toasts | Sonner | — | |
| Iconos | lucide-react | — | |
| URL state | nuqs | — | Query params tipados |
| Deploy | Vercel | — | Edge Runtime + Serverless + Cron |
| Google APIs | googleapis | — | Sheets, Gmail, Drive, OAuth2 |
| PDF | (librería interna) | — | `src/lib/pdf/` |
| Email | Nodemailer + Gmail | — | App Password en dev |

### Por qué este stack

- **Next.js App Router + Server Actions**: elimina la necesidad de una API REST explícita. Las mutaciones van directamente desde el cliente al servidor sin pasar por endpoints adicionales. Reduce la superficie de ataque y simplifica el código.
- **Supabase**: Auth + PostgreSQL + Storage en un servicio managed. Evita gestionar infraestructura de BD en esta fase.
- **Vercel**: deploy zero-config de Next.js, Edge Middleware, Cron Jobs integrados.
- **Modular Monolith**: una sola aplicación bien estructurada por módulos. Apropiado para equipos pequeños y fase actual del producto. No hay complejidad operacional de microservices.

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL                                    │
│                                                             │
│  ┌─────────────┐    ┌──────────────────────────────────┐   │
│  │  Middleware  │───▶│   Next.js App Router             │   │
│  │  (Edge RT)   │    │   ├── (auth)/login|register      │   │
│  │              │    │   ├── (app)/* — autenticado      │   │
│  │  Lee BD:     │    │   │   └── [todos los módulos]    │   │
│  │  club_members│    │   └── api/                       │   │
│  │  + roles     │    │       ├── cron/*                 │   │
│  │              │    │       ├── google/*               │   │
│  │  Setea:      │    │       └── webhooks/*             │   │
│  │  x-club-id   │    └──────────────┬───────────────────┘   │
│  │  x-member-id │                   │ Server Actions         │
│  │  x-user-roles│                   ▼                       │
│  └─────────────┘    ┌──────────────────────────────────┐   │
│                      │  features/<modulo>/actions/      │   │
│                      │  (lógica de negocio + queries)   │   │
│                      └──────────────┬───────────────────┘   │
└─────────────────────────────────────┼───────────────────────┘
                                      │ service role key
                                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                  │
│  PostgreSQL + Auth + RLS (parcial) + Storage                │
└──────────────────┬──────────────────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
  Google Sheets  Gmail API  RFFM API
  (Drive)                  (rffm.es)
```

### Flujo de una request autenticada

1. Usuario hace clic en algo → Server Action en el cliente.
2. Next.js ejecuta el Server Action en el servidor.
3. El Server Action llama a `getClubContext()` que lee los headers `x-club-id`, `x-member-id`, `x-user-roles` seteados por el Middleware.
4. Valida permisos del rol.
5. Crea el cliente de Supabase con service role y filtra por `club_id`.
6. Devuelve `{ success, error?, ...data }` al cliente.
7. El cliente muestra toast de éxito/error y llama a `router.refresh()`.

---

## 3. Estructura de carpetas

```
Ciudad Magia/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                    # Layout autenticado con sidebar
│   │   │   ├── layout.tsx            # Sidebar + auth check
│   │   │   ├── dashboard/
│   │   │   ├── jugadores/
│   │   │   │   ├── page.tsx          # Lista jugadores
│   │   │   │   ├── [id]/page.tsx     # Ficha jugador
│   │   │   │   ├── nuevo/page.tsx
│   │   │   │   └── importar/page.tsx
│   │   │   ├── entrenadores/
│   │   │   ├── contabilidad/
│   │   │   ├── comunicaciones/
│   │   │   ├── configuracion/
│   │   │   │   └── planificacion/    # Planificación próxima temporada
│   │   │   ├── torneos/
│   │   │   ├── scouting/
│   │   │   │   └── rffm/             # Dashboard RFFM
│   │   │   └── ropa/
│   │   └── api/
│   │       ├── cron/
│   │       │   ├── sync-sheets/      # Sync Google Sheets cada 12h
│   │       │   ├── weekly-sessions/  # Genera sesiones desde horarios
│   │       │   └── rffm-sync/        # Sync datos federativos
│   │       ├── google/
│   │       │   └── callback/         # OAuth callback de Google
│   │       └── webhooks/
│   │
│   ├── features/                     # Módulos de la aplicación
│   │   ├── jugadores/
│   │   │   ├── actions/              # Server actions del módulo
│   │   │   └── components/           # Componentes UI del módulo
│   │   ├── entrenadores/
│   │   ├── contabilidad/
│   │   ├── comunicaciones/
│   │   ├── configuracion/
│   │   │   ├── actions/
│   │   │   │   └── season.actions.ts # initNextSeasonPlanning, activateNextSeason
│   │   │   └── components/
│   │   │       ├── SeasonManagement.tsx
│   │   │       └── SeasonPlanningPage.tsx
│   │   ├── integraciones/
│   │   │   ├── actions/
│   │   │   │   └── backend-sheet.actions.ts
│   │   │   └── components/
│   │   └── rffm/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── admin.ts              # createAdminClient (service role)
│   │   │   ├── server.ts             # createClient server (anon + cookies)
│   │   │   ├── client.ts             # createClient browser
│   │   │   ├── middleware.ts         # Client para Edge Middleware
│   │   │   └── get-club-id.ts        # getClubContext()
│   │   ├── google/
│   │   │   ├── oauth.ts              # getOAuthClient(host?)
│   │   │   ├── backend-export.ts     # Exportar datos a Sheets
│   │   │   └── sheets.ts             # Helpers de Google Sheets API
│   │   ├── email/                    # Envío de emails con Nodemailer
│   │   ├── pdf/                      # Generación de PDFs
│   │   ├── accounting/               # Lógica de cálculos contables
│   │   ├── rffm/                     # Cliente de la API de RFFM
│   │   └── utils/
│   │
│   └── components/                   # UI compartida entre módulos
│       ├── layout/
│       │   └── Sidebar.tsx
│       ├── RoleGuard.tsx
│       └── ui/                       # Componentes base (button, card, etc.)
│
├── supabase/
│   └── migrations/                   # SQL numerado 001..028
│       ├── 001_initial.sql
│       ├── ...
│       └── 028_new_inscriptions_sheet.sql
│
├── vercel.json                        # Cron jobs configurados
├── next.config.ts
├── tailwind.config.ts
└── CLAUDE.md                          # Instrucciones para Claude
```

---

## 4. Patrones de código obligatorios

### Server Action — plantilla estándar

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function doSomething(input: InputType) {
  try {
    const { clubId, memberId, roles } = await getClubContext()

    // 1. Validar permisos
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }

    // 2. Operación en BD — siempre con club_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { data, error } = await sb
      .from('tabla')
      .insert({ club_id: clubId, ...input })

    if (error) return { success: false, error: error.message }

    // 3. Revalidar caché de la ruta afectada
    revalidatePath('/ruta')

    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

**Reglas:**
- Siempre `createAdminClient() as any` — el cast `as any` evita errores de tipos infinitos de supabase-js v2.
- Siempre filtrar/insertar con `club_id` — aislamiento multi-tenant.
- Siempre devolver `{ success, error?, ...data }`. Nunca lanzar excepciones al cliente.
- Siempre `revalidatePath()` tras mutaciones para limpiar caché de Next.js.

---

### Página autenticada — plantilla estándar

```ts
// Obligatorio en toda página bajo (app)/ que lea datos
export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'

export default async function MiPagina() {
  const { clubId } = await getClubContext()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  const { data: jugadores } = await sb
    .from('players')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'active')

  return <MiComponente jugadores={jugadores} />
}
```

---

### Mutación desde componente cliente

```tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function MiComponente() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAccion() {
    startTransition(async () => {
      const res = await miServerAction(datos)
      if (res.success) {
        toast.success('Acción completada')
        router.refresh() // Refresca datos del Server Component padre
      } else {
        toast.error(res.error ?? 'Error desconocido')
      }
    })
  }

  return (
    <button onClick={handleAccion} disabled={isPending}>
      {isPending ? 'Guardando...' : 'Guardar'}
    </button>
  )
}
```

---

## 5. Autenticación y roles

### Flujo de autenticación

1. Usuario envía credenciales en `/login`.
2. Supabase Auth valida y setea cookie de sesión.
3. El Middleware de Next.js intercepta cada request:
   - Lee la cookie de sesión con Supabase client (service role).
   - Busca el `club_member` correspondiente al `user.id`.
   - Busca los `club_member_roles` del miembro.
   - Setea headers: `x-club-id`, `x-member-id`, `x-user-roles`.
4. Si no hay sesión válida → redirect a `/login`.

### Los 8 roles

```
admin               → acceso completo a todo
direccion           → igual que admin, sin ajustes técnicos
director_deportivo  → jugadores, entrenadores, planificación temporada
coordinador         → sus equipos asignados, sesiones, observaciones
entrenador          → sus sesiones y partidos
fisio               → lesiones y seguimiento médico
infancia            → módulo de escuela de fútbol
redes               → comunicaciones y ropa
```

### Tabla de roles

```sql
-- Un miembro puede tener múltiples roles
-- team_id es opcional: permite asignar un rol a un equipo concreto
CREATE TABLE club_member_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES club_members(id),
  role TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) -- null = rol global
);
```

### RoleGuard en UI

```tsx
import { RoleGuard } from '@/components/RoleGuard'

// Solo admins y dirección ven este botón
<RoleGuard roles={['admin', 'direccion']}>
  <button>Eliminar jugador</button>
</RoleGuard>
```

### getClubContext()

```ts
// src/lib/supabase/get-club-id.ts
export async function getClubContext() {
  const headersList = await headers()
  const clubId = headersList.get('x-club-id')
  const memberId = headersList.get('x-member-id')
  const rolesHeader = headersList.get('x-user-roles') ?? ''
  const roles = rolesHeader.split(',').filter(Boolean)

  if (!clubId) throw new Error('No club context — middleware not running?')

  return { clubId, memberId, roles }
}
```

---

## 6. Base de datos — tablas principales

### Esquema simplificado

```sql
-- Entidades principales
clubs (id, name, slug, created_at)
club_settings (club_id PK, current_season, google_refresh_token,
               backend_sheet_id, new_inscriptions_sheet_id,
               sibling_discount_pct, ...)
club_members (id, club_id, user_id, first_name, last_name, role[compat])
club_member_roles (id, member_id, role, team_id?)

-- Jugadores y equipos
teams (id, club_id, name, category, season, active)
players (id, club_id, team_id, next_team_id,
         first_name, last_name, dni, birth_date, position,
         status, -- 'active' | 'trial' | 'low'
         tutor_name, tutor_email, tutor_phone,
         wants_to_continue, meets_requirements, made_reservation)

-- Actividad deportiva
sessions (id, club_id, team_id, session_type, session_date,
          end_time, location, schedule_id, notes)
session_attendance (id, session_id, player_id, present, minutes_played)
team_schedule (id, club_id, team_id, day_of_week, start_time, end_time, location)

-- Contabilidad
payments (id, club_id, player_id, concept, amount_due, amount_paid,
          status, payment_date, payment_method)
expenses (id, club_id, concept, amount, category, date)

-- Comunicaciones
email_logs (id, club_id, subject, recipients_count, sent_at, status)

-- RFFM
tracked_competitions (id, club_id, cod_temporada, cod_tipojuego,
                      cod_competicion, cod_grupo, codigo_equipo_nuestro,
                      last_calendar_sync, last_standings_sync)

-- Sanciones y lesiones
player_sanctions (id, player_id, club_id, description, date, source)
player_injuries (id, player_id, club_id, description, start_date, end_date)
```

### Convenciones de BD

- Todas las tablas tienen `club_id` para aislamiento multi-tenant.
- UUIDs como PKs (generados por `gen_random_uuid()`).
- `created_at TIMESTAMPTZ DEFAULT now()` en todas las tablas.
- Soft deletes donde aplica: campo `status` o `active` en vez de borrar filas.

---

## 7. Multi-tenancy

### Modelo de aislamiento

Ciudad Magia es una BD compartida con discriminador `club_id` en cada tabla. **No hay una BD por club.**

El flujo de aislamiento:

```
Request → Middleware → lee club del usuario → setea x-club-id
Server Action → getClubContext() → obtiene clubId de header
Query → .eq('club_id', clubId) → solo datos de ese club
```

### ⚠️ Riesgo actual

El aislamiento depende 100% de que el developer recuerde añadir `.eq('club_id', clubId)` en cada query. No hay enforcement estructural en BD (RLS desactivado — se usa service role).

**Workaround actual:** convención de código y revisión manual.

**Fix pendiente (ver backlog):** activar RLS policies + crear `getScopedClient()` que inyecte `club_id` automáticamente.

---

## 8. Integraciones Google

### OAuth2 — conectar cuenta Google del club

El club conecta su propia cuenta Google para que los exports vayan a su Drive.

**Flujo:**
1. Admin hace clic en "Conectar cuenta Google" en Integraciones.
2. `backend-sheet.actions.ts` llama a `getGoogleAuthUrl(host)`.
3. `oauth.ts` construye la URL de autorización. El `redirect_uri` se obtiene de `GOOGLE_REDIRECT_URI` env var, o se construye dinámicamente desde el header `Host` de la request.
4. El usuario acepta en Google.
5. Google redirige a `/api/google/callback?code=XXX&state=YYY`.
6. El callback intercambia el `code` por `access_token` + `refresh_token`.
7. El `refresh_token` se encripta con `APP_SECRET` y se guarda en `club_settings.google_refresh_token`.

**Archivos clave:**
- `src/lib/google/oauth.ts` — cliente OAuth2, `getOAuthClient(host?)`
- `src/features/integraciones/actions/backend-sheet.actions.ts` — `getGoogleAuthUrl()`, `createBackendSheet()`, `exportToBackendSheet()`
- `src/app/api/google/callback/route.ts` — intercambio de code por token

### Export de datos a Google Sheets

La función `exportClubToBackendSheet(clubId)` genera una hoja con 10 pestañas:

| Pestaña | Datos |
|---|---|
| Jugadores | Ficha completa de todos los jugadores activos |
| Pagos | Historial de pagos |
| Sesiones | Sesiones de entrenamiento y partidos |
| Asistencia | Asistencia por sesión |
| Staff | Miembros del club |
| Equipos | Equipos activos |
| Gastos | Gastos del club |
| Sanciones | Sanciones de jugadores |
| Lesiones | Historial de lesiones |
| Competiciones | Competiciones RFFM seguidas |

**Sync automático:** cron cada 12h en `/api/cron/sync-sheets` re-exporta para todos los clubs con `google_refresh_token` guardado.

### Service Account (Drive compartido)

Para acceso a carpetas de Drive sin OAuth de usuario, se usa una Service Account de Google:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON en Base64)

---

## 9. Gestión de temporadas

### Modelo de dos fases

La temporada sigue el patrón **solapamiento** — la nueva se planifica mientras la actual está activa:

```
Julio-Agosto:
  Temporada 25/26 (ACTIVA) → sesiones, pagos, partidos siguen
  Temporada 26/27 (PLANIF.) → equipos borrador, inscripciones

Septiembre:
  Activación → 26/27 se convierte en la activa
```

### Estado en BD

- `club_settings.current_season` = temporada activa (ej: `"2025/26"`)
- Equipos de la próxima temporada: `teams.season = nextSeason`, `teams.active = false`
- Jugadores: `players.next_team_id` apunta a un equipo de la próxima temporada

### Acciones de temporada

```ts
// src/features/configuracion/actions/season.actions.ts

// Fase 1: Crear equipos borrador para la próxima temporada
// Idempotente: si ya existen, devuelve los existentes
export async function initNextSeasonPlanning(): Promise<DraftTeam[]>

// Añadir un equipo borrador a la próxima temporada
export async function addDraftTeam(name: string): Promise<{ success: boolean }>

// Fase 2: Activar la próxima temporada (destructivo, irreversible)
// 1. team_id ← next_team_id para jugadores continuadores
// 2. wants_to_continue=false → status='low'
// 3. Reset flags de planificación
// 4. nextSeason teams → active=true; currentSeason → active=false
// 5. Borrar club_member_roles de equipos currentSeason
// 6. current_season = nextSeason
export async function activateNextSeason(): Promise<{ success: boolean }>
```

### Helper de temporada

```ts
// Calcula la próxima temporada
// "2025/26" → "2026/27"
function bumpSeason(season: string): string {
  const [start, end] = season.split('/')
  return `${parseInt(start) + 1}/${parseInt(end) + 1}`
}
```

---

## 10. Cron jobs

Configurados en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-sheets",
      "schedule": "0 0,12 * * *"
    },
    {
      "path": "/api/cron/weekly-sessions",
      "schedule": "0 22 * * 0"
    },
    {
      "path": "/api/cron/rffm-sync",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

### Autenticación de cron endpoints

```ts
// Patrón en todos los cron endpoints
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const cronHeader = req.headers.get('x-vercel-cron')
  const authHeader = req.headers.get('authorization')

  if (!cronHeader && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... lógica del cron
}
```

El header `x-vercel-cron` solo lo puede setear Vercel internamente. `Authorization: Bearer CRON_SECRET` permite ejecutar el cron manualmente (para tests o fix urgente).

---

## 11. Deploy y entornos

### Proyectos Vercel

| Proyecto | URL | Uso |
|---|---|---|
| `ciudad-magia-qj91` | https://ciudad-magia-qj91.vercel.app | **Producción** |
| `ecstatic-meninsky-678dfc` | worktree URL | Desarrollo/preview |

### Deploy a producción

```bash
# 1. Swap temporal del project.json
# Editar .vercel/project.json → projectId de ciudad-magia-qj91

# 2. Deploy
npx vercel deploy --prod

# 3. Restaurar project.json → projectId del worktree
```

### Build local

```bash
npm run build    # Verifica que compila sin errores
npm run lint     # Verifica linting
npm run dev      # Desarrollo (SIN --turbopack)
```

> ⚠️ **NUNCA usar `--turbopack`**: Next.js 15 + Turbopack silenciosamente dropea los headers custom del middleware (`x-club-id`, `x-member-id`, `x-user-roles`), causando redirect a login en todos los Server Components.

---

## 12. Variables de entorno

```bash
# Supabase — usar siempre JWT legacy (eyJ...), NO las nuevas sb_publishable_
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # JWT legacy
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # JWT legacy — NUNCA al cliente

# Cron security
CRON_SECRET=secret-largo-y-aleatorio

# Google OAuth2
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REDIRECT_URI=https://ciudad-magia-qj91.vercel.app/api/google/callback

# Google Service Account (para Drive sin OAuth de usuario)
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@proyecto.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=base64(JSON de la service account)

# App
NEXT_PUBLIC_APP_URL=https://ciudad-magia-qj91.vercel.app
APP_SECRET=secret-para-encriptar-refresh-tokens

# Email (desarrollo local)
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

---

## 13. Migraciones SQL

Las migraciones se crean en `supabase/migrations/NNN_nombre.sql` y **se aplican manualmente** en el SQL Editor de Supabase. No hay pipeline automático.

### Convención de nombrado

```
001_initial_schema.sql
002_add_players_table.sql
...
028_new_inscriptions_sheet.sql
```

### ⚠️ Migraciones pendientes de aplicar

Si al arrancar la app aparece un error sobre columnas inexistentes, revisar si hay migraciones en `supabase/migrations/` que no se han aplicado en BD.

Para verificar qué está aplicado:
```sql
SELECT * FROM schema_migrations ORDER BY version;
```

### Migración 028 (pendiente)

```sql
-- supabase/migrations/028_new_inscriptions_sheet.sql
ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS new_inscriptions_sheet_id TEXT;
```

---

## 14. Gotchas y problemas conocidos

### Supabase JWT key format

Las nuevas claves de Supabase (`sb_publishable_*` / `sb_secret_*`) NO funcionan con `supabase-js v2`. El fallo es silencioso — el auth no da error, simplemente no autentica.

**Solución:** Usar siempre las claves JWT legacy (`eyJ...`) desde "Legacy API Keys" en el dashboard de Supabase.

---

### Turbopack rompe el middleware

`next dev --turbopack` silenciosamente dropea los headers custom seteados por el middleware (`x-club-id`, `x-member-id`, `x-user-roles`). Resultado: todos los Server Components ven los headers vacíos y el usuario es redirigido a login en un loop.

**Solución:** Usar siempre `npm run dev` (sin flags).

---

### El cast `as any` en el cliente de Supabase

```ts
const sb = createAdminClient() as any
```

Este cast es necesario porque el tipo inferido de `createAdminClient()` genera tipos recursivos infinitos cuando se encadena `.from().select().eq()...`. TypeScript colapsa. El `as any` es un workaround conocido hasta que supabase-js mejore sus tipos.

---

### Dos proyectos Vercel para el mismo codebase

El worktree de desarrollo (`ecstatic-meninsky-678dfc`) y producción (`ciudad-magia-qj91`) son dos proyectos Vercel distintos apuntando al mismo código. Cada uno tiene sus propias env vars.

Para hacer deploy a producción hay que editar temporalmente `.vercel/project.json`:

```json
// Para deploy a prod:
{"projectId":"prj_SN1OhwXQXBwo3D9o7xvmAg0dyBQM","orgId":"team_EuXBl1du6bUcIeOy0DkwNmbi"}

// Restaurar tras el deploy:
{"projectId":"prj_bkEWiLBqZVmlsM6znw5ozW8ACIOR","orgId":"team_EuXBl1du6bUcIeOy0DkwNmbi"}
```

---

## 15. Backlog técnico pendiente

Ordenado por prioridad. Ver `MEMORY.md` del proyecto para descripción completa.

### 🔴 Crítico (hacer antes del primer cliente de pago)

| ID | Tarea | Tiempo |
|---|---|---|
| SEC-3 | Setear `GOOGLE_REDIRECT_URI` fijo en Vercel (ambos proyectos) | 15min |
| SEC-2 | Guard explícito si `CRON_SECRET` no está definido | 30min |
| SEC-1 | OAuth state: nonce en cookie httpOnly para prevenir CSRF | 2h |
| SEC-4 | Crear `getScopedClient()` — multi-tenant con enforcement | 3h |
| ARCH-3 | `activateNextSeason()` envuelto en función SQL transaccional | 3h |
| FEAT-2 | Inventariar y extraer todos los hardcodes a `club_settings` | 2h |
| FEAT-3 | Unsubscribe en emails masivos (LSSI + GDPR) | 3h |

### 🟡 Importante (antes de escalar a 10+ clubs)

| ID | Tarea | Tiempo |
|---|---|---|
| TEST-1 | Sentry para errores en producción | 1h |
| UX-1 | Mobile sidebar con hamburger menu | 2h |
| TEST-2 | PostHog analytics de uso | 2h |
| FEAT-4 | Audit log de acciones | 2h |
| FEAT-1 | Onboarding automatizado `/register` + plans | 8h |
| TEST-3 | Unit tests de acciones críticas (Vitest) | 4h |
| ARCH-1 | Capa de dominio — extraer lógica de negocio de actions | 6h |
| SEC-5 | Tokens Google encriptados con clave por club (HKDF) | 3h |

### 🟢 Mejoras de calidad

| ID | Tarea | Tiempo |
|---|---|---|
| UX-2 | Touch targets 44px + inputMode en campos numéricos | 2h |
| UX-3 | Sistema de componentes unificado | 4h |
| UX-4 | Empty states con acción | 1h |
| UX-5 | Accesibilidad (aria-labels, focus trap, skip link) | 3h |
| UX-6 | Performance: dynamic imports, Promise.all, next/image | 3h |
| UX-7 | Modal confirmación antes de activar temporada | 1h |
| ARCH-2 | Activar RLS en Supabase (largo plazo) | 8h |
| ARCH-4 | Cron locks para idempotencia | 2h |
| ARCH-5 | Caché con `unstable_cache` para datos semi-estáticos | 3h |
| ARCH-6 | Pipeline automático de migraciones (GitHub Actions) | 2h |
| TEST-4 | E2E smoke tests con Playwright | 3h |

---

*Para contexto de negocio y funcionalidades: ver `PRESENTACION_VENTAS.md`*
*Para uso de la aplicación: ver `MANUAL_USUARIO.md`*
