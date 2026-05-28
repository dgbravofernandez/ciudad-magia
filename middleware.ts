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

// Rutas que NO se redirigen al prefijo de slug aunque no lo tengan
// (para evitar bucles o comportamientos inesperados)
const SLUG_EXEMPT_PREFIXES = [
  '/api/',
  '/upgrade',
  '/cambiar-password',
  '/select-club',
  '/superadmin',
]

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

  // ─────────────────────────────────────────────
  // SLUG-BASED ROUTING: URL con prefijo /{slug}/
  // Cada club tiene su propio espacio de URLs para aislar tenants visualmente
  // ─────────────────────────────────────────────

  // Obtener slugs de todos los clubs del usuario (+ datos para trial check)
  const clubIds = members.map((m) => m.club_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clubsData } = await (adminSupabase as any)
    .from('clubs')
    .select('id, slug, subscription_status, trial_ends_at')
    .in('id', clubIds)

  // Detectar si el pathname empieza con un slug de los clubs del usuario
  const urlFirstSegment = pathname.split('/')[1] ?? ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const urlSlugClub = urlFirstSegment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (clubsData as any[])?.find((c: any) => c.slug && c.slug === urlFirstSegment) ?? null
    : null
  const urlSlugMember = urlSlugClub
    ? members.find((m) => m.club_id === urlSlugClub.id) ?? null
    : null

  let isSlugBased = false
  let effectivePath = pathname

  if (urlSlugMember && urlSlugClub) {
    // URL tiene prefijo de slug válido: /{slug}/jugadores → /jugadores
    member = urlSlugMember
    isSlugBased = true
    effectivePath = pathname.slice(`/${urlFirstSegment}`.length) || '/dashboard'
  }

  // Club del member seleccionado (para trial check y slug redirect)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberClub = (clubsData as any[])?.find((c: any) => c.id === member.club_id) ?? null
  const selectedClubSlug: string | null = memberClub?.slug ?? null

  // Si el pathname no tiene slug y no está en la lista de exentos → redirigir para añadir slug
  if (
    !isSlugBased &&
    selectedClubSlug &&
    !SLUG_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${selectedClubSlug}${pathname}`
    const redirectResp = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResp.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResp
  }

  // Obtener roles del member seleccionado (después de posible cambio por slug)
  const { data: roles } = await adminSupabase
    .from('club_member_roles')
    .select('role, team_id')
    .eq('member_id', member.id)

  const roleNames = (roles ?? []).map((r) => r.role)

  // ─────────────────────────────────────────────
  // TRIAL ENFORCEMENT: redirigir a /upgrade si el trial ha expirado
  // Usa effectivePath (sin slug) para detectar rutas de app correctamente
  // ─────────────────────────────────────────────
  const isAppRoute = !effectivePath.startsWith('/api/') &&
    !effectivePath.startsWith('/upgrade') &&
    !effectivePath.startsWith('/cambiar-password')

  if (isAppRoute && memberClub) {
    if (
      memberClub.subscription_status === 'trial' &&
      memberClub.trial_ends_at &&
      new Date(memberClub.trial_ends_at) < new Date()
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

  // Si la URL tenía slug, reescribir internamente a la ruta sin slug
  // El browser sigue viendo /{slug}/dashboard pero Next.js renderiza /dashboard
  if (isSlugBased) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = effectivePath
    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie)
    })
    return response
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
