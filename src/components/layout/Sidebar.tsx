'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Dumbbell,
  Building2,
  Mail,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Trophy,
  Shirt,
  Eye,
  Menu,
  X,
  Loader2,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils/cn'
import { useCurrentUser } from '@/context/UserContext'
import { useClub } from '@/context/ClubContext'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  children?: { label: string; href: string; requiredRole?: string[] }[]
  requiredRole?: string[]
}

// Roles activos en esta versión:
// admin            → acceso total
// director_deportivo (supercoordinador) → jugadores (sin importar/sync) + entrenadores (solo cuerpo técnico)
// coordinador      → jugadores (sin importar/sync)
const ADMIN_ONLY = ['admin', 'direccion']
const CONTABILIDAD_ROLES = ['admin', 'direccion', 'director_deportivo']
const JUGADORES_ROLES = ['admin', 'direccion', 'director_deportivo', 'coordinador']
const ENTRENADORES_ROLES = ['admin', 'direccion', 'director_deportivo']

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    requiredRole: ADMIN_ONLY,
  },
  {
    label: 'Jugadores',
    href: '/jugadores',
    icon: Users,
    requiredRole: JUGADORES_ROLES,
    children: [
      { label: 'Listado', href: '/jugadores' },
      { label: 'Inscripciones', href: '/jugadores/inscripciones' },
      { label: 'Sanciones', href: '/jugadores/sanciones' },
      { label: 'Importar Excel', href: '/jugadores/importar', requiredRole: ADMIN_ONLY },
      { label: 'Sincronizar docs', href: '/jugadores/importar/documentos', requiredRole: ADMIN_ONLY },
    ],
  },
  {
    label: 'Entrenadores',
    href: '/entrenadores',
    icon: Dumbbell,
    requiredRole: ENTRENADORES_ROLES,
    children: [
      { label: 'Equipos', href: '/entrenadores', requiredRole: ADMIN_ONLY },
      { label: 'Cuerpo técnico', href: '/entrenadores/staff' },
      { label: 'Calendario', href: '/entrenadores/calendario', requiredRole: ENTRENADORES_ROLES },
      { label: 'Sesiones', href: '/entrenadores/sesiones', requiredRole: ADMIN_ONLY },
      { label: 'Partidos', href: '/entrenadores/partidos', requiredRole: ADMIN_ONLY },
      { label: 'Ejercicios', href: '/entrenadores/ejercicios', requiredRole: ENTRENADORES_ROLES },
      { label: 'Observaciones', href: '/entrenadores/observaciones', requiredRole: ENTRENADORES_ROLES },
    ],
  },
  {
    label: 'Contabilidad',
    href: '/contabilidad',
    icon: DollarSign,
    requiredRole: CONTABILIDAD_ROLES,
    children: [
      { label: 'Pagos', href: '/contabilidad/pagos' },
      { label: 'Transferencias', href: '/contabilidad/transferencias' },
      { label: 'Gastos', href: '/contabilidad/gastos' },
      { label: 'Actividades', href: '/contabilidad/actividades' },
      { label: 'Cierre de caja', href: '/contabilidad/caja' },
      { label: 'Informes', href: '/contabilidad/informes' },
    ],
  },
  {
    label: 'Personal del Club',
    href: '/personal',
    icon: Building2,
    requiredRole: ADMIN_ONLY,
    children: [
      { label: 'Dirección', href: '/personal/direccion' },
      { label: 'Fisioterapia', href: '/personal/fisio' },
      { label: 'Dpto. Infancia', href: '/personal/infancia' },
      { label: 'Redes Sociales', href: '/personal/redes' },
    ],
  },
  {
    label: 'Comunicaciones',
    href: '/comunicaciones',
    icon: Mail,
    requiredRole: ADMIN_ONLY,
    children: [
      { label: 'Enviar email', href: '/comunicaciones/enviar' },
      { label: 'Plantillas', href: '/comunicaciones/plantillas' },
      { label: 'Historial', href: '/comunicaciones/historial' },
    ],
  },
  {
    label: 'Torneos',
    href: '/torneos',
    icon: Trophy,
    requiredRole: ADMIN_ONLY,
  },
  {
    label: 'Scouting',
    href: '/scouting',
    icon: Eye,
    requiredRole: ENTRENADORES_ROLES,
    children: [
      { label: 'Jugadores rivales', href: '/scouting' },
      { label: 'RFFM', href: '/scouting/rffm' },
    ],
  },
  {
    label: 'Ropa',
    href: '/ropa',
    icon: Shirt,
    requiredRole: ADMIN_ONLY,
  },
  {
    label: 'Informes',
    href: '/informes',
    icon: BarChart3,
    requiredRole: ADMIN_ONLY,
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    requiredRole: ADMIN_ONLY,
    children: [
      { label: 'Club', href: '/configuracion/club' },
      { label: 'Roles y accesos', href: '/configuracion/roles' },
      { label: 'Cuotas', href: '/configuracion/cuotas' },
      { label: 'Planificación temporada', href: '/configuracion/planificacion' },
      { label: 'Plantillas email', href: '/configuracion/plantillas-email' },  // NUEVA (editable, con preview)
      { label: 'Integraciones', href: '/configuracion/integraciones' },
      { label: 'Cobros con tarjeta', href: '/configuracion/cobros' },
    ],
  },
]

