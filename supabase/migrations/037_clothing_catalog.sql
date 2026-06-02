-- Catálogo de artículos de ropa con precios estándar por club
ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS clothing_catalog JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN club_settings.clothing_catalog IS
  'Array de {name: string, price: number} con precios estándar por artículo de ropa';
