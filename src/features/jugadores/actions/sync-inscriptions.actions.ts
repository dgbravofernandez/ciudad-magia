'use server'

import { revalidatePath } from 'next/cache'
import { getClubId } from '@/lib/supabase/get-club-id'

// Columns in the main inscription sheet (0-indexed)
// B=1 Nombre, C=2 Email, E=4 Equipo futuro, N=13 Form link, O=14 Respuesta
const COL_NOMBRE = 1
const COL_EMAIL = 2
const COL_FORM_LINK = 13
const COL_RESPUESTA = 14

// For form response sheets: if the sheet name contains "1" → nombre is col G (6), else col B (1)
// We receive pre-parsed rows so we try both column positions
function detectNombreCol(rows: string[][]): number {
  if (rows.length === 0) return 1

  // First, check if there's a header row with column names
  const header = rows[0].map(h => norm(h))
  for (let i = 0; i < header.length; i++) {
    const h = header[i]
    if (
      h.includes('nombre') || h.includes('name') ||
      h.includes('apellido') || h === 'jugador' || h === 'alumno'
    ) return i
  }

  // Fallback: look at data rows for column that has full names (has space, reasonable length)
  for (let r = 1; r < Math.min(5, rows.length); r++) {
    for (let c = 0; c < Math.min(10, (rows[r] ?? []).length); c++) {
      const val = (rows[r][c] ?? '').trim()
      // Full name typically has at least one space and reasonable length
      if (val.length >= 5 && val.includes(' ') && !val.includes('@') && !/^\d/.test(val)) {
        return c
      }
    }
  }

  return 1
}

// ─── Coach sync ───────────────────────────────────────────────────────────────

export interface CoachSyncItem {
  coachNameRaw: string
  email: string
  phone: string
  teamNameRaw: string
  memberId: string | null   // null = needs to be created as stub
  memberName: string
  teamId: string | null     // null = team not found in DB
  teamName: string
  isNew: boolean            // true = will create a new club_member
  // From sheet columns
  photoUrl: string | null
  docDniUrl: string | null
  docAntecedentesUrl: string | null
  docDelitosUrl: string | null
  docLicenciaUrl: string | null
  docTitulacionUrl: string | null
  docContratoUrl: string | null
}

export interface CoachSyncPreview {
  toAssign: CoachSyncItem[]
  unknownTeams: string[]
  error?: string
}

interface CoachCols {
  nameCol: number
  emailCol: number
  phoneCol: number
  teamCol: number
  photoCol: number
  dniCol: number
  antecedentesCol: number
  delitosCol: number
  licenciaCol: number
  titulacionCol: number
  contratoCol: number
}

function detectCoachColumns(rows: string[][]): CoachCols {
  const cols: CoachCols = {
    nameCol: 0, emailCol: -1, phoneCol: -1, teamCol: -1,
    photoCol: -1, dniCol: -1, antecedentesCol: -1, delitosCol: -1,
    licenciaCol: -1, titulacionCol: -1, contratoCol: -1,
  }
  if (rows.length === 0) return cols

  const header = rows[0].map(h => norm(h))
  for (let i = 0; i < header.length; i++) {
    const h = header[i]
    if (h.includes('nombre') || h.includes('name') || h === 'entrenador') cols.nameCol = i
    else if (h.includes('email') || h.includes('correo')) cols.emailCol = i
    else if (h.includes('telefono') || h.includes('phone') || h.includes('movil') || (h.includes('tel') && !h.includes('titulac'))) cols.phoneCol = i
    else if (h.includes('equipo') || h.includes('categ') || h.includes('asignac') || h.includes('team')) cols.teamCol = i
    else if (h.includes('foto') || h.includes('photo') || h.includes('imagen') || h.includes('avatar') || h === 'url foto' || h === 'foto url' || h.includes('foto_url') || h.includes('imagen_url')) cols.photoCol = i
    else if (h.includes('dni') || h.includes('nie') || h.includes('pasaporte')) cols.dniCol = i
    else if (h.includes('antecedente')) cols.antecedentesCol = i
    else if (h.includes('delito') || h.includes('sexual')) cols.delitosCol = i
    else if (h.includes('licencia') || h.includes('federat')) cols.licenciaCol = i
    else if (h.includes('titulac') || h.includes('uefa') || h.includes('rfef')) cols.titulacionCol = i
    else if (h.includes('contrato') || h.includes('voluntar') || h.includes('acuerdo')) cols.contratoCol = i
  }

  // Fallbacks for common positions when no header matched
  if (cols.emailCol === -1) cols.emailCol = 2
  if (cols.teamCol === -1) cols.teamCol = 5   // Column F (index 5) = equipo
  // Column I (index 8) is the photo URL — hardcoded fallback if not detected by header
  if (cols.photoCol === -1) cols.photoCol = 8

  // Log headers to help debug column detection
  console.log('[detectCoachColumns] headers:', rows[0])
  console.log('[detectCoachColumns] cols:', cols)

  return cols
}

