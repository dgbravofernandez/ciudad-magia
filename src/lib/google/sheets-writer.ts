import { google } from 'googleapis'
import type { sheets_v4 } from 'googleapis'

// ──────────────────────────────────────────────────────────────
// Google Sheets writer (service account)
//
// Requiere en .env:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL       — email de la service account
//   GOOGLE_SERVICE_ACCOUNT_KEY         — clave privada en Base64 del JSON
//
// La hoja destino debe estar COMPARTIDA con el email de la service
// account con permiso "Editor" para que pueda escribir.
// ──────────────────────────────────────────────────────────────

let cachedClient: sheets_v4.Sheets | null = null

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !keyB64) {
    throw new Error('Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_KEY')
  }

  // Acepta JSON crudo o JSON base64
  let serviceAccountJson: { client_email: string; private_key: string }
  try {
    const raw = keyB64.startsWith('{')
      ? keyB64
      : Buffer.from(keyB64, 'base64').toString('utf8')
    serviceAccountJson = JSON.parse(raw)
  } catch (e) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY no es JSON válido (raw o base64): ${(e as Error).message}`)
  }

  const auth = new google.auth.JWT({
    email: serviceAccountJson.client_email ?? email,
    key: serviceAccountJson.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  cachedClient = google.sheets({ version: 'v4', auth })
  return cachedClient
}

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
): Promise<void> {
  const sheets = getSheetsClient()

  // 1. Asegurar que la pestaña existe
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  const exists = (meta.data.sheets ?? []).some(s => s.properties?.title === tabName)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
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
export async function checkSheetAccess(spreadsheetId: string): Promise<{
  title: string
  url: string
  tabs: string[]
}> {
  const sheets = getSheetsClient()
  const meta = await sheets.spreadsheets.get({ spreadsheetId })
  return {
    title: meta.data.properties?.title ?? '?',
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    tabs: (meta.data.sheets ?? []).map(s => s.properties?.title ?? '').filter(Boolean),
  }
}
