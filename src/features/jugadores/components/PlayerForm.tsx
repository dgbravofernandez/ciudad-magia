'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPlayer, updatePlayer } from '@/features/jugadores/actions/player.actions'
import type { Player } from '@/types/database.types'

const POSITIONS = ['Portero', 'Defensa', 'Centrocampista', 'Delantero']
const FEET = ['Derecho', 'Izquierdo', 'Ambos']
const STATUSES = [
  { value: 'active', label: 'Activo' },
  { value: 'injured', label: 'Lesionado' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'low', label: 'Baja' },
]

export function PlayerForm({
  player,
  teams,
}: {
  player?: Player
  teams: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!player

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      if (isEditing) {
        const result = await updatePlayer(player.id, formData)
        if (result.success) {
          toast.success('Jugador actualizado')
          router.push(`/jugadores/${player.id}`)
          router.refresh()
        } else {
          toast.error(result.error ?? 'Error al actualizar')
        }
      } else {
        const result = await createPlayer(formData)
        if (result.success) {
          toast.success('Jugador creado')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((result as any).docsEmailSent) {
            toast.success('Email de solicitud de documentos enviado al tutor')
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push(`/jugadores/${(result as any).player?.id ?? ''}`)
          router.refresh()
        } else {
          toast.error(result.error ?? 'Error al crear jugador')
        }
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Datos personales */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-base">Datos personales</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre *</label>
            <input
              name="first_name"
              className="input w-full"
              defaultValue={player?.first_name ?? ''}
              required
            />
          </div>
          <div>
            <label className="label">Apellidos *</label>
            <input
              name="last_name"
              className="input w-full"
              defaultValue={player?.last_name ?? ''}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fecha de nacimiento</label>
            <input
              name="birth_date"
              type="date"
              className="input w-full"
              defaultValue={player?.birth_date ?? ''}
            />
          </div>
          <div>
            <label className="label">DNI / NIE</label>
            <input
              name="dni"
              className="input w-full"
              defaultValue={player?.dni ?? ''}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nacionalidad</label>
            <input
              name="nationality"
              className="input w-full"
              defaultValue={player?.nationality ?? 'ES'}
            />
          </div>
          <div>
            <label className="label">Posición</label>
            <select name="position" className="input w-full" defaultValue={player?.position ?? ''}>
              <option value="">Sin asignar</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Pie dominante</label>
            <select name="dominant_foot" className="input w-full" defaultValue={player?.dominant_foot ?? ''}>
              <option value="">Sin asignar</option>
              {FEET.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dorsal</label>
            <input
              name="dorsal_number"
              type="number"
              min="1"
              max="99"
              className="input w-full"
              defaultValue={player?.dorsal_number ?? ''}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Altura (cm)</label>
            <input
              name="height_cm"
              type="number"
              className="input w-full"
              defaultValue={player?.height_cm ?? ''}
            />
          </div>
          <div>
            <label className="label">Peso (kg)</label>
            <input
              name="weight_kg"
              type="number"
              step="0.1"
              className="input w-full"
              defaultValue={player?.weight_kg ?? ''}
            />
          </div>
        </div>
      </div>

      {/* Tutor */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-base">Tutor / Contacto</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nombre del tutor</label>
            <input
              name="tutor_name"
              className="input w-full"
              defaultValue={player?.tutor_name ?? ''}
            />
          </div>
          <div>
            <label className="label">Email del tutor</label>
            <input
              name="tutor_email"
              type="email"
              className="input w-full"
              defaultValue={player?.tutor_email ?? ''}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Teléfono del tutor</label>
            <input
              name="tutor_phone"
              className="input w-full"
              defaultValue={player?.tutor_phone ?? ''}
            />
          </div>
          <div>
            <label className="label">Nombre tutor 2</label>
            <input
              name="tutor2_name"
              className="input w-full"
              defaultValue={player?.tutor2_name ?? ''}
            />
          </div>
        </div>
        <div>
          <label className="label">Email tutor 2</label>
          <input
            name="tutor2_email"
            type="email"
            className="input w-full"
            defaultValue={player?.tutor2_email ?? ''}
          />
        </div>
      </div>

      {/* Equipo y estado */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-base">Equipo y estado</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Equipo</label>
            <select name="team_id" className="input w-full" defaultValue={player?.team_id ?? ''}>
              <option value="">Sin equipo</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {isEditing && (
            <div>
              <label className="label">Estado</label>
              <select name="status" className="input w-full" defaultValue={player?.status ?? 'active'}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
        </div>
        <div>
          <label className="label">Notas internas</label>
          <textarea
            name="notes"
            className="input w-full min-h-20 resize-y"
            defaultValue={player?.notes ?? ''}
          />
        </div>
      </div>

      {!isEditing && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-base">Documentación (opcional)</h3>
          <div>
            <label className="label">Enlace al formulario de documentos</label>
            <input
              name="forms_link"
              type="url"
              placeholder="https://forms.gle/..."
              className="input w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Google Forms donde el tutor sube DNI, foto, certificado médico y justificante de reserva.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="send_docs_request"
              className="mt-0.5"
              defaultChecked
            />
            <span>
              <strong>Enviar email al tutor</strong> solicitando la documentación (DNI, foto, certificado médico, justificante de reserva) al crear el jugador.
            </span>
          </label>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-secondary"
          disabled={isPending}
        >
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear jugador'}
        </button>
      </div>
    </form>
  )
}
