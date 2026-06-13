// Parser genérico de Excel/CSV de directorios federativos.
// Auto-detecta columnas relevantes en español (sin hardcodear el formato RFFM).
// Funciona con cualquier Excel que tenga las columnas con nombres parecidos.

import * as XLSX from 'xlsx'

export interface ParsedRow {
  name: string
  email: string | null
  location: string | null
  federation: string | null
  website: string | null
  phone: string | null
  notes: string | null
  raw: Record<string, unknown>
}

export interface ParseResult {
  rows: ParsedRow[]
  detectedColumns: ColumnMapping
  headers: string[]
  totalRows: number
}

export interface ColumnMapping {
  name: string | null
  email: string | null
  location: string | null
  federation: string | null
  website: string | null
  phone: string | null
}

// Heurísticas: para cada campo destino, los nombres de columna típicos que lo identifican.
// Cada entrada es un keyword que se busca como substring (case-insensitive, sin tildes).
const COLUMN_HEURISTICS: Record<keyof ColumnMapping, string[]> = {
  name:       ['club', 'entidad', 'nombre', 'denominacion', 'denominación', 'razon social', 'razón social'],
  email:      ['email', 'e-mail', 'correo', 'mail'],
  location:   ['localidad', 'poblacion', 'población', 'ciudad', 'municipio', 'ubicacion', 'ubicación', 'localizacion', 'localización', 'donde'],
  federation: ['federacion', 'federación', 'liga', 'competicion', 'competición', 'categoria', 'categoría', 'modalidad'],
  website:    ['web', 'website', 'pagina web', 'página web', 'url', 'sitio web'],
  phone:      ['telefono', 'teléfono', 'movil', 'móvil', 'tlf', 'contacto telefono', 'tel.', 'phone'],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Para cada campo, encuentra la primera cabecera que matchea uno de los keywords. */
export function detectColumns(headers: string[]): ColumnMapping {
  const normalized = headers.map(h => normalize(String(h ?? '')))
  const mapping: ColumnMapping = {
    name: null, email: null, location: null, federation: null, website: null, phone: null,
  }
  for (const field of Object.keys(COLUMN_HEURISTICS) as (keyof ColumnMapping)[]) {
    const keywords = COLUMN_HEURISTICS[field]
    for (let i = 0; i < normalized.length; i++) {
      const h = normalized[i]
      if (keywords.some(kw => h.includes(kw))) {
        mapping[field] = headers[i]
        break
      }
    }
  }
  return mapping
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function cleanString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

/**
 * Parsea un buffer de Excel/CSV y devuelve filas normalizadas + mapping detectado.
 * El mapping puede ser sobreescrito por el usuario antes de importar.
 */
export function parseLeadsFile(buffer: ArrayBuffer | Buffer, opts?: { override?: Partial<ColumnMapping> }): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = wb.SheetNames[0]
  const sheet = wb.Sheets[firstSheetName]
  // Convertir a objetos con las primeras filas como headers
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false })

  if (jsonRows.length === 0) {
    return { rows: [], detectedColumns: { name: null, email: null, location: null, federation: null, website: null, phone: null }, headers: [], totalRows: 0 }
  }

  const headers = Object.keys(jsonRows[0])
  const detected = detectColumns(headers)
  const mapping: ColumnMapping = {
    name: opts?.override?.name ?? detected.name,
    email: opts?.override?.email ?? detected.email,
    location: opts?.override?.location ?? detected.location,
    federation: opts?.override?.federation ?? detected.federation,
    website: opts?.override?.website ?? detected.website,
    phone: opts?.override?.phone ?? detected.phone,
  }

  const rows: ParsedRow[] = []
  for (const r of jsonRows) {
    const name = mapping.name ? cleanString(r[mapping.name]) : null
    if (!name) continue
    const email = mapping.email ? cleanString(r[mapping.email]) : null
    const cleanEmail = email && isValidEmail(email.toLowerCase()) ? email.toLowerCase() : null
    rows.push({
      name: name.slice(0, 200),
      email: cleanEmail?.slice(0, 200) ?? null,
      location: mapping.location ? cleanString(r[mapping.location])?.slice(0, 100) ?? null : null,
      federation: mapping.federation ? cleanString(r[mapping.federation])?.slice(0, 100) ?? null : null,
      website: mapping.website ? cleanString(r[mapping.website])?.slice(0, 300) ?? null : null,
      phone: mapping.phone ? cleanString(r[mapping.phone])?.slice(0, 50) ?? null : null,
      notes: null,
      raw: r,
    })
  }

  return { rows, detectedColumns: mapping, headers, totalRows: jsonRows.length }
}
