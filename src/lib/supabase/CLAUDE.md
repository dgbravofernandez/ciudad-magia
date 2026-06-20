# Contexto: `src/lib/supabase/` — clientes y multi-tenant

Núcleo del aislamiento entre clubes. Tocar aquí con cuidado.

- `admin.ts` — `createAdminClient()` (service role, **bypassa RLS**). Úsalo con `as any`.
- `server.ts` — cliente server (anon, cookies).
- `client.ts` — cliente browser.
- `middleware.ts` — cliente para middleware (**service-role**, nunca anon+RLS aquí).
- `get-club-id.ts` — `getClubContext()` / `getClubId()`.

## Reglas

- `getClubContext()` lee headers del middleware (`x-club-id`, `x-member-id`, `x-user-roles`); si faltan, hace fallback a sesión verificada con `getUser()` + cookie `preferred_club_id`.
- **Nunca `.single()`** al resolver el club: con 2+ membresías PostgREST lanza error.
- Claves Supabase: **JWT legacy `eyJ...`**, nunca `sb_publishable_*`/`sb_secret_*` (fallan en silencio).
- El aislamiento depende de filtrar por `club_id` en el código. RLS solo parcial (mig. `041`).

→ Modelo multi-tenant: [docs/kb/02-arquitectura/CONTEXT.md](../../../docs/kb/02-arquitectura/CONTEXT.md)
→ Backlog de aislamiento (SEC-4): [docs/kb/04-seguridad/backlog-seguridad.md](../../../docs/kb/04-seguridad/backlog-seguridad.md)