export async function previewCoachSync(rows: string[][]): Promise<CoachSyncPreview> {
  if (rows.length < 2) return { toAssign: [], unknownTeams: [] }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const clubId = await getClubId()
    if (!clubId) return { toAssign: [], unknownTeams: [], error: 'no_club' }

    const [{ data: teams }, { data: members }] = await Promise.all([
      supabase.from('teams').select('id, name').eq('club_id', clubId).eq('active', true),
      supabase.from('club_members').select('id, full_name, email').eq('club_id', clubId).eq('active', true),
    ])

    const cols = detectCoachColumns(rows)
    const toAssign: CoachSyncItem[] = []
    const unknownTeams: string[] = []
    const seenName = new Set<string>()

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      const coachNameRaw = (row[cols.nameCol] ?? '').trim()
      if (!coachNameRaw) continue
      if (seenName.has(norm(coachNameRaw))) continue
      seenName.add(norm(coachNameRaw))

      const email = cols.emailCol >= 0 ? (row[cols.emailCol] ?? '').trim() : ''
      const phone = cols.phoneCol >= 0 ? (row[cols.phoneCol] ?? '').trim() : ''
      const teamLabel = cols.teamCol >= 0 ? (row[cols.teamCol] ?? '').trim() : ''
      const photoUrl = cols.photoCol >= 0 ? (row[cols.photoCol] ?? '').trim() || null : null
      const docDniUrl = cols.dniCol >= 0 ? (row[cols.dniCol] ?? '').trim() || null : null
      const docAntecedentesUrl = cols.antecedentesCol >= 0 ? (row[cols.antecedentesCol] ?? '').trim() || null : null
      const docDelitosUrl = cols.delitosCol >= 0 ? (row[cols.delitosCol] ?? '').trim() || null : null
      const docLicenciaUrl = cols.licenciaCol >= 0 ? (row[cols.licenciaCol] ?? '').trim() || null : null
      const docTitulacionUrl = cols.titulacionCol >= 0 ? (row[cols.titulacionCol] ?? '').trim() || null : null
      const docContratoUrl = cols.contratoCol >= 0 ? (row[cols.contratoCol] ?? '').trim() || null : null

      // Match team (optional — coach may not have a team yet)
      let bestTeam: { id: string; name: string } | null = null
      if (teamLabel) {
        let bestScore = 0
        for (const t of (teams ?? [])) {
          const s = Math.max(wordOverlap(teamLabel, t.name), wordOverlap(t.name, teamLabel))
          if (s > bestScore) { bestScore = s; bestTeam = t }
        }
        if (!bestTeam || bestScore < 0.35) {
          if (!unknownTeams.includes(teamLabel)) unknownTeams.push(teamLabel)
          bestTeam = null
        }
      }

      // Match existing member by name or email
      let bestMember: { id: string; full_name: string; email: string } | null = null
      let bestScore = 0
      for (const m of (members ?? [])) {
        // exact email match wins
        if (email && m.email === email) { bestMember = m; bestScore = 1; break }
        const s = Math.max(wordOverlap(coachNameRaw, m.full_name), wordOverlap(m.full_name, coachNameRaw))
        if (s > bestScore) { bestScore = s; bestMember = m }
      }
      if (bestScore < 0.4) bestMember = null

      toAssign.push({
        coachNameRaw,
        email,
        phone,
        teamNameRaw: teamLabel,
        memberId: bestMember?.id ?? null,
        memberName: bestMember?.full_name ?? coachNameRaw,
        teamId: bestTeam?.id ?? null,
        teamName: bestTeam?.name ?? teamLabel,
        isNew: bestMember === null,
        photoUrl,
        docDniUrl,
        docAntecedentesUrl,
        docDelitosUrl,
        docLicenciaUrl,
        docTitulacionUrl,
        docContratoUrl,
      })
    }

    return { toAssign, unknownTeams }
  } catch (err) {
    return { toAssign: [], unknownTeams: [], error: err instanceof Error ? err.message : 'Error' }
  }
}

