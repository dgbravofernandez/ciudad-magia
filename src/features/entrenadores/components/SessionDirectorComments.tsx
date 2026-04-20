'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageSquare, Trash2, Eye, EyeOff, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils/currency'
import {
  addSessionDirectorComment,
  deleteSessionDirectorComment,
  updateSessionDirectorComment,
} from '@/features/entrenadores/actions/session-director-comments.actions'

interface Comment {
  id: string
  comment: string
  visible_to_coach: boolean
  created_at: string
  author?: { full_name: string } | null
}

interface Props {
  sessionId: string
  comments: Comment[]
  canWrite: boolean
}

export function SessionDirectorComments({ sessionId, comments, canWrite }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [text, setText] = useState('')
  const [visibleToCoach, setVisibleToCoach] = useState(true)

  function submit() {
    if (!text.trim()) return
    startTransition(async () => {
      const res = await addSessionDirectorComment({
        session_id: sessionId,
        comment: text,
        visible_to_coach: visibleToCoach,
      })
      if (res.success) {
        toast.success('Comentario añadido')
        setText('')
        setShowForm(false)
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function toggleVisibility(c: Comment) {
    startTransition(async () => {
      const res = await updateSessionDirectorComment({
        id: c.id,
        visible_to_coach: !c.visible_to_coach,
      })
      if (res.success) router.refresh()
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este comentario?')) return
    startTransition(async () => {
      const res = await deleteSessionDirectorComment(id)
      if (res.success) {
        toast.success('Comentario eliminado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold">Comentarios de dirección</h3>
          <span className="text-xs text-muted-foreground">({comments.length})</span>
        </div>
        {canWrite && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-ghost gap-2 flex items-center text-sm">
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
        )}
      </div>

      {canWrite && showForm && (
        <div className="mb-4 space-y-3 border-b pb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="input w-full"
            placeholder="Observaciones libres sobre esta sesión o partido…"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={visibleToCoach}
              onChange={(e) => setVisibleToCoach(e.target.checked)}
            />
            Visible para el entrenador
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setText('') }} disabled={isPending} className="btn-ghost">
              Cancelar
            </button>
            <button onClick={submit} disabled={isPending || !text.trim()} className="btn-primary">
              {isPending ? 'Guardando…' : 'Publicar'}
            </button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Sin comentarios todavía.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {c.author?.full_name ?? 'Dirección'} · {formatDate(c.created_at)}
                    {!c.visible_to_coach && (
                      <span className="ml-2 badge badge-muted text-[10px]">Privado</span>
                    )}
                  </p>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleVisibility(c)}
                      disabled={isPending}
                      className="p-1 text-gray-400 hover:text-gray-700"
                      title={c.visible_to_coach ? 'Marcar como privado' : 'Hacer visible al entrenador'}
                    >
                      {c.visible_to_coach ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={isPending}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
