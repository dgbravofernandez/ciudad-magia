-- 060: Reset leads enviados sin engagement — vuelven a 'pending' para recibir plantilla v4
-- Mantiene: abiertos, clicados, dados de baja, rebotados, con respuesta
-- Resetea: status='sent_1' sin ninguna apertura ni clic en marketing_email_sends
--
-- PASO 1 — Ver cuántos se van a resetear (ejecutar primero para confirmar):
-- SELECT COUNT(*) FROM marketing_clubs
-- WHERE status = 'sent_1'
--   AND id NOT IN (
--     SELECT DISTINCT club_id FROM marketing_email_sends
--     WHERE opened_at IS NOT NULL OR clicked_at IS NOT NULL
--   );
--
-- PASO 2 — Ejecutar el reset:

UPDATE marketing_clubs
SET
  status       = 'pending',
  last_sent_at = NULL,
  queued_at    = NULL
WHERE status = 'sent_1'
  AND id NOT IN (
    SELECT DISTINCT club_id
    FROM marketing_email_sends
    WHERE opened_at IS NOT NULL OR clicked_at IS NOT NULL
  );

-- Los registros de marketing_email_sends se CONSERVAN para auditoría y estadísticas.
-- El historial de envíos previos no cuenta en el daily cap (que solo mira sends de hoy).

-- PASO 3 — Verificar resultado:
-- SELECT status, COUNT(*) FROM marketing_clubs GROUP BY status ORDER BY status;
