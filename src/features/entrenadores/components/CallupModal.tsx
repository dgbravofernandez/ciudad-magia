'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { X, Star, Users, Loader2, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  getCallup,
  saveCallup,
  updateTeamCallupSize,
} from '../actions/callup.actions'

interface Player {
  id: string
  first_name: string
  last_name: string
  dorsal_number: number | null
  position: string | null
  status: string
}

interface SelectionState {
  called: Set<string>
  starters: Set<string>
}

export function CallupModal({
  sessionId,
  onClose,
}: {
  sessionId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [roster, setRoster] = useState<Player[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')
  const [maxSize, setMaxSize] = useState<number>(18)
  const [editingSize, setEditingSize] = useState(false)
  const [sizeDraft, setSizeDraft] = useState<number>(18)
  const [selection, setSelection] = useState<SelectionState>({
    called: new Set(),
    starters: new Set(),
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await getCallup(sessionId)
      if (!alive) return
      if (!res.success) {
        toast.error(res.error ?? 'Error cargando convocatoria')
        setLoading(false)
        return
      }
      setRoster(res.roster ?? [])
      setTeamId(res.team?.id ?? '')
      setTeamName(res.team?.name ?? '')
      setMaxSize(res.team?.default_callup_size ?? 18)
      setSizeDraft(res.team?.default_callup_size ?? 18)
      const called = new Set<string>()
      const starters = new Set<string>()
      for (const c of res.callups ?? []) {
        called.add(c.player_id)
        if (c.is_starter) starters.add(c.player_id)
      }
      setSelection({ called, starters })
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [sessionId])

  const calledCount = selection.called.size
  const starterCount = selection.starters.size
  const overMax = calledCount > maxSize

  function toggleCalled(id: string) {
    setSelection((prev) => {
      const called = new Set(prev.called)
      const starters = new Set(prev.starters)
      if (called.has(id)) {
        called.delete(id)
        starters.delete(id)
      } else {
        called.add(id)
      }
      return { called, starters }
    })
  }

  function toggleStarter(id: string) {
    setSelection((prev) => {
      const starters = new Set(prev.starters)
      const called = new Set(prev.called)
      if (starters.has(id)) {
        starters.delete(id)
      } else {
        called.add(id) // automáticamente convocado si es titular
        starters.add(id)
      }
      return { called, starters }
    })
  }

  function selectAllCalled() {
    const capped = roster.slice(0, maxSize).map((p) => p.id)
    setSelection((prev) => ({
      called: new Set(capped),
      starters: prev.starters,
    }))
  }

  function clearAll() {
    setSelection({ called: new Set(), starters: new Set() })
  }

  function handleSave() {
    if (overMax) {
      toast.error(`Superas el máximo del equipo (${maxSize}).`)
      return
    }
    const entries = Array.from(selection.called).map((player_id) => ({
      player_id,
      is_starter: selection.starters.has(player_id),
    }))
    startTransition(async () => {
      const res = await saveCallup(sessionId, entries)
      if (res.success) {
        toast.success(`Convocatoria guardada (${res.count} jugadores)`)
        router.refresh()
        onClose()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleSaveSize() {
    if (!teamId) return
    if (sizeDraft < 1 || sizeDraft > 30) {
      toast.error('El tamaño debe estar entre 1 y 30')
      return
    }
    startTransition(async () => {
      const res = await updateTeamCallupSize(teamId, sizeDraft)
      if (res.success) {
        toast.success('Tamaño de convocatoria actualizado')
        setMaxSize(sizeDraft)
        setEditingSize(false)
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  // Agrupar plantilla por posición para la UI
  const grouped = useMemo(() => {
    const groups: Record<string, Player[]> = {}
    for (const p of roster) {
      const key = p.position ?? 'Sin posición'
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    }
    return groups
  }, [roster])

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Convocatoria — {teamName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Marca los jugadores convocados. Usa la estrella para indicar titulares.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 text-sm">
            <span
              className={cn(
                'font-medium',
                overMax ? 'text-red-600' : 'text-foreground'
              )}
            >
              {calledCount} / {maxSize}
            </span>
            <span className="text-muted-foreground">
              · <span className="text-amber-600 font-medium">{starterCount}</span> titulares
            </span>
            {!editingSize ? (
              <button
                onClick={() => setEditingSize(true)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Settings2 className="w-3 h-3" />
                Cambiar máximo del equipo
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sizeDraft}
                  onChange={(e) => setSizeDraft(Number(e.target.value))}
                  className="input w-20 h-8 text-sm"
                />
                <button
                  onClick={handleSaveSize}
                  disabled={isPending}
                  className="btn-primary text-xs"
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setEditingSize(false)
                    setSizeDraft(maxSize)
                  }}
                  className="btn-ghost text-xs"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={selectAllCalled} className="btn-ghost text-xs">
              Convocar todos
            </button>
            <button onClick={clearAll} className="btn-ghost text-xs">
              Limpiar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            </div>
          ) : roster.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              No hay jugadores activos en este equipo.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([position, players]) => (
                <div key={position}>
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    {position}
                  </h4>
                  <div className="space-y-1">
                    {players.map((p) => {
                      const called = selection.called.has(p.id)
                      const starter = selection.starters.has(p.id)
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            'flex items-center gap-3 p-2 rounded-lg border transition-colors',
                            called
                              ? 'bg-primary/5 border-primary/30'
                              : 'border-transparent hover:bg-muted/40'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={called}
                            onChange={() => toggleCalled(p.id)}
                            className="w-4 h-4"
                          />
                          <span className="w-8 text-center text-xs font-mono text-muted-foreground">
                            {p.dorsal_number ?? '—'}
                          </span>
                          <span className="flex-1 text-sm">
                            {p.first_name} {p.last_name}
                            {p.status === 'injured' && (
                              <span className="ml-2 badge badge-warning text-[10px]">Lesionado</span>
                            )}
                          </span>
                          <button
                            onClick={() => toggleStarter(p.id)}
                            className={cn(
                              'p-1.5 rounded transition-colors',
                              starter
                                ? 'text-amber-500'
                                : 'text-muted-foreground/40 hover:text-amber-500'
                            )}
                            title={starter ? 'Titular' : 'Marcar como titular'}
                          >
                            <Star
                              className="w-4 h-4"
                              fill={starter ? 'currentColor' : 'none'}
                            />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-2 bg-muted/20">
          <button onClick={onClose} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isPending || loading || overMax}
            className="btn-primary text-sm"
          >
            {isPending ? 'Guardando…' : `Guardar convocatoria (${calledCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}
