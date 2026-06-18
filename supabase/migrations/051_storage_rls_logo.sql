-- STORAGE-1: RLS defensiva en bucket Logo
--
-- Estado previo: bucket Logo sin políticas explícitas → confiado al flag public del bucket.
-- Las uploads se hacen siempre vía service_role (createAdminClient), así que las nuevas
-- políticas no rompen el flujo actual: service_role siempre bypasa RLS.
-- Cambio defensivo: si en el futuro alguien usa anon/authenticated client por error,
-- RLS bloquea cross-tenant write.
--
-- NOTA: la función helper va en schema 'public' porque Supabase no permite a service_role
-- crear funciones en schema 'storage' (reservado al sistema). Las policies del schema
-- storage sí se pueden crear normalmente y referencian public.extract_club_id_from_logo_path.
--
-- Path actual: 'club-logos/{clubId}-{ts}.{ext}' — UUID v4 ocupa los primeros 36 chars
-- tras el slash.

-- ─── Helper: extraer club_id del path ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extract_club_id_from_logo_path(path TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  filename TEXT;
  uuid_str TEXT;
BEGIN
  filename := split_part(path, '/', 2);
  IF length(filename) < 36 THEN
    RETURN NULL;
  END IF;
  uuid_str := substring(filename FROM 1 FOR 36);
  IF uuid_str ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN uuid_str::UUID;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.extract_club_id_from_logo_path IS
  'Helper RLS storage: extrae UUID del path club-logos/{uuid}-{ts}.{ext}. NULL si malformado.';

-- ─── Políticas para bucket 'Logo' ──────────────────────────────────────────────

-- SELECT público: los logos se renderizan en landing pages, emails outbound, sites de terceros
CREATE POLICY "Logo bucket public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'Logo');

-- INSERT: solo authenticated + member activo del club extraído del path
CREATE POLICY "Logo bucket insert by club members"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'Logo'
  AND public.extract_club_id_from_logo_path(name) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = auth.uid()
      AND club_id = public.extract_club_id_from_logo_path(name)
      AND active = TRUE
  )
);

-- UPDATE: mismo criterio
CREATE POLICY "Logo bucket update by club members"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'Logo'
  AND public.extract_club_id_from_logo_path(name) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = auth.uid()
      AND club_id = public.extract_club_id_from_logo_path(name)
      AND active = TRUE
  )
);

-- DELETE: idem
CREATE POLICY "Logo bucket delete by club members"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'Logo'
  AND public.extract_club_id_from_logo_path(name) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.club_members
    WHERE user_id = auth.uid()
      AND club_id = public.extract_club_id_from_logo_path(name)
      AND active = TRUE
  )
);
