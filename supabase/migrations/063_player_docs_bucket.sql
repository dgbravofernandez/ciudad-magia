-- 063: Bucket privado para documentos de jugadores (subida nativa en la app).
-- Sustituye la dependencia de Google Forms/Drive: la app sube el archivo a Storage
-- y guarda una signed URL de larga duración en players.<doc>_url.
--
-- Privado (public=false): los documentos (DNI, NIE, certificados) son sensibles.
-- La app sube/lee con el service-role admin client (bypasea RLS de storage) y firma
-- las URLs server-side. No hacen falta políticas extra para el flujo actual.
--
-- Aplicar: pegar en el SQL Editor de Supabase. Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-docs',
  'player-docs',
  false,
  8388608,  -- 8 MB
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
