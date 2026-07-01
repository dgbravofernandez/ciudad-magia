import { google } from 'googleapis'
import type { sheets_v4, drive_v3 } from 'googleapis'

// ──────────────────────────────────────────────────────────────
// Google OAuth2 helper
//
// Requiere en Vercel:
//   GOOGLE_CLIENT_ID      — Client ID de la app OAuth (Google Cloud Console)
//   GOOGLE_CLIENT_SECRET  — Client Secret
//   NEXT_PUBLIC_APP_URL   — URL base de la app (para redirect URI)
//
// Redirect URI a configurar en Google Cloud Console:
//   {NEXT_PUBLIC_APP_URL}/api/google/callback
// ──────────────────────────────────────────────────────────────

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  // drive.file: crear/leer las hojas propias que Cluberly genera (backend sheet).
  'https://www.googleapis.com/auth/drive.file',
  // drive.readonly: leer ficheros preexistentes del Drive del club — imprescindible
  // para descargar los docs (fotos, DNIs) que subieron las familias vía Google Form,
  // que no fueron creados por Cluberly y por eso no entran en drive.file.
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET. ' +
      'Crea una app OAuth en Google Cloud Console y añade las variables a Vercel.',
    )
  }
  // SEC-3: Preferir GOOGLE_REDIRECT_URI fijo. Si no está, construir dinámicamente
  // (inseguro en prod: un proxy malicioso podría manipular el Host header).
  let redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!redirectUri) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[OAuth] GOOGLE_REDIRECT_URI no configurado — usando NEXT_PUBLIC_APP_URL. ' +
        'Configura GOOGLE_REDIRECT_URI en Vercel para mayor seguridad.'
      )
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    redirectUri = `${appUrl}/api/google/callback`
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** Devuelve clientes de Sheets y Drive autenticados con el refresh_token del usuario */
export function makeOAuthClients(refreshToken: string): {
  sheets: sheets_v4.Sheets
  drive: drive_v3.Drive
} {
  const auth = getOAuthClient()
  auth.setCredentials({ refresh_token: refreshToken })
  return {
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  }
}
