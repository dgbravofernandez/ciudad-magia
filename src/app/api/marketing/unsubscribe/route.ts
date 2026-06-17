import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

function expectedToken(sendId: string): string {
  const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
  return createHmac('sha256', secret).update(sendId).digest('hex').slice(0, 32)
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

// POST: one-click unsubscribe (RFC 8058) — usado por Gmail/Outlook
// El cliente envía List-Unsubscribe=One-Click en el body, nosotros procesamos los params de la URL
export async function POST(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('c')
  const sendId = req.nextUrl.searchParams.get('s')
  const token  = req.nextUrl.searchParams.get('t')
  if (!clubId || !sendId || !token) return new NextResponse('Bad request', { status: 400 })
  if (!timingSafeEq(token, expectedToken(sendId))) return new NextResponse('Forbidden', { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  const { data: send } = await sb.from('marketing_email_sends').select('club_id').eq('id', sendId).maybeSingle()
  if (!send || send.club_id !== clubId) return new NextResponse('Forbidden', { status: 403 })

  await sb.from('marketing_clubs').update({ status: 'unsubscribed' }).eq('id', clubId)
  return new NextResponse(null, { status: 200 })
}

export async function GET(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('c')
  const sendId = req.nextUrl.searchParams.get('s')
  const token = req.nextUrl.searchParams.get('t')
  if (!clubId || !sendId || !token) return new NextResponse('Falta token', { status: 400 })
  if (!timingSafeEq(token, expectedToken(sendId))) return new NextResponse('Token inválido', { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  // Verificar que el send pertenece al club (defensa adicional)
  const { data: send } = await sb.from('marketing_email_sends').select('club_id').eq('id', sendId).maybeSingle()
  if (!send || send.club_id !== clubId) return new NextResponse('Solicitud no válida', { status: 403 })

  await sb.from('marketing_clubs').update({ status: 'unsubscribed' }).eq('id', clubId)

  return new NextResponse(`
    <!doctype html><html><head><meta charset="utf-8"><title>Baja confirmada</title>
    <style>body{font-family:system-ui;padding:40px;max-width:500px;margin:0 auto;text-align:center;color:#1a1a1a}
    h1{color:#1a5c2e}</style></head>
    <body><h1>✅ Baja confirmada</h1>
    <p>No volveremos a escribirte. Disculpa las molestias.</p>
    <p style="color:#666;font-size:13px;margin-top:30px">— Diego, Cluberly</p></body></html>
  `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
