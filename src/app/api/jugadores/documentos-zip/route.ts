import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import archiver from 'archiver'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { decryptToken } from '@/lib/crypto/token-crypto'
import { getOAuthClient } from '@/lib/google/oauth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Documentos que la ficha del jugador puede tener rellenos (ver player-docs.actions.ts)
const DOC_FIELDS: Array<{ col: string; label: string }> = [
  { col: 'photo_url', label: 'Foto' },
  { col: 'dni_front_url', label: 'DNI-NIE cara 1' },
  { col: 'dni_back_url', label: 'DNI-NIE cara 2' },
  { col: 'birth_cert_url', label: 'Certificado nacimiento' },
  { col: 'residency_cert_url', label: 'Certificado empadronamiento' },
  { col: 'passport_url', label: 'Pasaporte' },
  { col: 'nie_url', label: 'NIE' },
]

function sanitizeName(name: string): string {
  return (name || 'sin-nombre').replace(/[\\/:*?"<>|]/g, '-').trim() || 'sin-nombre'
}

// Docs históricos vienen como link de Drive ("open?id=..."); los nuevos son URLs
// firmadas de Supabase Storage. Cada uno se descarga de forma distinta.
function extractDriveId(url: string): string | null {
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

function extFromContentType(ct: string | null): string {
  if (!ct) return 'bin'
  if (ct.includes('pdf')) return 'pdf'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('png')) return 'png'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('gif')) return 'gif'
  return 'bin'
}

// Limita descargas simultáneas — Drive/Storage no aguantan miles de peticiones a la vez.
async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

interface DocTask {
  teamFolder: string
  playerFolder: string
  label: string
  url: string
}

export async function GET(req: NextRequest) {
  try {
    const { clubId, roles } = await getClubContext()
    if (!roles.some(r => ['admin', 'direccion'].includes(r))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const teamIdsParam = req.nextUrl.searchParams.get('teamIds')
    const teamIds = teamIdsParam ? teamIdsParam.split(',').filter(Boolean) : null
    // 'next' = agrupar por el equipo de 26/27 (next_team_id) en vez del de la temporada actual (team_id)
    const isNextSeason = req.nextUrl.searchParams.get('season') === 'next'
    const teamCol = isNextSeason ? 'next_team_id' : 'team_id'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createAdminClient() as any

    // Token OAuth del club — necesario para descargar los docs que viven en su Drive.
    const { data: settings } = await sb.from('club_settings')
      .select('google_refresh_token').eq('club_id', clubId).maybeSingle()
    const refreshToken = decryptToken(settings?.google_refresh_token as string | null)
    let accessToken: string | null = null
    if (refreshToken) {
      const auth = getOAuthClient()
      auth.setCredentials({ refresh_token: refreshToken })
      const tokenRes = await auth.getAccessToken()
      accessToken = tokenRes.token ?? null
    }

    const { data: teams } = await sb.from('teams').select('id, name').eq('club_id', clubId)
    const teamName = new Map<string, string>((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]))

    let query = sb
      .from('players')
      .select(`id, first_name, last_name, ${teamCol}, photo_url, dni_front_url, dni_back_url, birth_cert_url, residency_cert_url, passport_url, nie_url`)
      .eq('club_id', clubId)
    // Vista 26/27: solo jugadores confirmados con equipo asignado esa temporada (igual que el listado)
    if (isNextSeason) query = query.not('next_team_id', 'is', null)
    if (teamIds && teamIds.length > 0) query = query.in(teamCol, teamIds)
    const players = await fetchAllRows(() => query)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks: DocTask[] = (players ?? []).flatMap((p: any) => {
      const tId = p[teamCol] as string | null
      const teamFolder = sanitizeName(tId ? (teamName.get(tId) ?? 'Sin equipo') : 'Sin equipo')
      const playerFolder = sanitizeName(`${p.last_name ?? ''} ${p.first_name ?? ''}`.trim() || p.id)
      return DOC_FIELDS
        .filter(f => !!p[f.col])
        .map(f => ({ teamFolder, playerFolder, label: f.label, url: p[f.col] as string }))
    })

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('warning', () => {}) // documento individual roto no debe tumbar el ZIP
    archive.on('error', (err) => console.error('[documentos-zip] archiver error:', err.message))

    // Alimenta el ZIP en background mientras el stream de salida ya está viajando al cliente.
    ;(async () => {
      try {
        await runWithConcurrency(tasks, 6, async (task) => {
          try {
            let res: Response
            if (task.url.includes('drive.google.com')) {
              const fileId = extractDriveId(task.url)
              if (!fileId || !accessToken) return
              res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` },
              })
            } else {
              res = await fetch(task.url)
            }
            if (!res.ok) {
              // 403 = scope OAuth insuficiente o fichero no compartido con el club.
              // 404 = fichero borrado en Drive. Loguear ambos para diagnóstico.
              console.warn(`[documentos-zip] ${res.status} ${task.teamFolder}/${task.playerFolder}/${task.label} — ${task.url.slice(0, 80)}`)
              return
            }
            const ext = extFromContentType(res.headers.get('content-type'))
            const buffer = Buffer.from(await res.arrayBuffer())
            archive.append(buffer, { name: `${task.teamFolder}/${task.playerFolder}/${task.label}.${ext}` })
          } catch {
            // un documento roto no debe tumbar el ZIP completo
          }
        })
      } finally {
        archive.finalize()
      }
    })()

    const webStream = Readable.toWeb(archive as unknown as Readable) as ReadableStream

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="documentacion-club.zip"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
