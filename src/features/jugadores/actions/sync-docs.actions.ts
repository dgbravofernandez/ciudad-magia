'use server'

import { revalidatePath } from 'next/cache'
import { getClubId } from '@/lib/supabase/get-club-id'

// ─── Types ───────────────────────────────────────────────────────────────────
export interface SyncMatch {
  player_id: string
  player_name: string
  match_method: 'dni' | 'name_dob'
  source: 'docs' | 'tutors' | 'both'
  updates: Record<string, string | boolean | null>
  current: Record<string, string | boolean | null>
}

export interface SyncPreview {
  matches: SyncMatch[]
  unmatched_docs: number
  unmatched_tutors: number
  error?: string
}

// ─── Local type for player rows ───────────────────────────────────────────────
type PlayerRow = {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  dni: string | null
  tutor_email: string | null
  tutor_name: string | null
  tutor_phone: string | null
  photo_url: string | null
  dni_front_url: string | null
  dni_back_url: string | null
  birth_cert_url: string | null
  residency_cert_url: string | null
  passport_url: string | null
  nie_url: string | null
  spanish_nationality: boolean | null
  position: string | null
}

// ─── Text normalisation ───────────────────────────────────────────────────────
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normDNI(s: string): string {
  return s.toUpperCase().replace(/[\s-]/g, '').trim()
}

function wordOverlap(a: string, b: string): number {
  const wa = norm(a).split(' ').filter(w => w.length > 1)
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 1))
  if (wa.length === 0) return 0
  return wa.filter(w => wb.has(w)).length / wa.length
}

