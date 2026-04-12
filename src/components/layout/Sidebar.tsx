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
  Menu,
  X,
  Loader2,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useCurrentUser } from '@/context/UserContext'
import { useClub } from '@/context/ClubContext'
import { createClient } from '@/lib/supabase/client'
import { useState, useTransition } from 'react'

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
      { label: 'Sesiones', href: '/entrenadores/sesiones', requiredRole: ADMIN_ONLY },
      { label: 'Partidos', href: '/entrenadores/partidos', requiredRole: ADMIN_ONLY },
      { label: 'Ejercicios', href: '/entrenadores/ejercicios', requiredRole: ADMIN_ONLY },
      { label: 'Observaciones', href: '/entrenadores/observaciones', requiredRole: ADMIN_ONLY },
    ],
  },
  {
    label: 'Contabilidad',
    href: '/contabilidad',
    icon: DollarSign,
    requiredRole: CONTABILIDAD_ROLES,
    children: [
      { label: 'Pagos', href: '/contabilidad/pagos' },
      { label: 'Gastos', href: '/contabilidad/gastos' },
      { label: 'Cierre de caja', href: '/contabilidad/caja' },
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
      { label: 'Plantillas email', href: '/configuracion/plantillas-email' },
      { label: 'Integraciones', href: '/configuracion/integraciones' },
    ],
  },
]

function NavItemComponent({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const router = useRouter()
  const { roles } = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pendingHref, setPendingHref] = useState<string | null>(null)

  if (item.requiredRole && !item.requiredRole.some((r) => roles.includes(r as never))) {
    return null
  }

  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  function navigate(href: string) {
    if (href === pathname) return
    setPendingHref(href)
    startTransition(() => {
      router.push(href)
    })
  }

  if (!item.children) {
    const loading = isPending && pendingHref === item.href
    return (
      <button
        onClick={() => navigate(item.href)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isActive
            ? 'bg-sidebar-active text-white'
            : 'text-sidebar-foreground hover:bg-sidebar-active/50 hover:text-white'
        )}
      >
        {loading
          ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
          : <Icon className="w-4 h-4 shrink-0" />
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
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>

      {(open || isActive) && (
        <div className="ml-7 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
          {item.children.filter(child =>
            !child.requiredRole || child.requiredRole.some(r => roles.includes(r as never))
          ).map((child) => {
            const loading = isPending && pendingHref === child.href
            return (
              <button
                key={child.href}
                onClick={() => navigate(child.href)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors',
                  pathname === child.href
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
  const { club } = useClub()
  const { member, roles } = useCurrentUser()
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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar rounded-lg text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
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
              <p className="text-slate-400 text-xs">CRM Club</p>
            </div>
            {/* Close button mobile */}
            <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItemComponent key={item.href} item={item} />
          ))}
        </nav>

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
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
