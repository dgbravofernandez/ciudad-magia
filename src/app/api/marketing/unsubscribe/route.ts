import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

function expectedToken(clubId: string): string {
  const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
  return createHmac('sha256', secret).update(clubId).digest('hex').slice(0, 32)
}

export async function GET(req: NextRequest) {
  const clubId = req.nextUrl.searchParams.get('c')
  const token = req.nextUrl.searchParams.get('t')
  if (!clubId || !token) return new NextResponse('Falta token', { status: 400 })
  if (token !== expectedToken(clubId)) return new NextResponse('Token inválido', { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createAdminClient() as any
  await sb.from('marketing_clubs').update({ status: 'unsubscribed' }).eq('id', clubId)

  return new NextResponse(`
    <!doctype html><html><head><meta charset="utf-8"><title>Baja confirmada</title>
    <style>body{font-family:system-ui;padding:40px;max-width:500px;margin:0 auto;text-align:center}</style></head>
    <body><h1>✅ Baja confirmada</h1>
    <p>No volveremos a escribirte. Disculpa las molestias.</p>
    <p style="color:#666;font-size:13px">— El equipo de Cluberly</p></body></html>
  `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