function parseDMY(s: string): string | null {
  if (!s) return null
  const parts = s.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(p => p.trim())
  if (!d || !m || !y) return null
  const year = y.length === 2 ? (parseInt(y) > 30 ? 1900 + parseInt(y) : 2000 + parseInt(y)) : parseInt(y)
  return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function col(headers: string[], keyword: string): number {
  const kw = keyword.toLowerCase()
  return headers.findIndex(h => h.toLowerCase().includes(kw))
}

// ─── Main action: receives pre-fetched CSV rows from the client ───────────────
// The client fetches Google Sheets CSVs directly (browser-side) and sends the
// parsed rows here. This keeps the server action fast — no external HTTP calls.
export async function matchAndPreview(
  _clubIdUnused: string,
  docsRows: string[][],
  tutorsRows: string[][]
): Promise<SyncPreview> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    const clubId = await getClubId()
    if (!clubId) return { matches: [], unmatched_docs: 0, unmatched_tutors: 0, error: 'no_club' }

    const { data: rawPlayers } = await supabase
      .from('players')
      .select('id, first_name, last_name, birth_date, dni, tutor_email, tutor_name, tutor_phone, photo_url, dni_front_url, dni_back_url, birth_cert_url, residency_cert_url, passport_url, nie_url, spanish_nationality, position')
      .eq('club_id', clubId)

    const players = (rawPlayers ?? []) as unknown as PlayerRow[]
    if (players.length === 0) {
      return { matches: [], unmatched_docs: 0, unmatched_tutors: 0, error: 'no_players' }
    }

    const matchMap = new Map<string, SyncMatch>()

    function findPlayer(dniRaw: string, fullName: string, dobStr: string) {
      const dniNorm = normDNI(dniRaw)
      const dob = parseDMY(dobStr)
      if (dniNorm.length >= 7) {
        const found = players.find(p => p.dni && normDNI(p.dni) === dniNorm)
        if (found) return { player: found, method: 'dni' as const }
      }
      if (dob && fullName) {
        const candidates = players.filter(p => {
          if (p.birth_date && p.birth_date !== dob) return false
          return wordOverlap(fullName, `${p.first_name} ${p.last_name}`) >= 0.5
        })
        if (candidates.length === 1) return { player: candidates[0], method: 'name_dob' as const }
      }
      return null
    }

    // ── Process DOCS sheet ────────────────────────────────────────────────────
    let unmatchedDocs = 0
    if (docsRows.length > 1) {
      const headers = docsRows[0]
      const iPhoto     = col(headers, 'foto del jugador')
      const iNatES     = col(headers, 'nacionalidad española')
      const iNIE       = col(headers, 'nie del jugador')
      const iPassport  = col(headers, 'pasaporte del jugador')
      const iBirthCert = col(headers, 'nacimiento')
      const iResid     = col(headers, 'empadronamiento')
      const iDniBack   = col(headers, 'cara 2')
      const iName      = col(headers, 'nombre y apellidos')
      const iDob       = col(headers, 'fecha nacimiento')
      const iDNI       = col(headers, 'dni')
      const iEmail     = col(headers, 'correo electronico')
      const iDniFront  = col(headers, 'cara 1')

      for (let r = 1; r < docsRows.length; r++) {
        const row = docsRows[r]
        const dniRaw  = row[iDNI]  ?? ''
        const nameRaw = row[iName] ?? ''
        const dobRaw  = row[iDob]  ?? ''
        if (!dniRaw && !nameRaw) continue

        const result = findPlayer(dniRaw, nameRaw, dobRaw)
        if (!result) { unmatchedDocs++; continue }

        const { player, method } = result
        const existing = matchMap.get(player.id)
        const updates: Record<string, string | boolean | null> = existing?.updates ?? {}

        const email = row[iEmail] ?? ''
        if (email && !player.tutor_email)              updates.tutor_email         = email
        if (row[iPhoto]     && !player.photo_url)      updates.photo_url           = row[iPhoto]
        if (row[iDniFront]  && !player.dni_front_url)  updates.dni_front_url       = row[iDniFront]
        if (row[iDniBack]   && !player.dni_back_url)   updates.dni_back_url        = row[iDniBack]
        if (row[iBirthCert] && !player.birth_cert_url) updates.birth_cert_url      = row[iBirthCert]
        if (row[iResid] && !player.residency_cert_url) updates.residency_cert_url  = row[iResid]
        if (row[iPassport]  && !player.passport_url)   updates.passport_url        = row[iPassport]
        if (row[iNIE]       && !player.nie_url)        updates.nie_url             = row[iNIE]
        if (row[iNatES] && player.spanish_nationality === null) {
          updates.spanish_nationality = row[iNatES].trim().toUpperCase() === 'SI'
        }

        if (Object.keys(updates).length === 0) continue

        matchMap.set(player.id, {
          player_id: player.id,
          player_name: `${player.first_name} ${player.last_name}`,
          match_method: existing?.match_method ?? method,
          source: existing ? 'both' : 'docs',
          updates,
          current: {
            tutor_email: player.tutor_email, photo_url: player.photo_url,
            dni_front_url: player.dni_front_url, dni_back_url: player.dni_back_url,
            birth_cert_url: player.birth_cert_url, residency_cert_url: player.residency_cert_url,
            passport_url: player.passport_url, nie_url: player.nie_url,
            spanish_nationality: player.spanish_nationality,
            tutor_name: player.tutor_name, tutor_phone: player.tutor_phone,
          },
        })
      }
    }

    // ── Process TUTORS sheet ──────────────────────────────────────────────────
    let unmatchedTutors = 0
    if (tutorsRows.length > 1) {
      const headers = tutorsRows[0]
      const iNombre = col(headers, 'nombre')
      const iApells = col(headers, 'apellidos')
      const iDob    = col(headers, 'nacimiento')
      const iDNI    = col(headers, 'dni')
      const iTutorN = col(headers, 'nombre tutor')
      const iTutorE = col(headers, 'correo electronico tutor')
      const iTutorT = col(headers, 'telefono')
      const iPos    = col(headers, 'posici')

      for (let r = 1; r < tutorsRows.length; r++) {
        const row = tutorsRows[r]
        const dniRaw  = row[iDNI] ?? ''
        const nameRaw = `${row[iNombre] ?? ''} ${row[iApells] ?? ''}`.trim()
        const dobRaw  = row[iDob] ?? ''
        if (!dniRaw && !nameRaw) continue

        const result = findPlayer(dniRaw, nameRaw, dobRaw)
        if (!result) { unmatchedTutors++; continue }

        const { player, method } = result
        const existing = matchMap.get(player.id)
        const updates: Record<string, string | boolean | null> = existing?.updates ?? {}

        if (row[iTutorN] && !player.tutor_name)  updates.tutor_name  = row[iTutorN]
        if (row[iTutorE] && !player.tutor_email) updates.tutor_email = row[iTutorE]
        if (row[iTutorT] && !player.tutor_phone) updates.tutor_phone = row[iTutorT]
        if (row[iPos]    && !player.position)    updates.position    = row[iPos]

        if (Object.keys(updates).length === 0) continue

        matchMap.set(player.id, {
          player_id: player.id,
          player_name: `${player.first_name} ${player.last_name}`,
          match_method: existing?.match_method ?? method,
          source: existing ? 'both' : 'tutors',
          updates,
          current: existing?.current ?? {
            tutor_email: player.tutor_email, tutor_name: player.tutor_name,
            tutor_phone: player.tutor_phone, position: player.position,
          },
        })
      }
    }

    return {
      matches: Array.from(matchMap.values()),
      unmatched_docs: unmatchedDocs,
      unmatched_tutors: unmatchedTutors,
    }
  } catch (err) {
    console.error('matchAndPreview error:', err)
    return {
      matches: [], unmatched_docs: 0, unmatched_tutors: 0,
      error: err instanceof Error ? err.message : 'Error desconocido',
    }
  }
}

// ─── Apply the confirmed sync ─────────────────────────────────────────────────
export async function applySheetSync(
  _clubIdUnused: string,
  matches: SyncMatch[]
): Promise<{ updated: number; error?: string }> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const supabase = createAdminClient()
    const clubId = await getClubId()
    if (!clubId) return { updated: 0, error: 'no_club' }

    // Run updates in parallel batches of 25 to avoid sequential timeout
    const toUpdate = matches.filter(m => Object.keys(m.updates).length > 0)
    const BATCH = 25
    let updated = 0

    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const batch = toUpdate.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(match =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('players')
            .update(match.updates)
            .eq('id', match.player_id)
            .eq('club_id', clubId)
        )
      )
      for (const { error } of results) {
        if (error) {
          console.error('applySheetSync update error:', error.message)
        } else {
          updated++
        }
      }
    }

    revalidatePath('/jugadores')
    return { updated }
  } catch (err) {
    return { updated: 0, error: err instanceof Error ? err.message : 'Error' }
  }
}
