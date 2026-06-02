'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Users, X, Search, UserPlus, Unlink } from 'lucide-react'
import {
  linkSiblings,
  unlinkSibling,
  searchPlayersForSibling,
  type SiblingPlayer,
} from '../actions/siblings.actions'

interface Props {
  playerId: string
  playerName: string
  initialSiblings: SiblingPlayer[]
}

export function SiblingLinker({ playerId, playerName, initialSiblings }: Props) {
  const router   = useRouter()
  const [isPending, startTransition] = useTransition()

  const [siblings, setSiblings]     = useState<SiblingPlayer[]>(initialSiblings)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SiblingPlayer[]>([])
  const [searching, setSearching]   = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchPlayersForSibling(query, playerId)
        // Filter out already linked siblings
        const siblingIds = new Set(siblings.map(s => s.id))
        setResults(res.filter(r => !siblingIds.has(r.id)))
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, playerId, siblings])

  function handleLink(target: SiblingPlayer) {
    startTransition(async () => {
      const res = await linkSiblings(playerId, target.id)
      if (res.success) {
        toast.success(`${target.first_name} ${target.last_name} vinculado/a como hermano/a`)
        setSiblings(prev => [...prev, target])
        setQuery('')
        setResults([])
        setShowSearch(false)
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al vincular')
      }
    })
  }

  function handleUnlink(sibling: SiblingPlayer) {
    if (!confirm(`¿Desvincular a ${sibling.first_name} ${sibling.last_name} como hermano/a de ${playerName}?`)) return
    startTransition(async () => {
      const res = await unlinkSibling(sibling.id)
      if (res.success) {
        toast.success('Vínculo de hermano/a eliminado')
        setSiblings(prev => prev.filter(s => s.id !== sibling.id))
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error al desvincular')
      }
    })
  }

  return (
    <div className="card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-600" />
          <h3 className="font-semibold text-sm">Hermanos/as en el club</h3>
          {siblings.length > 0 && (
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold rounded-full px-2 py-0.5">
              {siblings.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setShowSearch(v => !v); setTimeout(() => searchRef.current?.focus(), 50) }}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Vincular hermano/a
        </button>
      </div>

      {/* Siblings list */}
      {siblings.length === 0 && !showSearch && (
        <p className="text-xs text-muted-foreground">
          Sin hermanos/as vinculados. Usa el botón para vincular — el jugador/a con menor cuota recibirá un <strong>40% de descuento</strong>.
        </p>
      )}

      {siblings.length > 0 && (
        <div className="space-y-2">
          {siblings.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-xs font-bold shrink-0">
                  {s.first_name.charAt(0)}
                </div>
                <a href={`/jugadores/${s.id}`} className="text-sm font-medium text-purple-900 hover:underline">
                  {s.first_name} {s.last_name}
                </a>
                <span className="text-xs text-purple-500">−40% cuota menor</span>
              </div>
              <button
                type="button"
                onClick={() => handleUnlink(s)}
                disabled={isPending}
                title="Desvincular"
                className="p-1 rounded hover:bg-purple-100 text-purple-400 hover:text-purple-700 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search box */}
      {showSearch && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              className="input w-full pl-8 pr-8 text-sm"
              placeholder="Buscar por nombre o apellido…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setResults([]) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {searching && <p className="text-xs text-muted-foreground pl-1">Buscando…</p>}

          {results.length > 0 && (
            <div className="border rounded-lg overflow-hidden divide-y">
              {results.map(r => (
                <button
                  key={r.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleLink(r)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors text-sm text-left"
                >
                  <span className="font-medium">{r.first_name} {r.last_name}</span>
                  <span className="text-xs text-primary font-medium">Vincular →</span>
                </button>
              ))}
            </div>
          )}

          {query.length >= 2 && !searching && results.length === 0 && (
            <p className="text-xs text-muted-foreground pl-1">No se encontraron jugadores activos con ese nombre.</p>
          )}
        </div>
      )}
    </div>
  )
}
