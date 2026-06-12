import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'
import { verifyValue } from '@/lib/utils/hmac'

// Coincidencia exacta — no usar startsWith aquí para no capturar todo
const PUBLIC_EXACT = ['/', '/privacy']

// Prefijos que se permiten sin auth
const PUBLIC_PREFIX = [
  '/login',
  '/register',
  '/onboarding',        // registro de nuevos clubs
  '/select-club',       // selector de club para usuarios con varios
  '/api/auth/callback',
  '/api/webhooks',
  '/api/stripe/webhook', // Stripe llama esto sin auth de usuario
  '/api/cron',          // crons de Vercel — protegidos por CRON_SECRET en su propio handler
  '/api/user-clubs',    // endpoint para listar clubs del usuario
]

// Rutas exclusivas del panel superadmin — no necesitan club membership
const SUPERADMIN_PATHS = ['/superadmin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths without auth check
  if (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  const { supabaseResponse, user } = await updateSession(request)

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Use service-role client to bypass RLS for member lookup
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  // ─────────────────────────────────────────────
  // RONDA 1 (paralelo): platform_admins + club_members
  // Antes eran 2 queries secuenciales; ahora se lanzan a la vez.
  // ─────────────────────────────────────────────
  const [{ data: platformAdmin }, { data: members }] = await Promise.all([
    adminSupabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single(),
    adminSupabase
      .from('club_members')
      .select('id, club_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false }),
  ])

  const isSuperAdmin = !!platformAdmin

  // Si accede a rutas /superadmin → solo permitir si es superadmin
  if (SUPERADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!isSuperAdmin) {
      // No revelar que /superadmin existe — redirigir a 404
      const url = request.nextUrl.clone()
      url.pathname = '/not-found'
      return NextResponse.redirect(url)
    }

    // Superadmin accediendo a /superadmin — inyectar header y pasar
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-platform-role', 'superadmin')
    requestHeaders.set('x-user-email', user.email ?? '')
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie)
    })
    return response
  }

  // ─────────────────────────────────────────────
  // IMPERSONACIÓN: superadmin actuando como admin de un club
  // ─────────────────────────────────────────────
  const rawImpersonate = request.cookies.get('superadmin_impersonate')?.value

  // SEC: verificar firma HMAC antes de confiar en el clubId — previene XSS cookie injection
  let impersonateClubId: string | null = null
  if (isSuperAdmin && rawImpersonate) {
    const secret = process.env.APP_SECRET ?? 'dev-secret-replace-in-prod'
    const verified = await verifyValue(rawImpersonate, secret)
    if (verified) {
      // Payload firmado: "clubId:userId" — extraer clubId y verificar que userId coincide
      const [cookieClubId, cookieUserId] = verified.split(':')
      if (cookieUserId === user.id && cookieClubId) {
        impersonateClubId = cookieClubId
      } else {
        console.warn('[middleware] impersonation HMAC válido pero userId no coincide')
      }
    } else {
      console.warn('[middleware] impersonation cookie con firma inválida — posible ataque XSS')
    }
  }

  if (isSuperAdmin && impersonateClubId) {
    // Verificar que el club existe y obtener el memberId del superadmin en ese club (paralelo)
    const [{ data: club }, { data: impMember }] = await Promise.all([
      adminSupabase.from('clubs').select('id').eq('id', impersonateClubId).single(),
      adminSupabase
        .from('club_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('club_id', impersonateClubId)
        .eq('active', true)
        .maybeSingle(),
    ])

    if (club) {
      const memberId = impMember?.id ?? 'superadmin-impersonating'

      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-club-id', impersonateClubId)
      requestHeaders.set('x-member-id', memberId)
      // Superadmin impersonando tiene todos los roles
      requestHeaders.set('x-user-roles', JSON.stringify(['admin', 'direccion', 'director_deportivo']))
      requestHeaders.set('x-platform-role', 'superadmin')
      requestHeaders.set('x-user-email', user.email ?? '')
      requestHeaders.set('x-impersonating', 'true')

      const response = NextResponse.next({ request: { headers: requestHeaders } })
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value, cookie)
      })
      return response
    }
  }

  // ─────────────────────────────────────────────
  // FLUJO NORMAL: members ya obtenidos en la ronda 1
  // ─────────────────────────────────────────────
  if (!members || members.length === 0) {
    // Si es superadmin sin membership en ningún club, redirigir a su panel
    if (isSuperAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/superadmin'
      return NextResponse.redirect(url)
    }
    console.error('[middleware] No member found for user:', user.id, '— redirecting to onboarding')
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  // Determinar qué club usar: cookie > único > selección interactiva
  let member = members[0]  // por defecto el más reciente

  if (members.length > 1) {
    const preferredClubId = request.cookies.get('preferred_club_id')?.value
    if (preferredClubId) {
      const preferred = members.find(m => m.club_id === preferredClubId)
      if (preferred) {
        member = preferred
      } else if (!pathname.startsWith('/select-club')) {
        // Cookie apunta a un club al que ya no pertenece → limpiar y redirigir
        const url = request.nextUrl.clone()
        url.pathname = '/select-club'
        const resp = NextResponse.redirect(url)
        resp.cookies.delete('preferred_club_id')
        return resp
      }
    } else if (!pathname.startsWith('/select-club')) {
      // Múltiples clubs sin preferencia guardada → forzar selector
      const url = request.nextUrl.clone()
      url.pathname = '/select-club'
      return NextResponse.redirect(url)
    }
  }

  // ─────────────────────────────────────────────
  // RONDA 2 (paralelo): clubs + roles
  // Antes eran 2 queries secuenciales tras determinar el member activo.
  // ─────────────────────────────────────────────
  const clubIds = members.map((m) => m.club_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: clubsData }, { data: roles }] = await Promise.all([
    (adminSupabase as any)
      .from('clubs')
      .select('id, slug, subscription_status, trial_ends_at')
      .in('id', clubIds),
    adminSupabase
      .from('club_member_roles')
      .select('role, team_id')
      .eq('member_id', member.id),
  ])

  // ─────────────────────────────────────────────
  // COMPATIBILIDAD URLs antiguas con prefijo /{slug}/
  // El slug routing se retiró (incompatible con App Router → páginas en blanco).
  // Si el primer segmento es el slug de un club del usuario, redirigir a la ruta
  // sin slug para que marcadores/pestañas viejas sigan funcionando.
  // ─────────────────────────────────────────────
  const urlFirstSegment = pathname.split('/')[1] ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchedSlugClub = urlFirstSegment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (clubsData as any[])?.find((c: any) => c.slug && c.slug === urlFirstSegment) ?? null
    : null
  if (matchedSlugClub) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = pathname.slice(`/${urlFirstSegment}`.length) || '/dashboard'
    const redirectResp = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResp.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResp
  }

  // Club del member seleccionado (para trial check)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberClub = (clubsData as any[])?.find((c: any) => c.id === member.club_id) ?? null

  const roleNames = (roles ?? []).map((r) => r.role)

  // ─────────────────────────────────────────────
  // TRIAL ENFORCEMENT: redirigir a /upgrade si el trial ha expirado
  // ─────────────────────────────────────────────
  const isAppRoute = !pathname.startsWith('/api/') &&
    !pathname.startsWith('/upgrade') &&
    !pathname.startsWith('/cambiar-password') &&
    !pathname.startsWith('/select-club')  // no bloquear selector de club si el club activo tiene trial expirado

  if (isAppRoute && memberClub) {
    const status = memberClub.subscription_status as string | null
    const trialExpired =
      status === 'trial' &&
      memberClub.trial_ends_at &&
      new Date(memberClub.trial_ends_at) < new Date()
    // Suscripción terminada → bloquear. 'past_due' se deja en gracia (Stripe reintenta el cobro).
    // 'active'/'ltd'/'trial' válido/NULL (clubs legacy) → acceso permitido.
    const subscriptionEnded = status === 'canceled' || status === 'unpaid'

    if (trialExpired || subscriptionEnded) {
      const url = request.nextUrl.clone()
      url.pathname = '/upgrade'
      url.searchParams.set(trialExpired ? 'trial_expired' : 'subscription_ended', '1')
      return NextResponse.redirect(url)
    }
  }

  // Inject headers for Server Components to read
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-club-id', member.club_id)
  requestHeaders.set('x-member-id', member.id)
  requestHeaders.set('x-user-roles', JSON.stringify(roleNames))
  requestHeaders.set('x-user-email', user.email ?? '')
  if (isSuperAdmin) {
    requestHeaders.set('x-platform-role', 'superadmin')
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Copy cookies from supabase response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie)
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
