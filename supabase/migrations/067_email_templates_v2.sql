-- 067: email_templates v2 — extender para sistema editable por club + reply-to.
-- Aplicar a mano en el SQL Editor de Supabase. Idempotente.
--
-- Cambios:
--   1. body_text TEXT       — versión texto plano (multipart; mejora deliverability).
--   2. from_name TEXT NULL  — etiqueta del remitente (default = nombre del club).
--   3. enabled BOOLEAN      — permite desactivar sin borrar.
--   4. is_default BOOLEAN   — marca las plantillas semilla del sistema.
--   5. updated_at           — para auditar ediciones.
--   6. UNIQUE (club_id, event_type) — los flujos hacen .single() y romperían con duplicadas.
--
-- Tras aplicar:
--   - El sistema de envío usa estas plantillas si existen.
--   - Si NO existen, sigue el fallback de código (red de seguridad — cero regresión).
--   - La UI de /configuracion/plantillas-email creará/editará filas aquí.
--
-- Backfill: NO insertamos plantillas semilla en SQL — el código de la UI ofrece
-- "Crear plantilla por defecto" para cada event_type, generando el body limpio
-- (sin estilo Getafe) y guardándolo en BD. Esto permite editar el copy desde día 1
-- sin migrar copy obsoleto a la BD.

alter table email_templates add column if not exists body_text  text;
alter table email_templates add column if not exists from_name  text;
alter table email_templates add column if not exists enabled    boolean not null default true;
alter table email_templates add column if not exists is_default boolean not null default false;
alter table email_templates add column if not exists updated_at timestamptz not null default now();

-- Trigger para updated_at — patrón estándar.
create or replace function email_templates_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists email_templates_updated_at on email_templates;
create trigger email_templates_updated_at
  before update on email_templates
  for each row execute function email_templates_touch_updated_at();

-- UNIQUE (club_id, event_type): los flujos hacen .single(); si hay dos filas
-- activas para el mismo tipo en el mismo club, falla. Antes de añadir el constraint,
-- desactivamos duplicados (la más reciente queda activa).
do $$
declare
  r record;
begin
  for r in
    select club_id, event_type
    from email_templates
    where active = true
    group by club_id, event_type
    having count(*) > 1
  loop
    update email_templates
    set active = false
    where (club_id, event_type) = (r.club_id, r.event_type)
      and id not in (
        select id from email_templates
        where club_id = r.club_id and event_type = r.event_type
        order by created_at desc nulls last
        limit 1
      );
  end loop;
end $$;

-- El UNIQUE partial sólo se aplica a las activas. Permite tener una histórica
-- desactivada + una activa para el mismo tipo.
create unique index if not exists email_templates_club_event_active_uniq
  on email_templates (club_id, event_type)
  where active = true;

-- ─── club_settings: campo opcional para etiqueta del remitente ──────────────
-- Reply-to ya usa contact_email existente. Esto solo personaliza el "Nombre" del
-- remitente que ve la familia ("Cluberly · E.F. Ciudad de Getafe"). Si NULL,
-- el código compone "Cluberly · <club_name>" automáticamente.
alter table club_settings add column if not exists email_from_label text;