function NavItemComponent({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const router = useRouter()
  const { roles } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  // Clear spinner when navigation completes (pathname changed)
  useEffect(() => {
    setPendingHref(null)
  }, [pathname])

  if (item.requiredRole && !item.requiredRole.some((r) => roles.includes(r as never))) {
    return null
  }

  const fullHref = item.href
  const isActive = pathname === fullHref || pathname.startsWith(fullHref + '/')
  const Icon = item.icon

  // SPA navigation via App Router. Rutas sin prefijo de slug.
  function navigate(href: string) {
    if (href === pathname) return
    setPendingHref(href)
    router.push(href)
  }

  if (!item.children) {
    const loading = pendingHref === fullHref
    return (
      <button
        onClick={() => navigate(fullHref)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-active/50 hover:text-white'
        )}
      >
        {loading
          ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" />
          : <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        }
        {item.label}
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-active/50 hover:text-white'
        )}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {(open || isActive) && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {item.children.filter(child =>
            !child.requiredRole || child.requiredRole.some(r => roles.includes(r as never))
          ).map((child) => {
            const fullChildHref = child.href
            const loading = pendingHref === fullChildHref
            return (
              <button
                key={child.href}
                onClick={() => navigate(fullChildHref)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                  pathname === fullChildHref
                    ? 'text-white bg-sidebar-active'
                    : 'text-sidebar-foreground hover:text-white'
                )}
              >
                {loading && <Loader2 className="w-3 h-3 animate-spin shrink-0" />}
                {child.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { club, settings } = useClub()
  const { member, roles, isSuperAdmin } = useCurrentUser()

  // Feature flags — por defecto false para clubs nuevos, true solo si está activado en club_settings
  const rffmEnabled     = !!settings?.rffm_enabled
  const personalEnabled = !!settings?.personal_enabled

  const navItems = NAV_ITEMS
    // Quitar RFFM del submenu Scouting si no está habilitado
    .map(item =>
      item.href === '/scouting' && item.children
        ? { ...item, children: item.children.filter(c => c.href !== '/scouting/rffm' || rffmEnabled) }
        : item
    )
    // Quitar Personal del Club si no está habilitado
    .filter(item => item.href !== '/personal' || personalEnabled)
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ROLE_LABELS } = require('@/types/roles')
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const primaryRoleLabel = roles.length > 0
    ? (ROLE_LABELS as Record<string, string>)[roles[0]] ?? roles[0]
    : 'Usuario'

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú de navegación"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-white shadow-lg"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-sidebar flex flex-col h-screen fixed left-0 top-0 z-40 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Club header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {club.logo_url ? (
              <Image
                src={club.logo_url}
                alt={club.name}
                width={40}
                height={40}
                className="rounded-lg object-contain bg-white p-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
                {club.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold text-sm truncate">{club.name}</p>
              <a href="/select-club" className="text-slate-400 text-xs hover:text-white transition-colors">
                Cambiar club ⇄
              </a>
            </div>
            {/* Close button mobile */}
            <button onClick={() => setMobileOpen(false)} aria-label="Cerrar menú de navegación" className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} />
          ))}
        </nav>

        {/* Superadmin link — solo visible para admins de plataforma */}
        {isSuperAdmin && (
          <div className="px-3 pb-2">
            <Link
              href="/superadmin"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-yellow-400 hover:bg-yellow-400/10 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Panel superadmin
            </Link>
          </div>
        )}

        {/* User footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-active/50 group">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
              {member.full_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{member.full_name}</p>
              <p className="text-slate-400 text-xs truncate">{primaryRoleLabel}</p>
            </div>
            <Link
              href="/cambiar-password"
              aria-label="Cambiar contraseña"
              title="Cambiar contraseña"
              className="text-slate-400 hover:text-white lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
            >
              <KeyRound className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="text-slate-400 hover:text-white lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
