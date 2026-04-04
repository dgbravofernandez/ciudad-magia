'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { Upload, FolderOpen, Check, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { approveMedia, rejectMedia } from '@/features/personal/actions/personal.actions'

interface MediaItem {
  id: string
  url: string | null
  caption: string | null
  type: string
  approved: boolean
  created_at: string
  teams: { id: string; name: string } | null
}

interface Team {
  id: string
  name: string
}

interface Props {
  clubId: string
  mediaItems: MediaItem[]
  teams: Team[]
}

export function RedesPage({ mediaItems, teams }: Props) {
  const [filterTeam, setFilterTeam] = useState('')
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [driveUrl, setDriveUrl] = useState('')
  const [showDriveInput, setShowDriveInput] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pendingApproval = mediaItems.filter((m) => !m.approved && m.type !== 'drive_folder')

  const filteredItems = mediaItems.filter((m) => {
    const matchTeam = !filterTeam || m.teams?.id === filterTeam
    const itemDate = new Date(m.created_at)
    const matchMonth = itemDate.getMonth() + 1 === filterMonth
    const matchYear = itemDate.getFullYear() === filterYear
    return matchTeam && matchMonth && matchYear
  })

  function handleApprove(mediaId: string) {
    startTransition(async () => {
      const result = await approveMedia(mediaId)
      if (result.success) {
        toast.success('Foto aprobada')
      } else {
        toast.error(result.error ?? 'Error al aprobar')
      }
    })
  }

  function handleReject(mediaId: string) {
    startTransition(async () => {
      const result = await rejectMedia(mediaId)
      if (result.success) {
        toast.success('Foto rechazada y eliminada')
      } else {
        toast.error(result.error ?? 'Error al rechazar')
      }
    })
  }

  function handleDriveSave() {
    if (!driveUrl.trim()) return
    toast.success('Carpeta de Drive añadida (simulado)')
    setDriveUrl('')
    setShowDriveInput(false)
  }

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]

  const now = new Date()
  const years = [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-6">
      {/* Pending approval queue */}
      {pendingApproval.length > 0 && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold">Pendiente de aprobación ({pendingApproval.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {pendingApproval.map((item) => (
              <div key={item.id} className="shrink-0 relative group">
                <div className="w-32 h-32 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.caption ?? ''}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                {item.caption && (
                  <p className="text-xs text-muted-foreground mt-1 w-32 truncate">{item.caption}</p>
                )}
                {item.teams && (
                  <span className="badge badge-muted text-xs">{item.teams.name}</span>
                )}
                <div className="flex gap-1 mt-1">
                  <button
                    disabled={isPending}
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 btn-primary text-xs py-1 gap-1 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3" />
                    Aprobar
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => handleReject(item.id)}
                    className="flex-1 btn-destructive text-xs py-1 gap-1 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Album grid */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Álbum de fotos</h3>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary gap-2 flex items-center text-sm"
            >
              <Upload className="w-4 h-4" />
              Subir fotos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={() => toast.info('Subida de fotos próximamente disponible')}
            />
            <button
              onClick={() => setShowDriveInput((v) => !v)}
              className="btn-secondary gap-2 flex items-center text-sm"
            >
              <FolderOpen className="w-4 h-4" />
              Añadir carpeta Drive
            </button>
          </div>
        </div>

        {showDriveInput && (
          <div className="flex gap-2">
            <input
              type="url"
              className="input flex-1"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />
            <button onClick={handleDriveSave} className="btn-primary text-sm">Guardar</button>
            <button onClick={() => setShowDriveInput(false)} className="btn-ghost text-sm">Cancelar</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            className="input w-auto"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
          >
            <option value="">Todos los equipos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filterMonth}
            onChange={(e) => setFilterMonth(parseInt(e.target.value))}
          >
            {months.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={filterYear}
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Photo grid */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No hay fotos en este período
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
                {item.type === 'drive_folder' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                    <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center line-clamp-2">{item.caption ?? 'Carpeta Drive'}</p>
                  </div>
                ) : item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt={item.caption ?? ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* Overlay info */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.caption && (
                    <p className="text-white text-xs line-clamp-1">{item.caption}</p>
                  )}
                  {item.teams && (
                    <span className="text-white/80 text-xs">{item.teams.name}</span>
                  )}
                </div>

                {/* Approve/reject overlay if not approved */}
                {!item.approved && item.type !== 'drive_folder' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      disabled={isPending}
                      onClick={() => handleApprove(item.id)}
                      className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleReject(item.id)}
                      className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Not approved indicator */}
                {!item.approved && item.type !== 'drive_folder' && (
                  <div className="absolute top-2 right-2">
                    <span className="badge badge-warning text-xs">Pendiente</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
