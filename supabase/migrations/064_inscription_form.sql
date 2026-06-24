-- 064: Formulario de inscripción nativo + auto-carga de inscripciones.
-- Aplicar a mano en el SQL Editor de Supabase. Idempotente.

-- 1. Origen del jugador: distingue cómo entró al sistema.
--    'inscription_form' (form nativo) | 'google_form' (auto-import del cron) |
--    'import' (Excel RFFM) | 'manual' | NULL (histórico).
alter table players add column if not exists source text;

-- 2. Backfill defensivo de slugs (la ruta pública /inscripcion/[slug] lo necesita).
--    Onboarding ya genera slug; esto cubre clubes históricos sin él.
update clubs
set slug = trim(both '-' from regexp_replace(
      translate(lower(name),
        'áàäâéèëêíìïîóòöôúùüûñç',
        'aaaaeeeeiiiioooouuuunc'),
      '[^a-z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 4)
where slug is null or slug = '';

-- Nota: club_settings.inscription_open ya existe (se usa para abrir/cerrar
-- inscripciones). El bucket privado 'player-docs' ya existe (migración 063).
