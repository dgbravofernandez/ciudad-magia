# Modelo de datos

**Owner:** Diego · **Última actualización:** 2026-06-20
**Fuente de verdad:** `supabase/migrations/001..052`. Tipos: `src/types/database.types.ts` (regenerar con `npm run db:types`).

> ⚠️ Las migraciones **se aplican a mano** en el SQL Editor de Supabase. No hay pipeline. Al crear `NNN_*.sql`, avisar al usuario para que la aplique.

---

## Eje multi-tenant

Todo cuelga de `clubs`. Casi toda tabla de negocio tiene `club_id` (FK). El aislamiento entre clientes depende de filtrar por `club_id` **siempre**.

- `clubs` — el tenant. Branding (018), cuotas por temporada (019), form de inscripción por club (043/044).
- `club_members` — usuarios del club (puede no tener `user_id`, 005). `active` flag.
- `club_member_roles(member_id, role, team_id?)` — **fuente de verdad de permisos** (8 roles).
- `platform_admins` (029/047) — superadmin transversal de la plataforma.

## Dominios principales (por migración)

| Dominio | Migraciones clave |
|---------|-------------------|
| Jugadores · documentos · observaciones · casos especiales | 001, 003, 007, 042, 035 |
| Equipos · next_team · temporadas | 006, 009 |
| Sesiones · planificación · asistencia/minutos · horarios · comentarios dirección | 008, 010, 016, 014, 031 |
| Convocatorias / partidos | 017 |
| Contabilidad: pagos parciales, transferencias, cierre caja, verificación, movimientos | 011, 015, 023, 030, 033, 037_cash, 038, 045 |
| Torneos / servicios externos | 012 |
| Ropa / catálogo | 011, 037_clothing_catalog |
| Actividades | 020, 039 |
| RFFM (federación): enrich, standings, signals, código club | 021–027, 034 |
| SaaS: cluberly, sheets por club, Stripe webhook idempotente | 037_cluberly_saas, 043, 044, 050 |
| Auth/seguridad: must_change_password, audit log, RLS | 036, 040, 041 |
| Marketing: campañas, plaintext variant, acquisition tracking | 046, 048, 049 |
| Storage RLS logo, email template inbox fix | 051, 052 |

## Cosas a saber antes de tocar el schema

- **RLS** activado parcialmente en `041`. Antes de añadir tabla nueva, decide su política RLS (no dejar tablas abiertas).
- **Audit log** por triggers (`040`) — cambios sensibles quedan registrados; útil para due-diligence.
- **Idempotencia Stripe** en `050` — no romper al tocar webhooks de pago.
- Hay **numeración duplicada** en algunas migraciones (varios `037_*`, `038_*`, `033_*`). Al crear la siguiente, usa un número claramente nuevo y descriptivo para no añadir más colisiones.

## Enlaces

- Patrones de acceso: [CONTEXT.md](CONTEXT.md) · Seguridad: [04](../04-seguridad/CONTEXT.md)
