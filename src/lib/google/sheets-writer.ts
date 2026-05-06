import { google } from 'googleapis'
import type { sheets_v4, drive_v3 } from 'googleapis'
import { makeOAuthClients } from './oauth'

// ──────────────────────────────────────────────────────────────
// Google Sheets + Drive writer (service account)
//
// Requiere en .env:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  — email de la service account
//   GOOGLE_SERVICE_ACCOUNT_KEY    — JSON de la SA (raw o base64)
//
// Scopes:
//   spreadsheets — leer/escribir hojas existentes
//   drive.file   — crear hojas nuevas propias (NO acceso a todo Drive)
// ──────────────────────────────────────────────────────────────

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file', // para createSpreadsheet()
]

// Extrae credenciales del entorno (JSON raw, base64 o solo email + clave separada)
function getServiceAccountCreds(): { clientEmail: string; privateKey: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyB64 && !email) throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_KEY')

  if (keyB64) {
    try {
      const raw = keyB64.startsWith('{') ? keyB64 : Buffer.from(keyB64, 'base64').toString('utf8')
      const json = JSON.parse(raw) as { client_email: string; private_key: string }
      return {
        clientEmail: json.client_email,
        privateKey: json.private_key.replace(/\\n/g, '\n'),
      }
    } catch (e) {
      throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY no es JSON válido (raw o base64): ${(e as Error).message}`)
    }
  }

  throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_KEY con la clave privada')
}

/** Email visible de la service account (para mostrarlo en UI si hace falta) */
export function getServiceAccountEmail(): string | null {
  try {
    return getServiceAccountCreds().clientEmail
  } catch {
    return null
  }
}

function makeAuth() {
  const { clientEmail, privateKey } = getServiceAccountCreds()
  return new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: SCOPES })
}

// Cache del cliente de Sheets (no cambia entre peticiones)
let cachedSheets: sheets_v4.Sheets | null = null
function getSheetsClient(): sheets_v4.Sheets {
  if (!cachedSheets) cachedSheets = google.sheets({ version: 'v4', auth: makeAuth() })
  return cachedSheets
}

// Drive no se cachea (raro uso, evita estado stale)
function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: makeAuth() })
}

/**
 * Devuelve clientes de Sheets + Drive usando:
 * 1. OAuth refresh token del usuario (si se pasa)
 * 2. Service account (si está configurada en env)
 * Lanza error si ninguno está disponible.
 */
function getClients(refreshToken?: string | null): { sheets: sheets_v4.Sheets; drive: drive_v3.Drive } {
  if (refreshToken) return makeOAuthClients(refreshToken)
  return { sheets: getSheetsClient(), drive: getDriveClient() }
}

// ─────────────────────────────────────────────────────────────
// Operaciones de Drive
// ─────────────────────────────────────────────────────────────

/**
 * Crea una nueva hoja de cálculo.
 * - Con refreshToken: en el Drive del usuario (cuenta Google propia)
 * - Sin refreshToken: en el Drive de la service account
 */
export async function createSpreadsheet(name: string, refreshToken?: string | null): Promise<{ id: string; url: string }> {
  const { drive } = getClients(refreshToken)
  const res = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.spreadsheet' },
    fields: 'id',
  })
  const id = res.data.id
  if (!id) throw new Error('Drive no devolvió ID al crear la hoja')
  return { id, url: `https://docs.google.com/spreadsheets/d/${id}` }
}

// ─────────────────────────────────────────────────────────────
// Operaciones de Sheets
// ─────────────────────────────────────────────────────────────

/**
 * Reemplaza el contenido de una pestaña entera con `rows`.
 * - Si la pestaña no existe la crea
 * - Borra todo el contenido existente y escribe desde A1
 * - rows[0] suele ser la fila de cabeceras
 */
export async function writeTab(
  spreadsheetId: string,
  tabName: string,
  rows: (string | number | null)[][],
  refreshToken?: string | null,
): Promise<void> {
  const { sheets } = getClients(refreshToken)

  // 1. Asegurar que la pestaña existe
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const exists = (meta.data.sheets ?? []).some(s => s.properties?.title === tabName)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    })
  }

  // 2. Limpiar la pestaña entera
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A:ZZ`,
  })

  // 3. Escribir desde A1
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rows as (string | number | null)[][] },
    })
  }
}

/**
 * Verifica que tenemos acceso de escritura a la hoja.
 * Devuelve metadatos básicos. Lanza error si no hay acceso.
 */
export async function checkSheetAccess(spreadsheetId: string, refreshToken?: string | null): Promise<{
  title: string
  url: string
  tabs: string[]
}> {
  const { sheets } = getClients(refreshToken)
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  return {
    title: meta.data.properties?.title ?? '?',
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    tabs: (meta.data.sheets ?? []).map(s => s.properties?.title ?? '').filter(Boolean),
  }
}
