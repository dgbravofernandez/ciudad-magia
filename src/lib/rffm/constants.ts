// ──────────────────────────────────────────────────────────────
// RFFM constants
// ──────────────────────────────────────────────────────────────

export const TIPOJUEGO_LABELS: Record<string, string> = {
  '1': 'Fútbol 7',
  '2': 'Fútbol 11',
  '3': 'Fútbol 8',
  '4': 'Fútbol 5 / Sala',
  '5': 'Fútbol Playa',
}

/**
 * Tipojuegos used for the GLOBAL scorer sweep (scouting).
 * Only F7 and F11 — these have enough competition level to be meaningful.
 */
export const SCORER_SWEEP_TIPOJUEGOS = ['1', '2']

/**
 * Tipojuegos we can track for our own teams (calendar + actas + card alerts).
 * Includes F5 for our sala teams.
 */
export const TRACKABLE_TIPOJUEGOS = ['1', '2', '4']

/** Current season code */
export const CURRENT_SEASON = '21'  // 2025-2026
