'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Save, Upload, Trash2 } from 'lucide-react'
import { updateClubBasics, uploadClubLogo } from '../actions/club.actions'

interface Props {
  initial: {
    name: string
    city: string | null
    logo_url: string | null
    primary_color: string | null
    secondary_color: string | null
    sibling_discount_enabled: boolean
    sibling_discount_percent: number
  }
}

export function ClubSettingsForm({ initial }: Props) {
  const [name, setName] = useState(initial.name)
  const [city, setCity] = useState(initial.city ?? '')
  const [logoUrl, setLogoUrl] = useState(initial.logo_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color ?? '#003087')
  const [secondaryColor, setSecondaryColor] = useState(initial.secondary_color ?? '#FFFFFF')
  const [siblingEnabled, setSiblingEnabled] = useState(initial.sibling_discount_enabled)
  const [siblingPercent, setSiblingPercent] = useState(initial.sibling_discount_percent || 40)

  const fileRef = useRef<HTMLInputElement>(null)
  const [savingPending, startSaving] = useTransition()
  const [uploadPending, startUpload] = useTransition()

  function handleSave() {
    startSaving(async () => {
      const result = await updateClubBasics({
        name,
        city,
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        sibling_discount_enabled: siblingEnabled,
        sibling_discount_percent: Number(siblingPercent) || 0,
      })
      if (result.success) toast.success('Configuracion guardada')
      else toast.error(result.error ?? 'Error al guardar')
    })
  }

  function handleUploadClick() {
    fileRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.set('file', file)
    startUpload(async () => {
      const result = await uploadClubLogo(fd)
      if (result.success) {
        setLogoUrl(result.logoUrl)
        toast.success('Logo subido')
      } else {
        toast.error(result.error ?? 'Error al subir el logo')
      }
      if (fileRef.current) fileRef.current.value = ''
    })
  }

  function handleRemoveLogo() {
    if (!confirm('Quitar el logo actual?')) return
    setLogoUrl('')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Identidad */}
      <section className="card p-5 space-y-4">
        <h2 className="text-base font-semibold">Identidad del club</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="name" className="label">Nombre del club</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="city" className="label">Ciudad</label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input w-full"
              placeholder="Getafe"
            />
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <label className="label">Escudo / logo</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted overflow-hidden">
              {logoUrl ? (
                // Use plain <img> to avoid next/image domain config for the preview
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">sin logo</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  disabled={uploadPending}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadPending ? 'Subiendo...' : 'Subir archivo'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="btn-ghost text-xs text-red-600 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://...  (o pega una URL externa)"
                className="input w-full text-xs"
              />
              <p className="text-xs text-muted-foreground">
                PNG/JPG/SVG, máx 3 MB. Aparecerá en el sidebar y en los PDFs de sesión.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Colores */}
      <section className="card p-5 space-y-4">
        <h2 className="text-base font-semibold">Colores corporativos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="primary" className="label">Color principal</label>
            <div className="flex items-center gap-2">
              <input
                id="primary"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-border cursor-pointer p-1"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="input flex-1 font-mono text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="secondary" className="label">Color secundario</label>
            <div className="flex items-center gap-2">
              <input
                id="secondary"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-border cursor-pointer p-1"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="input flex-1 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Cuotas */}
      <section className="card p-5 space-y-4">
        <h2 className="text-base font-semibold">Cuotas y descuentos</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Descuento al 2º hermano</p>
              <p className="text-xs text-muted-foreground">
                Aplica un porcentaje sobre la cuota del hermano con menor importe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSiblingEnabled((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                siblingEnabled ? 'bg-primary' : 'bg-muted'
              }`}
              aria-pressed={siblingEnabled}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  siblingEnabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
          {siblingEnabled && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={siblingPercent}
                onChange={(e) => setSiblingPercent(Number(e.target.value))}
                className="input w-24"
              />
              <span className="text-sm text-muted-foreground">% sobre la cuota menor</span>
            </div>
          )}
        </div>
      </section>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={savingPending}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {savingPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

