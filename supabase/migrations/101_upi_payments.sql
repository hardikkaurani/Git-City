-- ============================================================
-- Migration 101: UPI payments (India)
-- ============================================================

ALTER TABLE pixel_purchases DROP CONSTRAINT IF EXISTS pixel_purchases_provider_check;
ALTER TABLE pixel_purchases
  ADD CONSTRAINT pixel_purchases_provider_check
  CHECK (provider IN ('stripe', 'abacatepay', 'gitc', 'upi')) NOT VALID;
ALTER TABLE pixel_purchases VALIDATE CONSTRAINT pixel_purchases_provider_check;

ALTER TABLE pixel_purchases DROP CONSTRAINT IF EXISTS pixel_purchases_currency_check;
ALTER TABLE pixel_purchases
  ADD CONSTRAINT pixel_purchases_currency_check
  CHECK (currency IN ('usd', 'brl', 'gitc', 'inr')) NOT VALID;
ALTER TABLE pixel_purchases VALIDATE CONSTRAINT pixel_purchases_currency_check;
