-- Columna para guardar la URL/ID del Google Sheet de nuevas inscripciones
-- (jugadores que NO están en el club y quieren unirse, formulario externo)
ALTER TABLE club_settings
  ADD COLUMN IF NOT EXISTS new_inscriptions_sheet_id TEXT;
