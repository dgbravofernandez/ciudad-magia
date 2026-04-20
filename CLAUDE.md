# Ciudad Magia — Guía para Claude

CRM multi-tenant para clubes de fútbol. Pensado primero para E.F. Ciudad de Getafe, después vendible como SaaS. **Fase actual: utilidad para Ciudad de Getafe. Hardcoding permitido temporalmente; se sanea antes de vender.**

---

## Stack

- Next.js 15 App Router (TypeScript, React 19, Server Actions)
- Supabase (Postgres + Auth + RLS + Storage)
- Tailwind + componentes propios estilo shadcn
- Sonner (toasts), lucide-react (iconos), nuqs (URL state)
- Vercel (deploy + Cron)
- Google APIs (Sheets / Gmail / Drive / Forms)

## Comandos

```bash
npm run dev      # ⚠️ NO usar --turbopack (rompe headers de middleware)
npm run build
npm run lint
```

Migraciones Supabase: se crean en `supabase/migrations/NNN_nombre.sql` y **se aplican manualmente en el SQL Editor de Supabase**. No hay pipeline automático.

---

## Patrones OBLIGATORIOS

### 1. Server actions — plantilla

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function doSomething(input: X) {
  try {
    const { clubId, memberId, roles } = await getClubContext()
    if (!roles.some(r => ['admin','direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('tabla').insert({ club_id: clubId, ... })
    if (error) return { success: false, error: error.message }
    revalidatePath('/ruta')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- **Siempre** `createAdminClient()` (service role) y `as any` para evitar errores de tipos infinitos de supabase-js.
- **Siempre** filtrar/insertar con `club_id` (multi-tenant).
- Devolver `{ success, error?, ...data }`. Nunca lanzar a cliente.

### 2. Páginas autenticadas

```ts
export const dynamic = 'force-dynamic'
```

En toda página bajo `src/app/(app)/` que lea datos. Evita cacheo agresivo por tenant.

Usar `createAdminClient()` también en Server Components (con cast `as any`) y filtrar por `clubId` que sacamos de `getClubContext()`.

### 3. Mutaciones en cliente

```tsx
const [isPending, startTransition] = useTransition()
const router = useRouter()

startTransition(async () => {
  const res = await serverAction(...)
  if (res.success) { toast.success('Hecho'); router.refresh() }
  else toast.error(res.error ?? 'Error')
})
```

### 4. Middleware

Usa **service-role key** para leer `club_members` + `club_member_roles`. Setea headers `x-club-id`, `x-member-id`, `x-user-roles` que consume `getClubContext()`. No tocar sin entender el flujo.

---

## Estructura

```
src/
├── app/
│   ├── (auth)/login | register
│   ├── (app)/                     # layout con sidebar, requiere auth
│   │   ├── jugadores/
│   │   ├── entrenadores/
│   │   ├── contabilidad/
│   │   ├── comunicaciones/
│   │   ├── configuracion/
│   │   └── ...
│   └── api/
│       ├── cron/                  # endpoints protegidos por x-vercel-cron + CRON_SECRET
│       ├── google/
│       └── webhooks/
├── features/<modulo>/
│   ├── actions/                   # server actions
│   ├── components/                # UI del módulo
│   └── hooks/
├── lib/
│   ├── supabase/
│   │   ├── admin.ts               # createAdminClient (service role)
│   │   ├── server.ts              # createClient server (anon, usa cookies)
│   │   ├── client.ts              # createClient browser
│   │   ├── middleware.ts          # client para middleware
│   │   └── get-club-id.ts         # getClubContext()
│   ├── google/                    # sheets, gmail, drive, forms
│   ├── email/
│   ├── pdf/
│   ├── accounting/
│   └── utils/
└── components/                    # UI compartida (RoleGuard, Sidebar, etc.)

supabase/migrations/               # SQL numerado 001..NNN
```

---

## Roles (8)

`admin`, `direccion`, `director_deportivo`, `coordinador`, `entrenador`, `fisio`, `infancia`, `redes`.

Junction table `club_member_roles(member_id, role, team_id?)`. Un usuario puede tener varios roles. La tabla `club_members.role` existe por compatibilidad; **la fuente de verdad son `club_member_roles`**.

Helper: `<RoleGuard roles={['admin','direccion']}>...</RoleGuard>`.

---

## Cron jobs (Vercel)

Configurados en `vercel.json`. Auth: header `x-vercel-cron` o `Authorization: Bearer ${CRON_SECRET}`.

- `0 0,12 * * *` → `/api/cron/sync-sheets`
- `0 22 * * 0` → `/api/cron/weekly-sessions` (genera sesiones de la semana desde `team_schedule`)

---

## Estado actual

**Prod**: https://ciudad-magia-qj91.vercel.app

**Módulos implementados** (funcionan, pueden tener bugs menores):
- Jugadores (lista, ficha, inscripciones, sanciones, lesiones, observaciones, trial letters, documentos)
- Entrenadores (equipos, sesiones, asistencia con minutos, partidos live+diferidos, observaciones coord, scouting, ejercicios)
- Contabilidad (pagos, gastos, cierre caja, avisos deuda)
- Comunicaciones (bulk + individual, plantillas, tracking)
- Configuración (club, roles, cuotas, plantillas, temporada, integraciones)
- Torneos (grupos + eliminatorias)
- Ropa (pedidos + seguimiento)
- Servicios externos (contabilidad separada)
- Scouting

**Esqueleto / vacío**: `/personal/*` (fisio, infancia, redes, direccion), dashboard es básico.

**Última migración**: `016_team_schedule.sql` — tabla `team_schedule` para horarios recurrentes + `session_attendance.minutes_played` + columnas `sessions.end_time, location, schedule_id`.

---

## NO hacer

- ❌ `next dev --turbopack` — rompe headers de middleware en Next 15 (silencioso, redirige a login).
- ❌ Claves Supabase formato `sb_publishable_*` / `sb_secret_*` — usar JWT legacy `eyJ...` o `supabase-js v2` falla silencioso en auth.
- ❌ Anon client + RLS en middleware — usar service role ahí.
- ❌ Olvidar `club_id` en `insert`/`select` — rompes aislamiento multi-tenant.
- ❌ Amend commits sin pedir permiso. Crear commits nuevos.
- ❌ `git push --force` a main.
- ❌ Des-hardcodear (emails, Drive IDs, Forms links) todavía — se hace en la fase pre-SaaS.

---

## Prioridades de trabajo

1. Features útiles para Ciudad de Getafe **ya** (aunque quede hardcoded).
2. Estabilidad: que los flujos básicos no rompan (asistencia, sesiones, pagos, inscripciones).
3. Pendiente inmediato: pestaña "Rendimiento" en ficha de jugador (% asistencia + minutos reales agregados por temporada).
4. Deferred: sistema de notificaciones, backup a Sheets maestro, PWA/mobile, convocatorias, calendario mensual, des-hardcoding.

---

## Variables de entorno

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY        # JWT legacy (eyJ...)
SUPABASE_SERVICE_ROLE_KEY            # JWT legacy (eyJ...)
CRON_SECRET
GOOGLE_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_KEY           # Base64 JSON
NEXT_PUBLIC_APP_URL
APP_SECRET                           # Encripta refresh tokens
GMAIL_APP_PASSWORD                   # Para test local (dgbravofernandez@gmail.com)
```

---

## Checklist al terminar una feature

1. Migración aplicada en Supabase (si aplica) — **díselo al usuario, no se aplica sola**.
2. `npm run build` pasa.
3. `npm run lint` sin errores nuevos.
4. Actualizar sección "Estado actual" si el módulo cambió de estado.
5. Commit descriptivo. Push solo si el usuario lo pide.
