// ──────────────────────────────────────────────────────────────
// Division tier mapping — used to weight valor_score
//
// NOTE: RFFM competition names mix age category and division tier
// ("PRIMERA CADETE", "SEGUNDA JUVENIL", "PREFERENTE AFICIONADO"...).
// We can't reliably map to a global 1-10 competitive level because
// "PRIMERA CADETE" ≠ "PRIMERA AFICIONADO". So this function only
// returns the TIER WITHIN an age category. Age is filtered
// separately via birth year, so comparing valor_score between
// players of the same age is meaningful; across ages it isn't.
//
// Tiers (per age category):
//   10 — División de Honor
//    8 — Autonómica / Preferente
//    6 — Primera (1ª)
//    4 — Segunda (2ª)
//    3 — Tercera (3ª)
//    2 — Cuarta / Regional / lower
//    1 — unknown
// ──────────────────────────────────────────────────────────────

const TIER_PATTERNS: Array<{ regex: RegExp; level: number }> = [
  { regex: /DIVISI[OÓ]N\s+DE\s+HONOR|\bHONOR\b/, level: 10 },
  { regex: /AUTON[OÓ]MICA|PREFERENTE/, level: 8 },
  { regex: /\bPRIMERA\b|\b1ª\b|\b1A\b/, level: 6 },
  { regex: /\bSEGUNDA\b|\b2ª\b|\b2A\b/, level: 4 },
  { regex: /\bTERCERA\b|\b3ª\b|\b3A\b/, level: 3 },
  { regex: /\bCUARTA\b|\b4ª\b|REGIONAL/, level: 2 },
]

/**
 * Returns a 1–10 tier level for a competition name.
 * Same age category is assumed when comparing — this is a TIER,
 * not a global competitive level.
 */
export function getDivisionLevel(nombreCompeticion: string): number {
  const upper = nombreCompeticion.toUpperCase()
  for (const { regex, level } of TIER_PATTERNS) {
    if (regex.test(upper)) return level
  }
  return 1
}
