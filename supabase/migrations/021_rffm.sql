-- ============================================================
-- 021_rffm.sql — Integración RFFM (scraper + scouting)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Competiciones que el club quiere seguir en RFFM
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_tracked_competitions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id               uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  cod_temporada         text NOT NULL,        -- "21" = 2025-2026
  cod_tipojuego         text NOT NULL,        -- "2" = fútbol base, etc.
  cod_competicion       text NOT NULL,
  cod_grupo             text NOT NULL,
  nombre_competicion    text NOT NULL,
  nombre_grupo          text NOT NULL,
  codigo_equipo_nuestro text NOT NULL,        -- código del equipo en RFFM
  nombre_equipo_nuestro text NOT NULL,
  umbral_amarillas      int  NOT NULL DEFAULT 5,  -- amarillas para sanción
  active                boolean NOT NULL DEFAULT true,
  last_calendar_sync    timestamptz,
  last_acta_sync        timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, cod_competicion, cod_grupo)
);

-- ─────────────────────────────────────────────────────────────
-- 2. Partidos (calendar + resultados)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_matches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                  uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  tracked_competition_id   uuid REFERENCES rffm_tracked_competitions(id) ON DELETE SET NULL,
  codacta                  text NOT NULL UNIQUE,
  jornada                  int,
  fecha                    date,
  hora                     time,
  codigo_equipo_local      text,
  equipo_local             text,
  codigo_equipo_visitante  text,
  equipo_visitante         text,
  goles_local              int,
  goles_visitante          int,
  campo                    text,
  acta_cerrada             boolean NOT NULL DEFAULT false,
  is_our_match             boolean NOT NULL DEFAULT false,
  acta_synced_at           timestamptz,           -- null = pendiente
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rffm_matches_club_id ON rffm_matches(club_id);
CREATE INDEX IF NOT EXISTS rffm_matches_pending_sync ON rffm_matches(club_id, acta_cerrada, acta_synced_at) WHERE acta_synced_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Alineaciones por partido
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_match_lineups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codacta         text NOT NULL REFERENCES rffm_matches(codacta) ON DELETE CASCADE,
  codjugador      text NOT NULL,
  nombre_jugador  text NOT NULL,
  dorsal          text,
  titular         boolean NOT NULL DEFAULT false,
  capitan         boolean NOT NULL DEFAULT false,
  portero         boolean NOT NULL DEFAULT false,
  lado            text NOT NULL CHECK (lado IN ('local','visitante')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codacta, codjugador)
);

-- ─────────────────────────────────────────────────────────────
-- 4. Eventos de partido (goles, tarjetas, sustituciones)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_match_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codacta         text NOT NULL REFERENCES rffm_matches(codacta) ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('gol','amarilla','roja','doble_amarilla','sustitucion')),
  codjugador      text NOT NULL,
  nombre_jugador  text NOT NULL,
  minuto          int,
  lado            text NOT NULL CHECK (lado IN ('local','visitante')),
  tipo_raw        text,   -- código original RFFM (100, 101, 102…)
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rffm_match_events_jugador ON rffm_match_events(codjugador);
CREATE INDEX IF NOT EXISTS rffm_match_events_acta ON rffm_match_events(codacta);

-- ─────────────────────────────────────────────────────────────
-- 5. Registro de jugadores RFFM (cross-competición)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_players (
  codjugador        text PRIMARY KEY,   -- ID de RFFM, estable
  club_id           uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  nombre_jugador    text NOT NULL,
  anio_nacimiento   int,               -- año de nacimiento (clave para scouting)
  last_fetched_at   timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 6. Stats por temporada + competición + grupo
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_player_stats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codjugador       text NOT NULL REFERENCES rffm_players(codjugador) ON DELETE CASCADE,
  club_id          uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  cod_temporada    text NOT NULL,
  cod_competicion  text NOT NULL,
  cod_grupo        text NOT NULL,
  nombre_equipo    text,
  codigo_equipo    text,
  partidos_jugados int  NOT NULL DEFAULT 0,
  goles            int  NOT NULL DEFAULT 0,
  goles_penalti    int  NOT NULL DEFAULT 0,
  amarillas        int  NOT NULL DEFAULT 0,
  rojas            int  NOT NULL DEFAULT 0,
  doble_amarillas  int  NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codjugador, cod_temporada, cod_competicion, cod_grupo)
);

-- ─────────────────────────────────────────────────────────────
-- 7. Alertas de ciclo de tarjetas (jugadores de nuestros equipos)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_card_alerts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                   uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  tracked_competition_id    uuid NOT NULL REFERENCES rffm_tracked_competitions(id) ON DELETE CASCADE,
  codjugador                text NOT NULL,
  nombre_jugador            text NOT NULL,
  amarillas_ciclo_actual    int  NOT NULL DEFAULT 0,
  ultimo_codacta            text,
  proximo_umbral            int  NOT NULL DEFAULT 5,
  alerta_activa             boolean NOT NULL DEFAULT false,  -- está a 1 de sanción
  sancionado_jornada        int,                             -- jornada en la que está sancionado
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tracked_competition_id, codjugador)
);

-- ─────────────────────────────────────────────────────────────
-- 8. Señales de scouting (barrido global goleadores RFFM)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_scouting_signals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  codjugador          text NOT NULL,
  nombre_jugador      text NOT NULL,
  nombre_equipo       text NOT NULL,
  codigo_equipo       text,
  cod_temporada       text NOT NULL,
  cod_competicion     text NOT NULL,
  cod_grupo           text NOT NULL,
  nombre_competicion  text,
  nombre_grupo        text,
  -- stats
  goles               int  NOT NULL DEFAULT 0,
  partidos_jugados    int  NOT NULL DEFAULT 0,
  goles_penalti       int  NOT NULL DEFAULT 0,
  goles_por_partido   numeric(5,2) NOT NULL DEFAULT 0,
  -- enrichment
  anio_nacimiento     int,             -- de la ficha del jugador (fetch lazy)
  division_level      int  NOT NULL DEFAULT 1,  -- 1–10, mayor = más alto
  valor_score         numeric(6,2) GENERATED ALWAYS AS (goles_por_partido * division_level) STORED,
  -- gestión
  estado              text NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','visto','descartado','captado')),
  scouting_report_id  uuid REFERENCES scouting_reports(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, codjugador, cod_temporada, cod_competicion, cod_grupo)
);

CREATE INDEX IF NOT EXISTS rffm_scouting_signals_estado ON rffm_scouting_signals(club_id, estado);
CREATE INDEX IF NOT EXISTS rffm_scouting_signals_valor ON rffm_scouting_signals(club_id, valor_score DESC);

-- ─────────────────────────────────────────────────────────────
-- 9. Log de sincronizaciones
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rffm_sync_log (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                 uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  sync_type               text NOT NULL,  -- 'calendar','acta','scorers','player_profile','full'
  status                  text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error','partial')),
  competitions_processed  int  NOT NULL DEFAULT 0,
  actas_processed         int  NOT NULL DEFAULT 0,
  players_fetched         int  NOT NULL DEFAULT 0,
  signals_created         int  NOT NULL DEFAULT 0,
  errors_count            int  NOT NULL DEFAULT 0,
  error_detail            text,
  started_at              timestamptz NOT NULL DEFAULT now(),
  finished_at             timestamptz
);
