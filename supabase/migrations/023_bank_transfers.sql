-- ============================================================
-- 023 — Bank transfers (PDF upload + auto-match a jugadores)
-- ============================================================

CREATE TABLE IF NOT EXISTS bank_transfer_uploads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES club_members(id),
  filename      TEXT NOT NULL,
  total_rows    INTEGER DEFAULT 0,
  total_amount  NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_transfers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  upload_id       UUID REFERENCES bank_transfer_uploads(id) ON DELETE CASCADE,
  transfer_date   DATE NOT NULL,
  amount          NUMERIC(10,2) NOT NULL,
  concept         TEXT NOT NULL,
  payer           TEXT,
  status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','assigned','ignored')),
  matched_player_id    UUID REFERENCES players(id) ON DELETE SET NULL,
  matched_payment_id   UUID REFERENCES quota_payments(id) ON DELETE SET NULL,
  match_confidence     NUMERIC(3,2),
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transfers_club_status
  ON bank_transfers(club_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_date
  ON bank_transfers(club_id, transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_player
  ON bank_transfers(matched_player_id);

-- RLS — solo admin/direccion gestionan
ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfer_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bt_all" ON bank_transfers;
CREATE POLICY "bt_all" ON bank_transfers
  FOR ALL TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  )
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  );

DROP POLICY IF EXISTS "btu_all" ON bank_transfer_uploads;
CREATE POLICY "btu_all" ON bank_transfer_uploads
  FOR ALL TO authenticated
  USING (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  )
  WITH CHECK (
    club_id = get_my_club_id()
    AND (has_role('admin') OR has_role('direccion'))
  );
