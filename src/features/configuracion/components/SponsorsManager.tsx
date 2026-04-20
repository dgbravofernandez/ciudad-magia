'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, X, ArrowUp, ArrowDown } from 'lucide-react'
import {
  addSponsor,
  deleteSponsor,
  updateSponsor,
  uploadSponsorLogo,
  type Sponsor,
} from '../actions/club.actions'
import { useRouter } from 'next/navigation'

export function SponsorsManager({ initial }: { initial: Sponsor[] }) {
  const router = useRouter()
  const [sponsors, setSponsors] = useState<Sponsor[]>(initial)
  const [isPending, startTransition] = useTransition()

  // Form de añadir
  const [newName, setNewName] = useState('')
  const [newWebsite, setNewWebsite] = useState('')
  const [newLogo, setNewLogo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleUploadNew() {
    fileRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    startTransition(async () => {
      const res = await uploadSponsorLogo(fd)
      if (res.success) {
        setNewLogo(res.logoUrl)
        toast.success('Logo subido')
      } else {
        toast.error(res.error ?? 'Error al subir')
      }
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  function handleAdd() {
    if (!newName.trim()) {
      toast.error('Escribe el nombre del patrocinador')
      return
    }
    startTransition(async () => {
      const res = await addSponsor({
        name: newName.trim(),
        logo_url: newLogo,
        website: newWebsite.trim() || null,
      })
      if (res.success) {
        toast.success('Patrocinador añadido')
        setNewName('')
        setNewWebsite('')
        setNewLogo(null)
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este patrocinador?')) return
    startTransition(async () => {
      const res = await deleteSponsor(id)
      if (res.success) {
        setSponsors((prev) => prev.filter((s) => s.id !== id))
        toast.success('Eliminado')
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleMove(id: string, dir: -1 | 1) {
    const idx = sponsors.findIndex((s) => s.id === id)
    if (idx === -1) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sponsors.length) return
    const reordered = [...sponsors]
    const [item] = reordered.splice(idx, 1)
    reordered.splice(swapIdx, 0, item)
    setSponsors(reordered)
    startTransition(async () => {
      await Promise.all(
        reordered.map((s, i) =>
          s.sort_order !== i ? updateSponsor(s.id, { sort_order: i }) : Promise.resolve()
        )
      )
      router.refresh()
    })
  }

  function handleToggleActive(s: Sponsor) {
    startTransition(async () => {
      const res = await updateSponsor(s.id, { active: !s.active })
      if (res.success) {
        setSponsors((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !s.active } : x)))
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Patrocinadores</h2>
        <p className="text-xs text-muted-foreground">
          Aparecen en el pie de los PDFs de convocatoria. Arrastra el orden con las flechas.
        </p>
      </div>

      {/* Lista existente */}
      <div className="space-y-2">
        {sponsors.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
            Sin patrocinadores todavía.
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {sponsors.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleMove(s.id, -1)}
                    disabled={i === 0 || isPending}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleMove(s.id, 1)}
                    disabled={i === sponsors.length - 1 || isPending}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="w-12 h-12 rounded border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo_url} alt={s.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">sin logo</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.website && (
                    <p className="text-xs text-muted-foreground truncate">{s.website}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleActive(s)}
                  disabled={isPending}
                  className={`text-xs px-2 py-1 rounded border ${
                    s.active
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  {s.active ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  disabled={isPending}
                  className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Añadir nuevo */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium">Añadir patrocinador</p>
        <div className="flex items-start gap-3">
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden shrink-0 relative">
            {newLogo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={newLogo} alt="preview" className="w-full h-full object-contain" />
                <button
                  onClick={() => setNewLogo(null)}
                  className="absolute top-0.5 right-0.5 bg-white/90 rounded-full p-0.5"
                  title="Quitar"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">sin logo</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del patrocinador"
              className="input w-full"
            />
            <input
              type="text"
              value={newWebsite}
              onChange={(e) => setNewWebsite(e.target.value)}
              placeholder="Web (opcional)"
              className="input w-full text-xs"
            />
            <div className="flex gap-2">
              <button
                onClick={handleUploadNew}
                disabled={isPending}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Subir logo (PNG)
              </button>
              <button
                onClick={handleAdd}
                disabled={isPending || !newName.trim()}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Añadir
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground">
              Recomendado: PNG con fondo transparente, máx 3 MB.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
