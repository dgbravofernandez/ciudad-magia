// ──────────────────────────────────────────────────────────────
// Types for RFFM (Real Federación de Fútbol de Madrid) scraper
// All shapes mirror __NEXT_DATA__.props.pageProps responses
// ──────────────────────────────────────────────────────────────

// ── Calendar ──────────────────────────────────────────────────

export interface RffmCalendarMatch {
  codacta: string
  codigo_equipo_local: string
  equipo_local: string
  escudo_equipo_local: string
  goles_casa: string        // "" if not played yet
  codigo_equipo_visitante: string
  equipo_visitante: string
  escudo_equipo_visitante: string
  goles_visitante: string   // "" if not played yet
  codigo_campo: string
  campo: string
  fecha: string             // "DD-MM-YYYY" or ""
  hora: string              // "HH:MM" or ""
}

export interface RffmCalendarRound {
  codjornada: string
  jornada: string
  equipos: RffmCalendarMatch[]
}

export interface RffmCalendar {
  estado: string
  sesion_ok: string
  competicion: string
  tipo_competicion: string
  grupo: string
  temporada: string
  rounds: RffmCalendarRound[]
}

// ── Acta (match report) ────────────────────────────────────────

export interface RffmLineupPlayer {
  codjugador: string
  foto: string
  dorsal: string
  sexo: string
  nombre_jugador: string
  titular: string           // "1" | "0"
  suplente: string
  capitan: string
  portero: string
  posicion: string
  ver_estadisiticas_jugador: string
}

export interface RffmGoalEvent {
  codjugador: string
  nombre_jugador: string
  minuto: string
  tipo_gol: string          // "100" = normal, "101" = penalty, "102" = own goal
}

export interface RffmCardEvent {
  codjugador: string
  nombre_jugador: string
  minuto: string
  tipo_tarjeta: string      // "100" = yellow, "101" = red, "102" = double yellow
}

export interface RffmSubstitution {
  codjugador_sale: string
  nombre_jugador_sale: string
  codjugador_entra: string
  nombre_jugador_entra: string
  minuto: string
}

export interface RffmGame {
  estado: string
  sesion_ok: string
  codacta: string
  nombre_competicion: string
  nombre_grupo: string
  jornada: string
  fecha: string             // "DD-MM-YYYY"
  hora: string
  campo: string
  codigo_campo: string
  acta_cerrada: string      // "1" | "0"
  partido_en_juego: string
  codigo_equipo_local: string
  equipo_local: string
  escudo_local: string
  goles_local: string
  codigo_equipo_visitante: string
  equipo_visitante: string
  escudo_visitante: string
  goles_visitante: string
  jugadores_equipo_local: RffmLineupPlayer[]
  jugadores_equipo_visitante: RffmLineupPlayer[]
  goles_equipo_local: RffmGoalEvent[]
  goles_equipo_visitante: RffmGoalEvent[]
  tarjetas_equipo_local: RffmCardEvent[]
  tarjetas_equipo_visitante: RffmCardEvent[]
  sustituciones_equipo_local: RffmSubstitution[]
  sustituciones_equipo_visitante: RffmSubstitution[]
  arbitros_partido: RffmReferee[]
}

export interface RffmReferee {
  nombre: string
  rol: string
}

// ── Player profile ─────────────────────────────────────────────

export interface RffmPlayerTarjeta {
  codigo_tipo_tarjeta: string  // "100"=amarilla, "101"=roja, "102"=doble amarilla
  nombre: string
  valor: string
}

export interface RffmPlayerPartido {
  nombre: string   // "Convocados" | "Titular" | "Suplente" | "Jugados" | "Total Goles" | "Media Goles por partido"
  valor: string
}

export interface RffmPlayerCompeticion {
  nombre_competicion: string
  codigo_competicion: string
  ver_estadisticas: string
  vis_goles: string
  vis_minutos: string
  codgrupo: string
  codequipo: string
  nombre_equipo: string
  nombre_club: string
  posicion_equipo: string
  puntos_equipo: string
  escudo_equipo: string
}

export interface RffmPlayerSeason {
  nombre_temporada: string   // "2025-2026"
  codigo_temporada: string   // "21"
}

export interface RffmPlayer {
  estado: string
  sesion_ok: string
  codigo_jugador: string
  nombre_jugador: string
  edad: string
  anio_nacimiento: string    // e.g. "2016" — key for age filtering
  equipo: string
  codigo_equipo: string
  categoria_equipo: string
  dorsal_jugador: string
  posicion_jugador: string
  codigo_temporada: string
  nombre_temporada: string
  minutos_totales_jugados: string
  es_portero: string
  tarjetas: RffmPlayerTarjeta[]
  partidos: RffmPlayerPartido[]
  listado_temporadas: RffmPlayerSeason[]
  competiciones_participa: RffmPlayerCompeticion[]
}

// ── Scorers (goleadores) ───────────────────────────────────────

export interface RffmScorerEntry {
  codigo_jugador: string
  foto: string
  jugador: string            // "APELLIDO, Nombre"
  escudo_equipo: string
  nombre_equipo: string
  codigo_equipo: string
  partidos_jugados: string
  goles: string
  goles_penalti: string
  goles_por_partidos: string // "1.20"
}

export interface RffmScorers {
  estado: string
  sesion_ok: string
  competicion: string
  grupo: string
  goles: RffmScorerEntry[]
}

// ── Competition / Group metadata ───────────────────────────────

export interface RffmCompeticion {
  codigo: string
  nombre: string
  cod_tipojuego: string
  total_grupos: string
}

export interface RffmGrupo {
  codigo: string
  nombre: string
  total_jornadas: string
  total_equipos: string
  clasificacion_goleadores: string  // "1" = has scorers
}

export interface RffmJornada {
  codjornada: string
  nombre: string
  nombre_antiguo: string
  fecha_jornada: string
}

export interface RffmRoundsData {
  estado: string
  sesion_ok: string
  jornadas: RffmJornada[]
}

// ── Sync result helpers ────────────────────────────────────────

export interface SyncResult {
  success: boolean
  competitionsProcessed: number
  actasProcessed: number
  playersFetched: number
  signalsCreated: number
  errorsCount: number
  errorDetail?: string
}
