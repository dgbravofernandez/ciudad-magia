'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { parseLeadsFile, type ColumnMapping } from '../lib/excel-parser'

async function requireSuperadmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const h = await headers()
  if (h.get('x-platform-role') === 'superadmin') return { ok: true }
  const { createClient } = await import('@/lib/supabase/server')
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, error: 'Sin sesión' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adm = createAdminClient() as any
  const { data } = await adm.from('platform_admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? { ok: true } : { ok: false, error: 'Sin permisos' }
}

export interface PreviewResult {
  success: true
  headers: string[]
  detectedColumns: ColumnMapping
  totalRows: number
  validRows: number
  rowsWithEmail: number
  sample: Array<{ name: string; email: string | null; location: string | null }>
  fileBase64: string  // para reenviar al confirmar (no se guarda en BD)
}

interface PreviewError { success: false; error: string }

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

/**
 * Paso 1: subir archivo, parsear y devolver preview + mapping detectado.
 * El archivo se devuelve en base64 para reenviar al confirmar (sin guardar en BD).
 */
export async function previewLeadsImport(fileBase64: string): Promise<PreviewResult | PreviewError> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }

  let buffer: Buffer
  try {
    buffer = Buffer.from(fileBase64, 'base64')
  } catch {
    return { success: false, error: 'No se pudo leer el archivo' }
  }
  if (buffer.length > MAX_BYTES) return { success: false, error: 'Archivo demasiado grande (max 5MB)' }

  try {
    const result = parseLeadsFile(buffer)
    const validRows = result.rows.length
    const rowsWithEmail = result.rows.filter(r => r.email).length
    const sample = result.rows.slice(0, 10).map(r => ({ name: r.name, email: r.email, location: r.location }))
    return {
      success: true,
      headers: result.headers,
      detectedColumns: result.detectedColumns,
      totalRows: result.totalRows,
      validRows,
      rowsWithEmail,
      sample,
      fileBase64,
    }
  } catch (err) {
    return { success: false, error: `Error parseando: ${(err as Error).message}` }
  }
}

interface ImportInput {
  fileBase64: string
  mapping: ColumnMapping
  importedFrom: string         // "FCF Cataluña", "FFCV Valencia", etc.
  defaultFederation?: string   // valor por defecto si la columna falta
  defaultLocation?: string
}

/**
 * Paso 2: confirmar import con mapping (posiblemente sobreescrito por el usuario).
 * Solo importa filas con email válido. Dedup por email.
 * Aplica heurística de prioridad y excluded automática.
 */
export async function confirmLeadsImport(input: ImportInput): Promise<{ success: boolean; error?: string; imported?: number; duplicates?: number; skipped?: number; auto_excluded?: number; auto_high_priority?: number }> {
  const auth = await requireSuperadmin()
  if (!auth.ok) return { success: false, error: auth.error }
  if (!input.importedFrom?.trim()) return { success: false, error: 'Indica el origen (ej: "FCF Cataluña")' }

  let buffer: Buffer
  try {
    buffer = Buffer.from(input.fileBase64, 'base64')
  } catch {
    return { success: false, error: 'No se pudo leer el archivo' }
  }
  if (buffer.length > MAX_BYTES) return { success: false, error: 'Archivo demasiado grande' }

  const parsed = parseLeadsFile(buffer, { override: input.mapping })
  if (parsed.rows.length === 0) return { success: false, error: 'Ningún club válido (revisa el mapping de columnas)' }

  // Filtrar solo con email válido
  const withEmail = parsed.rows.filter(r => !!r.email)
  if (withEmail.length === 0) return { success: false, error: 'Ningún club con email válido (revisa columna "Email")' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any

  // Excluded automático: nombres con SAD/S.A.D., S.L., profesionales famosos
  // Priority 10: escuelas, AD/CD genéricos (clubes amateur, target ideal)
  // Priority 100 (default): resto
  function autoExcluded(name: string): boolean {
    const n = name.toUpperCase()
    return /S\.?A\.?D\.?\b/.test(n) || /S\.?L\.?\b/.test(n) ||
      /\bREAL MADRID\b/.test(n) || /\bATLETICO\b.*\bMADRID\b/.test(n) || /\bBARCELONA\b/.test(n)
  }
  function autoPriority(name: string): number {
    const n = name.toUpperCase()
    if (/\bESCUELA\b/.test(n) || /\bA\.D\b/.test(n) || /\bC\.D\b/.test(n) || /\bE\.F\b/.test(n)) return 10
    return 100
  }

  const rows = withEmail.map(r => ({
    name: r.name,
    email: r.email!,
    location: r.location ?? input.defaultLocation ?? null,
    federation: r.federation ?? input.defaultFederation ?? input.importedFrom,
    website: r.website,
    phone: r.phone,
    priority: autoPriority(r.name),
    excluded: autoExcluded(r.name),
    imported_from: input.importedFrom,
    notes: autoExcluded(r.name) ? 'Auto-excluido: profesional/SAD' : null,
  }))

  // Upsert con onConflict en email → ignora duplicados
  let imported = 0
  const chunkSize = 100
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await sb.from('marketing_clubs')
      .upsert(chunk, { onConflict: 'email', ignoreDuplicates: true })
      .select('id')
    if (error) return { success: false, error: error.message }
    imported += (data ?? []).length
  }

  const duplicates = rows.length - imported
  const skipped = parsed.rows.length - withEmail.length
  const auto_excluded = rows.filter(r => r.excluded).length
  const auto_high_priority = rows.filter(r => r.priority === 10).length

  revalidatePath('/superadmin/campanas')
  revalidatePath('/superadmin/leads-import')
  return { success: true, imported, duplicates, skipped, auto_excluded, auto_high_priority }
}