export async function applyCoachSync(
  toAssign: CoachSyncItem[]
): Promise<{ created: number; assigned: number; error?: string }> {
  if (!toAssign.length) return { created: 0, assigned: 0 }
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const clubId = await getClubId()
    if (!clubId) return { created: 0, assigned: 0, error: 'no_club' }

    let created = 0
    let assigned = 0

    for (const item of toAssign) {
      let memberId = item.memberId

      // Build doc/photo fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docFields: Record<string, any> = {}
      // Only save photo if it looks like a real URL (Drive link, http...)
      if (item.photoUrl && (item.photoUrl.startsWith('http') || item.photoUrl.includes('drive.google'))) {
        docFields.avatar_url = item.photoUrl
      }
      if (item.docDniUrl) docFields.doc_dni_url = item.docDniUrl
      if (item.docAntecedentesUrl) docFields.doc_antecedentes_url = item.docAntecedentesUrl
      if (item.docDelitosUrl) docFields.doc_delitos_sexuales_url = item.docDelitosUrl
      if (item.docLicenciaUrl) docFields.doc_licencia_url = item.docLicenciaUrl
      if (item.docTitulacionUrl) docFields.doc_titulacion_url = item.docTitulacionUrl
      if (item.docContratoUrl) docFields.doc_contrato_url = item.docContratoUrl

      // Create stub member if not found
      if (!memberId) {
        const { data: newMember, error: insertErr } = await supabase
          .from('club_members')
          .insert({
            club_id: clubId,
            user_id: null,
            full_name: item.coachNameRaw,
            email: item.email || `stub_${norm(item.coachNameRaw).replace(/\s/g, '.')}@pendiente.local`,
            phone: item.phone || null,
            active: true,
            form_sent: false,
            ...docFields,
          })
          .select('id')
          .single()

        if (insertErr || !newMember) continue
        memberId = newMember.id
        created++

        // Add entrenador role
        await supabase.from('club_member_roles').insert({
          member_id: memberId,
          role: 'entrenador',
          team_id: item.teamId ?? null,
        })
      } else {
        // Update existing member with any new data from sheet
        const updateFields: Record<string, unknown> = { ...docFields }
        if (item.phone) updateFields.phone = item.phone
        if (Object.keys(updateFields).length > 0) {
          await supabase.from('club_members')
            .update(updateFields)
            .eq('id', memberId)
        }
      }

      // Assign to team if we have one
      if (item.teamId) {
        await supabase.from('team_coaches').upsert(
          { team_id: item.teamId, member_id: memberId, role: 'entrenador' },
          { onConflict: 'team_id,member_id' }
        )
        await supabase.from('club_member_roles').upsert(
          { member_id: memberId, role: 'entrenador', team_id: item.teamId },
          { onConflict: 'member_id,role,team_id', ignoreDuplicates: true }
        )
        assigned++
      }
    }

    revalidatePath('/entrenadores/staff')
    revalidatePath('/entrenadores')
    revalidatePath('/jugadores/inscripciones')
    return { created, assigned }
  } catch (err) {
    return { created: 0, assigned: 0, error: err instanceof Error ? err.message : 'Error' }
  }
}

