'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, X, Target } from 'lucide-react'
import { updateSessionObjectives } from '@/features/entrenadores/actions/session.actions'

interface SessionObjectivesProps {
  sessionId: string
  objectives: string[]
  isCompleted: boolean
}

export function SessionObjectives({
  sessionId,
  objectives: initial,
  isCompleted,
}: SessionObjectivesProps) {
  const [isPending, startTransition] = useTransition()
  const [objectives, setObjectives] = useState<string[]>(initial)
  const [newObj, setNewObj] = useState('')
  const [dirty, setDirty] = useState(false)

  function addObjective() {
    const val = newObj.trim()
    if (!val) return
    if (objectives.includes(val)) return
    setObjectives((prev) => [...prev, val])
    setNewObj('')
    setDirty(true)
  }

  function removeObjective(idx: number) {
    setObjectives((prev) => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateSessionObjectives(sessionId, objectives)
      if (result.success) {
        toast.success('Objetivos guardados')
        setDirty(false)
      } else {
        toast.error(result.error ?? 'Error')
      }
    })
  }

  if (isCompleted && objectives.length === 0) return null

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Objetivos</h3>
        </div>
        {!isCompleted && dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="btn-secondary text-sm"
          >
            {isPending ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>

      {objectives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {objectives.map((obj, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-sm rounded-full px-3 py-1.5"
            >
              {obj}
              {!isCompleted && (
                <button
                  type="button"
                  onClick={() => removeObjective(i)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!isCompleted && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newObj}
            onChange={(e) => setNewObj(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addObjective()
              }
            }}
            placeholder="Nuevo objetivo..."
            className="input flex-1 text-sm"
          />
          <button
            type="button"
            onClick={addObjective}
            className="btn-secondary px-3"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
