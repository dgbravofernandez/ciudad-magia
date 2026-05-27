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

  // DEBUG: log what the middleware sees
  console.error('[middleware] path:', pathname, '| user:', user?.id ?? 'null', '| cookies:', request.cookies.getAll().map(c => c.name).join(','))

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
  // SUPERADMIN: verificar si el usuario es admin de plataforma
  // ─────────────────────────────────────────────
  const { data: platformAdmin } = await adminSupabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single()

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
    // Verificar que el club existe
    const { data: club } = await adminSupabase
      .from('clubs')
      .select('id')
      .eq('id', impersonateClubId)
      .single()

    if (club) {
      // Obtener o crear el registro de club_member para el superadmin en ese club
      // Si no tiene membership, simular como admin inyectando datos sintéticos
      const { data: member } = await adminSupabase
        .from('club_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('club_id', impersonateClubId)
        .eq('active', true)
        .maybeSingle()

      const memberId = member?.id ?? 'superadmin-impersonating'

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
  // FLUJO NORMAL: buscar club membership del usuario
  // ─────────────────────────────────────────────
  const { data: members } = await adminSupabase
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false })

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

  // Determinar qué club usar: cookie > único > más reciente
  let member = members[0]  // por defecto el más reciente

  if (members.length > 1) {
    const preferredClubId = request.cookies.get('preferred_club_id')?.value
    if (preferredClubId) {
      const preferred = members.find(m => m.club_id === preferredClubId)
      if (preferred) member = preferred
    }
    // Si no hay cookie o no coincide, usar el más reciente (members[0])
  }

  const { data: roles } = await adminSupabase
    .from('club_member_roles')
    .select('role, team_id')
    .eq('member_id', member.id)

  const roleNames = (roles ?? []).map((r) => r.role)

  // ─────────────────────────────────────────────
  // TRIAL ENFORCEMENT: redirigir a /upgrade si el trial ha expirado
  // ─────────────────────────────────────────────
  const isAppRoute = !pathname.startsWith('/api/') &&
    !pathname.startsWith('/upgrade') &&
    !pathname.startsWith('/cambiar-password')

  if (isAppRoute) {
    const { data: clubRow } = await adminSupabase
      .from('clubs')
      .select('subscription_status, trial_ends_at')
      .eq('id', member.club_id)
      .single()

    if (
      clubRow?.subscription_status === 'trial' &&
      clubRow?.trial_ends_at &&
      new Date(clubRow.trial_ends_at) < new Date()
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/upgrade'
      url.searchParams.set('trial_expired', '1')
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
