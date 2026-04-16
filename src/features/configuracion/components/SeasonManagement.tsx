'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CalendarRange, CheckCircle2, Download, Play } from 'lucide-react'
import { getSeasonPreview, startNewSeason, exportSeasonData } from '@/features/configuracion/actions/season.actions'

interface SeasonPreview {
  currentSeason: string
  nextSeason: string
  activeTeams: number
  continuingWithTeam: number
  continuingWithoutTeam: number
  notContinuing: number
  totalPlayers: number
}

export function SeasonManagement() {
  const [preview, setPreview] = useState<SeasonPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState<{ nextSeason: string; teamsCreated: number; playersUpdated: number } | null>(null)

  useEffect(() => {
    getSeasonPreview()
      .then((p) => setPreview(p))
      .finally(() => setLoadingPreview(false))
  }, [])

  function handleStart() {
    startTransition(async () => {
      const result = await startNewSeason()
      if (result.success) {
        setDone({
          nextSeason: (result as { nextSeason: string }).nextSeason,
          teamsCreated: (result as { teamsCreated: number }).teamsCreated,
          playersUpdated: (result as { playersUpdated: number }).playersUpdated,
        })
        setShowConfirm(false)
        toast.success(`Temporada ${(result as { nextSeason: string }).nextSeason} iniciada`)
        // Reload preview
        setLoadingPreview(true)
        getSeasonPreview().then((p) => setPreview(p)).finally(() => setLoadingPreview(false))
      } else {
        toast.error((result as { error: string }).error ?? 'Error al iniciar temporada')
      }
    })
  }

  function handleExport() {
    startTransition(async () => {
      const result = await exportSeasonData()
      if (!result.success) {
        toast.error((result as { error: string }).error ?? 'Error al exportar')
        return
      }
      const { season, players, payments, sessions } = result as {
        season: string
        players: Record<string, unknown>[]
        payments: Record<string, unknown>[]
        sessions: Record<string, unknown>[]
      }
      const seasonSlug = season.replace('/', '-')

      // Players CSV
      if (players.length > 0) {
        downloadCsv(
          players.map((p) => ({
            Nombre: (p.first_name as string) ?? '',
            Apellidos: (p.last_name as string) ?? '',
            DNI: (p.dni as string) ?? '',
            Posicion: (p.position as string) ?? '',
            Equipo: ((p.teams as { name: string } | null)?.name) ?? '',
            Estado: (p.status as string) ?? '',
            'Tutor': (p.tutor_name as string) ?? '',
            'Email tutor': (p.tutor_email as string) ?? '',
            'Telefono tutor': (p.tutor_phone as string) ?? '',
          })),
          `Jugadores-${seasonSlug}.csv`
        )
      }

      // Payments CSV
      if (payments.length > 0) {
        downloadCsv(
          payments.map((p) => ({
            Jugador: (() => {
              const pl = p.players as { first_name: string; last_name: string } | null
              return pl ? `${pl.first_name} ${pl.last_name}` : ''
            })(),
            Concepto: (p.concept as string) ?? '',
            'Importe debido': (p.amount_due as number) ?? 0,
            'Importe pagado': (p.amount_paid as number) ?? 0,
            Estado: (p.status as string) ?? '',
            'Fecha pago': (p.payment_date as string) ?? '',
            'Forma pago': (p.payment_method as string) ?? '',
          })),
          `Pagos-${seasonSlug}.csv`
        )
      }

      // Sessions CSV
      if (sessions.length > 0) {
        downloadCsv(
          sessions.map((s) => ({
            Tipo: (s.session_type as string) ?? '',
            Fecha: (s.session_date as string) ?? '',
            Equipo: ((s.teams as { name: string } | null)?.name) ?? '',
            Notas: (s.notes as string) ?? '',
          })),
          `Sesiones-${seasonSlug}.csv`
        )
      }

      toast.success(`Datos de temporada ${season} exportados`)
    })
  }

  if (loadingPreview) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded" />
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="space-y-6 max-w-xl">
      {/* Current season card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarRange className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Temporada activa</p>
            <p className="text-2xl font-bold text-primary">{preview.currentSeason}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{preview.activeTeams}</p>
            <p className="text-xs text-muted-foreground">Equipos activos</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{preview.totalPlayers}</p>
            <p className="text-xs text-muted-foreground">Jugadores activos</p>
          </div>
        </div>
      </div>

      {/* Export button */}
      <div className="card p-4">
        <div className="flex items-start gap-3">
          <Download className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">Exportar datos de temporada</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descarga los listados de jugadores, pagos y sesiones en CSV para archivarlos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isPending}
            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            {isPending ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Start new season */}
      {done ? (
        <div className="card p-6 border-green-200 bg-green-50 space-y-2">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <p className="font-semibold">¡Temporada {done.nextSeason} iniciada!</p>
          </div>
          <ul className="text-sm text-green-600 space-y-1 ml-7">
            <li>✓ {done.teamsCreated} equipos nuevos creados</li>
            <li>✓ {done.playersUpdated} jugadores actualizados</li>
          </ul>
        </div>
      ) : (
        <div className="card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <Play className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Iniciar temporada {preview.nextSeason}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Esta acción creará los equipos de la nueva temporada y moverá automáticamente
                a los jugadores que tienen asignado equipo para {preview.nextSeason}.
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Resumen del cambio</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Equipos a crear (copia de activos)</span>
                <span className="font-medium">{preview.activeTeams}</span>
              </div>
              <div className="flex justify-between">
                <span>Jugadores con equipo asignado ({preview.nextSeason})</span>
                <span className="font-medium text-green-600">{preview.continuingWithTeam}</span>
              </div>
              <div className="flex justify-between">
                <span>Jugadores sin equipo asignado aún</span>
                <span className="font-medium text-amber-600">{preview.continuingWithoutTeam}</span>
              </div>
              <div className="flex justify-between">
                <span>Jugadores que no continúan</span>
                <span className="font-medium text-red-600">{preview.notContinuing}</span>
              </div>
            </div>
          </div>

          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="btn-primary w-full"
            >
              Iniciar temporada {preview.nextSeason}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">¿Seguro que quieres continuar?</p>
                  <p className="text-xs mt-0.5">
                    Los equipos de la temporada {preview.currentSeason} se marcarán como inactivos.
                    Esta acción no se puede deshacer fácilmente.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={isPending}
                  className="btn-primary flex-1"
                >
                  {isPending ? 'Procesando...' : `Confirmar — iniciar ${preview.nextSeason}`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="btn-ghost"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CSV download helper ───────────────────────────────────────────────────────

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h] ?? ''
        const str = String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
