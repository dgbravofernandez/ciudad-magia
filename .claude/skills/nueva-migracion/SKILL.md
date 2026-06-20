---
name: nueva-migracion
description: Crea la siguiente migración SQL numerada en supabase/migrations/, recuerda que debe aplicarse a mano en el SQL Editor de Supabase, exige política RLS para tablas nuevas y ofrece regenerar tipos. Úsala para cualquier cambio de schema.
---

# nueva-migracion

Andamia una migración respetando las convenciones del proyecto.

## Pasos
1. **Mira el último número** en `supabase/migrations/` (la real es alta, ~052) y elige un número **claramente nuevo y descriptivo**. Hay colisiones históricas (`037_*`, `038_*`, `033_*`) — no añadas más.
2. **Crea** `supabase/migrations/NNN_<descripcion>.sql`.
3. **Toda tabla nueva debe**:
   - Tener `club_id uuid` (FK a `clubs`) salvo justificación explícita.
   - Definir su **política RLS** (no dejarla abierta; coherente con mig. `041_rls_policies`).
   - Índices en columnas de filtro frecuente (`club_id`, FKs).
4. **Avisa al usuario en negrita** de que la migración **se aplica a mano en el SQL Editor de Supabase** — no hay pipeline, no se aplica sola.
5. **Ofrece** regenerar tipos: `npm run db:types`.

## Plantilla
```sql
-- NNN_<descripcion>.sql
-- Propósito: <una línea>

create table if not exists <tabla> (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  -- ...
  created_at timestamptz not null default now()
);

create index if not exists idx_<tabla>_club on <tabla>(club_id);

alter table <tabla> enable row level security;
-- create policy "<tabla>_club_isolation" on <tabla> ... ;
```

## Recordatorio final (obligatorio)
> ⚠️ **Aplica esta migración manualmente en el SQL Editor de Supabase.** Luego `npm run db:types`. Actualiza `docs/kb/02-arquitectura/data-model.md`.
