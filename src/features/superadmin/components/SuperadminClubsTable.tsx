'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Users, Layers, FileSpreadsheet, CheckCircle2, XCircle,
  LogIn, ExternalLink, ChevronRight, Wifi, WifiOff, MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ClubSummary } from '@/features/superadmin/actions/superadmin.actions'
import { impersonateClub, toggleClubActive } from '@/features/superadmin/actions/superadmin.actions'
import { cn } from '@/lib/utils/cn'

export function SuperadminClubsTable({ clubs }: { clubs: ClubSummary[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = clubs.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && c.active) ||
      (filter === 'inactive' && !c.active)
    return matchesSearch && matchesFilter
  })

  return (
    <div>
      {/* Filtros */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar club..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-xs bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm text-white placeholder-slate-500 outline-none focus:border-yellow-400 transition-colors"
        />
        <div className="flex gap-1">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                filter === f
                  ? 'bg-yellow-400 text-black'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Inactivos'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Club</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Plan</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Suscripción</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Jugadores</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Equipos</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Staff</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Contacto</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Fuente</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Últ. actividad</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">G. Sheets</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center text-slate-500 text-sm">
                  No se encontraron clubs
                </td>
              </tr>
            ) : (
              filtered.map((club) => (
                <ClubRow key={club.id} club={club} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SubscriptionBadge({ status, trialEndsAt }: { status: string | null; trialEndsAt: string | null }) {
  if (status === 'trial') {
    const daysLeft = trialEndsAt
      ? Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000)
      : null
    const expired = daysLeft !== null && daysLeft <= 0
    return (
      <span className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium',
        expired ? 'bg-red-500/20 text-red-400' : daysLeft !== null && daysLeft <= 4 ? 'bg-orange-500/20 text-orange-400' : 'bg-sky-500/20 text-sky-400'
      )}>
        {expired ? 'Trial caducado' : daysLeft !== null ? `Trial · ${daysLeft}d` : 'Trial'}
      </span>
    )
  }
  const map: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    ltd: 'bg-purple-500/20 text-purple-400',
    past_due: 'bg-orange-500/20 text-orange-400',
    canceled: 'bg-red-500/20 text-red-400',
    unpaid: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', map[status ?? ''] ?? 'bg-slate-700 text-slate-400')}>
      {status ?? '—'}
    </span>
  )
}

function LastActivity({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-slate-600">Nunca</span>
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
  const label = days === 0 ? 'Hoy' : days === 1 ? 'Ayer' : `Hace ${days}d`
  // Un lead que lleva 7+ días sin tocar la app necesita rescate
  const stale = days >= 7
  return <span className={cn('text-xs', stale ? 'text-orange-400' : 'text-slate-300')}>{label}</span>
}

function ClubRow({ club }: { club: ClubSummary }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()

  function handleImpersonate() {
    startTransition(async () => {
      await impersonateClub(club.id)
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await toggleClubActive(club.id, !club.active)
      if (res.success) {
        toast.success(club.active ? 'Club desactivado' : 'Club activado')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
    setMenuOpen(false)
  }

  const planColors: Record<string, string> = {
    starter: 'bg-slate-700 text-slate-300',
    pro: 'bg-blue-500/20 text-blue-400',
    enterprise: 'bg-yellow-400/20 text-yellow-400',
  }

  return (
    <tr className={cn('group hover:bg-slate-800/30 transition-colors', !club.active && 'opacity-50')}>
      {/* Nombre */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {club.logo_url ? (
            <Image
              src={club.logo_url}
              alt={club.name}
              width={32}
              height={32}
              className="rounded-md object-contain bg-white p-0.5 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-yellow-400 flex items-center justify-center text-black font-bold text-sm shrink-0">
              {club.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-medium text-white">{club.name}</p>
            <p className="text-xs text-slate-500">/{club.slug} · {club.current_season ?? 'Sin temporada'}</p>
          </div>
        </div>
      </td>

      {/* Plan */}
      <td className="px-4 py-4">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', planColors[club.plan] ?? planColors.starter)}>
          {club.plan}
        </span>
      </td>

      {/* Suscripción */}
      <td className="px-4 py-4 text-center">
        <SubscriptionBadge status={club.subscription_status} trialEndsAt={club.trial_ends_at} />
      </td>

      {/* Jugadores */}
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1 text-slate-300">
          <Users className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>{club.player_count}</span>
        </div>
      </td>

      {/* Equipos */}
      <td className="px-4 py-4 text-center">
        <div className="flex items-center justify-center gap-1 text-slate-300">
          <Layers className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          <span>{club.team_count}</span>
        </div>
      </td>

      {/* Staff */}
      <td className="px-4 py-4 text-center">
        <span className="text-slate-300">{club.member_count}</span>
      </td>

      {/* Contacto */}
      <td className="px-4 py-4">
        <div className="text-xs">
          {club.owner_email && <p className="text-slate-300 truncate max-w-[180px]" title={club.owner_email}>{club.owner_email}</p>}
          {club.contact_phone
            ? <p className="text-slate-400">{club.contact_phone}</p>
            : <p className="text-slate-600">Sin teléfono</p>}
        </div>
      </td>

      {/* Fuente de adquisición */}
      <td className="px-4 py-4">
        {club.acquisition_campaign || club.acquisition_source ? (
          <div className="text-xs">
            <p className="text-slate-300">{club.acquisition_campaign ?? club.acquisition_source}</p>
            {club.acquisition_content && <p className="text-slate-500 truncate max-w-[140px]" title={club.acquisition_content}>{club.acquisition_content}</p>}
          </div>
        ) : (
          <span className="text-xs text-slate-600">Directo</span>
        )}
      </td>

      {/* Última actividad */}
      <td className="px-4 py-4 text-center">
        <LastActivity date={club.last_activity} />
      </td>

      {/* Google Sheets */}
      <td className="px-4 py-4 text-center">
        {club.has_google_sheet ? (
          <div className="flex flex-col items-center gap-0.5">
            <Wifi className="w-4 h-4 text-green-400" aria-hidden="true" />
            {club.last_sheet_sync && (
              <span className="text-xs text-slate-500">
                {new Date(club.last_sheet_sync).toLocaleDateString('es-ES')}
              </span>
            )}
          </div>
        ) : (
          <WifiOff className="w-4 h-4 text-slate-600 mx-auto" aria-hidden="true" />
        )}
      </td>

      {/* Estado */}
      <td className="px-4 py-4 text-center">
        {club.active ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" aria-hidden="true" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500 mx-auto" aria-hidden="true" />
        )}
      </td>

      {/* Acciones */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleImpersonate}
            disabled={isPending}
            aria-label={`Entrar como admin de ${club.name}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 text-black rounded-md text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <LogIn className="w-3 h-3" aria-hidden="true" />
            Entrar
          </button>

          {/* Menú de más opciones */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Más opciones"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
            >
              <MoreVertical className="w-4 h-4" aria-hidden="true" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]">
                  <button
                    onClick={handleToggleActive}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    {club.active ? 'Desactivar club' : 'Activar club'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