function norm(s: string): string {
  return (s ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordOverlap(a: string, b: string): number {
  const wa = norm(a).split(' ').filter(w => w.length > 1)
  const wb = new Set(norm(b).split(' ').filter(w => w.length > 1))
  if (wa.length === 0) return 0
  return wa.filter(w => wb.has(w)).length / wa.length
}

export interface InscriptionSyncPreview {
  matches: Array<{
    player_id: string
    player_name: string
    forms_link: string | null
    wants_to_continue: boolean | null
    tutor_email: string | null
    sheet_email: string | null
  }>
  unmatched: number
  error?: string
}

type PlayerRow = {
  id: string
  first_name: string
  last_name: string
  tutor_email: string | null
  forms_link: string | null
  wants_to_continue: boolean | null
}

function matchPlayer(nameRaw: string, players: PlayerRow[]): PlayerRow | null {
  let best: PlayerRow | null = null
  let bestScore = 0
  for (const p of players) {
    const fullName = `${p.first_name} ${p.last_name}`
    const reversed = `${p.last_name} ${p.first_name}`
    const score = Math.max(wordOverlap(nameRaw, fullName), wordOverlap(nameRaw, reversed))
    if (score > bestScore) { bestScore = score; best = p }
  }
  return bestScore >= 0.4 ? best : null
}

function parseRespuesta(raw: string): boolean | null {
  const r = norm(raw)
  // Positive responses
  if (r === 'si' || r === 'yes' || r === 's' || r === 'true') return true
  if (r.includes('quiero continuar') || r.includes('desea continuar') || r.includes('seguira')) return true
  if (r.startsWith('si,') || r.startsWith('si ') || r === 'si') return true
  if (r.includes('continuar') && !r.includes('no continuar') && !r.includes('no quiero')) return true
  // Negative responses
  if (r === 'no' || r === 'false') return false
  if (r.includes('no quiero') || r.includes('no desea') || r.includes('no continuara') || r.includes('darse de baja')) return false
  if (r.includes('baja')) return false
  if (r.startsWith('no,') || r.startsWith('no ')) return false
  // Fallback: if contains 'si' but not as part of a word that means 'no si' etc
  if (r.includes('si') && !r.includes('no')) return true
  if (r.includes('no') && !r.includes('si')) return false
  return null
}

export async function previewInscriptionSync(
  mainRows: string[][],
  formRows1: string[][] = [],
  formRows2: string[][] = [],
): Promise<InscriptionSyncPreview> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const clubId = await getClubId()
    if (!clubId) return { matches: [], unmatched: 0, error: 'no_club' }

    const { data: players } = await supabase
      .from('players')
      .select('id, first_name, last_name, tutor_email, forms_link, wants_to_continue')
      .eq('club_id', clubId)
      .eq('status', 'active')

    if (!players?.length) return { matches: [], unmatched: 0, error: 'no_players' }

    // Build a map: player_id → accumulated update
    type Update = { forms_link: string | null; wants_to_continue: boolean | null; sheet_email: string | null; player_name: string; tutor_email: string | null }
    const updateMap = new Map<string, Update>()
    let unmatched = 0

    // --- Main sheet: cols B(1)=nombre, C(2)=email, N(13)=link, O(14)=respuesta ---
    for (let r = 1; r < mainRows.length; r++) {
      const row = mainRows[r]
      const nameRaw = row[COL_NOMBRE] ?? ''
      const formLink = (row[COL_FORM_LINK] ?? '').trim()
      const respuestaRaw = row[COL_RESPUESTA] ?? ''
      const sheetEmail = (row[COL_EMAIL] ?? '').trim()
      if (!nameRaw.trim() || (!formLink && !respuestaRaw)) continue

      const player = matchPlayer(nameRaw, players as PlayerRow[])
      if (!player) { unmatched++; continue }

      const existing = updateMap.get(player.id)
      updateMap.set(player.id, {
        player_name: `${player.first_name} ${player.last_name}`,
        tutor_email: player.tutor_email,
        forms_link: formLink || existing?.forms_link || null,
        wants_to_continue: parseRespuesta(respuestaRaw) ?? existing?.wants_to_continue ?? null,
        sheet_email: (!player.tutor_email && sheetEmail) ? sheetEmail : (existing?.sheet_email ?? null),
      })
    }

    // --- Form response sheets: detect nombre column dynamically ---
    for (const formRows of [formRows1, formRows2]) {
      if (formRows.length < 2) continue
      const nombreCol = detectNombreCol(formRows)

      // Try to detect response column from header
      let responseCol = -1
      if (formRows[0]) {
        const header = formRows[0].map(h => norm(h))
        for (let i = 0; i < header.length; i++) {
          const h = header[i]
          if (
            h.includes('continuar') || h.includes('seguir') || h.includes('renovar') ||
            h.includes('temporada') || h.includes('deseas') || h.includes('quieres') ||
            h.includes('respuesta') || h.includes('decision')
          ) {
            responseCol = i
            break
          }
        }
      }

      for (let r = 1; r < formRows.length; r++) {
        const row = formRows[r]
        const nameRaw = (row[nombreCol] ?? '').trim()
        if (!nameRaw) continue

        let respuestaRaw = ''
        if (responseCol >= 0) {
          respuestaRaw = row[responseCol] ?? ''
        } else {
          // Fallback: scan all columns for response keywords
          for (let c = 0; c < row.length; c++) {
            if (c === nombreCol) continue
            const v = norm(row[c] ?? '')
            if (
              v.includes('continuar') || v.includes('seguir') || v.includes('baja') ||
              v === 'si' || v === 'no' || v === 'yes' || v === 'no quiero' ||
              v.startsWith('si ') || v.startsWith('no ')
            ) {
              respuestaRaw = row[c]
              break
            }
          }
        }

        if (!respuestaRaw) continue

        const player = matchPlayer(nameRaw, players as PlayerRow[])
        if (!player) continue

        const wantsToContinue = parseRespuesta(respuestaRaw)
        if (wantsToContinue === null) continue

        const existing = updateMap.get(player.id)
        updateMap.set(player.id, {
          player_name: existing?.player_name ?? `${player.first_name} ${player.last_name}`,
          tutor_email: player.tutor_email,
          forms_link: existing?.forms_link ?? null,
          wants_to_continue: wantsToContinue,
          sheet_email: existing?.sheet_email ?? null,
        })
      }
    }

    // Filter to only real changes
    const matches: InscriptionSyncPreview['matches'] = []
    for (const [player_id, u] of updateMap) {
      const p = (players as PlayerRow[]).find(x => x.id === player_id)!
      const newFormsLink = (u.forms_link && u.forms_link !== p.forms_link) ? u.forms_link : null
      const newWants = (u.wants_to_continue !== null && u.wants_to_continue !== p.wants_to_continue) ? u.wants_to_continue : null
      const newEmail = u.sheet_email || null
      if (!newFormsLink && newWants === null && !newEmail) continue
      matches.push({
        player_id,
        player_name: u.player_name,
        forms_link: newFormsLink,
        wants_to_continue: newWants,
        tutor_email: u.tutor_email,
        sheet_email: newEmail,
      })
    }

    return { matches, unmatched }
  } catch (err) {
    return { matches: [], unmatched: 0, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

export async function applyInscriptionSync(
  matches: InscriptionSyncPreview['matches']
): Promise<{ updated: number; error?: string }> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any
    const clubId = await getClubId()
    if (!clubId) return { updated: 0, error: 'no_club' }

    const BATCH = 10
    let updated = 0

    for (let i = 0; i < matches.length; i += BATCH) {
      const batch = matches.slice(i, i + BATCH)
      for (const m of batch) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {}
        if (m.forms_link) updateData.forms_link = m.forms_link
        if (m.wants_to_continue !== null) updateData.wants_to_continue = m.wants_to_continue
        if (m.sheet_email) updateData.tutor_email = m.sheet_email

        if (Object.keys(updateData).length === 0) continue

        const { error } = await supabase
          .from('players')
          .update(updateData)
          .eq('id', m.player_id)
          .eq('club_id', clubId)

        if (error) {
          console.error('applyInscriptionSync error:', error.message)
          continue
        }
        updated++

        // Send confirmation/rejection email if wants_to_continue changed via sync
        if (m.wants_to_continue !== null && (m.tutor_email || m.sheet_email)) {
          try {
            const { sendEmail } = await import('@/features/jugadores/actions/player.actions')
            const emailType = m.wants_to_continue ? 'wants_to_continue_yes' : 'wants_to_continue_no'
            await sendEmail(m.player_id, emailType)
          } catch {
            // Non-fatal: DB already updated, email failure is logged in communications
          }
        }
      }
    }

    revalidatePath('/jugadores/inscripciones')
    return { updated }
  } catch (err) {
    return { updated: 0, error: err instanceof Error ? err.message : 'Error' }
  }
}
