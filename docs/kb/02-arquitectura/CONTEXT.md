# 02 · Arquitectura

**Propósito:** stack y patrones **obligatorios**. Si tocas código, lee esto primero.
**Owner:** Diego · **Última actualización:** 2026-06-20

---

## Stack

- **Next.js 15** App Router (TypeScript, React 19, Server Actions)
- **Supabase** (Postgres + Auth + RLS + Storage)
- **Tailwind 3** + componentes propios estilo shadcn · Sonner · lucide-react · nuqs
- **Stripe** (subs + webhook idempotente) · **Resend** + Nodemailer (email) · **@react-pdf/renderer** + pdf-lib
- **Sentry** (`@sentry/nextjs`) instalado · **Google APIs** (Sheets/Gmail/Drive/Forms) · RFFM scraping
- **Tests:** vitest (unit) + Playwright (e2e). React Query, react-hook-form + zod.
- **Vercel** (deploy + 20+ crons)

## Comandos

```bash
npm run dev          # ⚠️ NUNCA --turbopack (rompe headers del middleware → redirect a login)
npm run build
npm run lint
npm run test         # vitest run
npm run test:e2e     # playwright
npm run db:types     # regenerar tipos desde Supabase
```

## Patrón OBLIGATORIO #1 — Server action

`src/features/<modulo>/actions/*.ts`:

```ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { revalidatePath } from 'next/cache'

export async function doSomething(input: X) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin','direccion'].includes(r))) {
      return { success: false, error: 'Sin permisos' }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any
    const { error } = await sb.from('tabla').insert({ club_id: clubId, /* ... */ })
    if (error) return { success: false, error: error.message }
    revalidatePath('/ruta')
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
```

- **Siempre** `createAdminClient()` + `as any` (evita tipos infinitos de supabase-js).
- **Siempre** `club_id` en insert/select (multi-tenant). ← el fallo #1 a vigilar.
- Devolver `{ success, error?, ...data }`. Nunca lanzar al cliente.
- Usa la skill `server-action` para generar esto sin desviarte del patrón.

## Patrón OBLIGATORIO #2 — Páginas autenticadas

```ts
export const dynamic = 'force-dynamic'   // en toda página bajo (app)/ que lea datos
```

`createAdminClient()` también en Server Components (cast `as any`), filtrando por `clubId` de `getClubContext()`.

## Patrón OBLIGATORIO #3 — Mutaciones en cliente

`useTransition` + server action → `toast` + `router.refresh()`. (Ver CLAUDE.md raíz.)

## Multi-tenant — cómo funciona de verdad

- **Middleware** (`middleware.ts`) usa **service-role** para leer `club_members` + `club_member_roles` y setea headers `x-club-id`, `x-member-id`, `x-user-roles`.
- `getClubContext()` ([src/lib/supabase/get-club-id.ts](../../../src/lib/supabase/get-club-id.ts)) lee esos headers; si faltan, hace fallback a sesión verificada con `getUser()` + cookie `preferred_club_id` (selector multi-club). **Nunca `.single()`** ahí (2+ membresías → error PostgREST).
- RLS parcial existe (migración `041_rls_policies`). El aislamiento aún depende en gran parte de disciplina del código → de ahí el subagente `revisor-multitenant`.

## Roles (8)

`admin`, `direccion`, `director_deportivo`, `coordinador`, `entrenador`, `fisio`, `infancia`, `redes`. Fuente de verdad: `club_member_roles(member_id, role, team_id?)`. Guard UI: `<RoleGuard roles={[...]}>`.

## NO hacer

- ❌ `next dev --turbopack`. ❌ Claves Supabase `sb_publishable_*`/`sb_secret_*` (usar JWT legacy `eyJ...`). ❌ Anon+RLS en middleware. ❌ Olvidar `club_id`. ❌ Amend o `push --force` a main sin permiso.

## Enlaces

- Modelo de datos: [data-model.md](data-model.md) · Decisiones: [decisiones/](decisiones/)
- Seguridad multi-tenant: [04](../04-seguridad/CONTEXT.md)
