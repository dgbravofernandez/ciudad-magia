-- 065: lista de documentos solicitados por jugador (custom por el club).
-- requested_docs: array JSON con { key, label } — el club lo rellena al pulsar
-- "Solicitar documentos" en la ficha; /subir-documentos/[token] solo muestra esos.
-- requested_docs_at: cuándo se solicitó (para tracking / caducidad si se quiere).
--
-- Aplicar a mano en el SQL Editor de Supabase. Idempotente.

alter table players add column if not exists requested_docs jsonb;
alter table players add column if not exists requested_docs_at timestamptz;

-- Nota: NO se usa una tabla separada porque la lista es pequeña (≤10 items),
-- se accede siempre junto con el jugador, y no necesitamos histórico (el club
-- pisa la lista cuando vuelve a solicitar otros).
