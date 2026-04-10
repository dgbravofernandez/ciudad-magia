import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/callback',
  '/api/webhooks',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths without auth check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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

  // Fetch member data (club_id + roles)
  const { data: member } = await adminSupabase
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!member) {
    console.error('[middleware] No member found for user:', user.id, '— redirecting to login')
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }
  console.log('[middleware] member ok, club_id:', member.club_id, 'path:', pathname)

  const { data: roles } = await adminSupabase
    .from('club_member_roles')
    .select('role, team_id')
    .eq('member_id', member.id)

  const roleNames = (roles ?? []).map((r) => r.role)

  // Inject headers for Server Components to read
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-club-id', member.club_id)
  requestHeaders.set('x-member-id', member.id)
  requestHeaders.set('x-user-roles', JSON.stringify(roleNames))
  requestHeaders.set('x-user-email', user.email ?? '')
  requestHeaders.set('x-member-name', member.full_name ?? '')

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
