-- Migration 033: add admin_comment column to quota_payments
-- Allows admins to annotate pending payments with notes like
-- "Avisado el 15/05", "caso especial", "error nuestro - revisar", etc.
-- This is separate from `notes` which is auto-generated with team/amount data.

ALTER TABLE quota_payments
  ADD COLUMN IF NOT EXISTS admin_comment TEXT;
