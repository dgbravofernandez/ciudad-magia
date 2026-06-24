-- 062: Limpia marketing_email_sends de clubs reseteados a 'pending'
-- Sin esto, el embudo sigue mostrando los ~300 enviados previos aunque los clubs
-- estén de vuelta en pending. Borramos solo los sends sin apertura ni clic.

DELETE FROM marketing_email_sends
WHERE club_id IN (
  SELECT id FROM marketing_clubs WHERE status = 'pending'
)
AND opened_at IS NULL
AND clicked_at IS NULL;

-- Verificar resultado:
-- SELECT
--   (SELECT COUNT(*) FROM marketing_email_sends) AS total_sends,
--   (SELECT COUNT(*) FROM marketing_clubs WHERE status = 'pending') AS pending_clubs,
--   (SELECT COUNT(*) FROM marketing_clubs WHERE status = 'sent_1') AS sent1_clubs,
--   (SELECT COUNT(*) FROM marketing_clubs WHERE status = 'unsubscribed') AS unsub_clubs;
