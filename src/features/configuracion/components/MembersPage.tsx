'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, Pencil, Trash2, KeyRound, UserCheck, UserX, Copy } from 'lucide-react'
import { ROLES, ROLE_LABELS, type Role } from '@/types/roles'
import {
  createMember,
  updateMemberRoles,
  updateMemberProfile,
  setMemberActive,
  resetMemberPassword,
  deleteMember,
} from '@/features/configuracion/actions/members.actions'

interface MemberRole {
  role: Role
  team_id: string | null
  teams?: { name: string } | null
}

interface Member {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  active: boolean
  created_at: string
  user_id: string | null
  club_member_roles: MemberRole[]
}

interface Team { id: string; name: string }

export function MembersPage({ members, teams }: { members: Member[]; teams: Team[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter((m) => {
      if (!showInactive && !m.active) return false
      if (!q) return true
      return (
        m.full_name.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [members, search, showInactive])

  function handleResetPassword(m: Member) {
    if (!confirm(`Restablecer contraseña de ${m.full_name}? Le llegará un email con la nueva contraseña.`)) return
    startTransition(async () => {
      const res = await resetMemberPassword(m.id, true)
      if (res.success) {
        toast.success(`Contraseña restablecida. Temporal: ${res.tempPassword}`, { duration: 10000 })
        if (res.tempPassword) navigator.clipboard?.writeText(res.tempPassword).catch(() => {})
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleToggleActive(m: Member) {
    const action = m.active ? 'desactivar' : 'reactivar'
    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a ${m.full_name}?`)) return
    startTransition(async () => {
      const res = await setMemberActive(m.id, !m.active)
      if (res.success) {
        toast.success(m.active ? 'Miembro desactivado' : 'Miembro reactivado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  function handleDelete(m: Member) {
    if (!confirm(`ELIMINAR permanentemente a ${m.full_name}?\n\nPerderá el acceso y se borrará del sistema.`)) return
    startTransition(async () => {
      const res = await deleteMember(m.id)
      if (res.success) {
        toast.success('Miembro eliminado')
        router.refresh()
      } else toast.error(res.error ?? 'Error')
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-bold">Roles y accesos</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona quién entra al CRM, sus roles y contraseñas sin tocar Supabase.
          </p>
        </div>
        <button onClick={() => setNewOpen(true)} className="btn-primary gap-2 flex items-center text-sm">
          <UserPlus className="w-4 h-4" />
          Añadir miembro
        </button>
      </div>

      <div className="card p-4 flex gap-3 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email…"
          className="input flex-1"
        />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Equipo</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const uniqueRoles = Array.from(new Set(m.club_member_roles.map((r) => r.role)))
                const teamName = m.club_member_roles.find((r) => r.teams)?.teams?.name
                return (
                  <tr key={m.id} className={`border-b last:border-0 ${!m.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{m.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {uniqueRoles.map((r) => (
                          <span key={r} className="badge badge-muted text-xs">{ROLE_LABELS[r]}</span>
                        ))}
                        {uniqueRoles.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{teamName ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {m.active ? (
                        <span className="text-green-600 text-xs font-medium">Activo</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(m)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-muted text-gray-500 hover:text-primary"
                          title="Editar perfil y roles"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {m.user_id && (
                          <button
                            onClick={() => handleResetPassword(m)}
                            disabled={isPending}
                            className="p-1.5 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600"
                            title="Restablecer contraseña"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(m)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-yellow-50 text-gray-500 hover:text-yellow-600"
                          title={m.active ? 'Desactivar' : 'Reactivar'}
                        >
                          {m.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={isPending}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No hay miembros que coincidan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {newOpen && (
        <NewMemberModal
          teams={teams}
          onClose={() => setNewOpen(false)}
          onCreated={() => { setNewOpen(false); router.refresh() }}
        />
      )}

      {editing && (
        <EditMemberModal
          member={editing}
          teams={teams}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function NewMemberModal({
  teams,
  onClose,
  onCreated,
}: {
  teams: Team[]
  onClose: () => void
  onCreated: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    roles: new Set<Role>(),
    team_id: '',
  })
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null)

  function toggleRole(r: Role) {
    setForm((f) => {
      const next = new Set(f.roles)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return { ...f, roles: next }
    })
  }

  function submit() {
    if (!form.email.trim() || !form.full_name.trim() || form.roles.size === 0) {
      toast.error('Email, nombre y al menos un rol son obligatorios')
      return
    }
    startTransition(async () => {
      const res = await createMember({
        email: form.email,
        full_name: form.full_name,
        phone: form.phone,
        roles: Array.from(form.roles),
        team_id: form.team_id || null,
      })
      if (res.success) {
        toast.success('Miembro creado y email enviado')
        setLastTempPassword(res.tempPassword ?? null)
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h3 className="font-semibold">Añadir miembro</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Se creará el usuario, se asignarán los roles y se enviará un email con su contraseña temporal.
          </p>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {lastTempPassword ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-green-900">Miembro creado ✓</p>
              <p className="text-xs text-green-800">Contraseña temporal (ya enviada por email):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white px-3 py-2 rounded border text-sm">{lastTempPassword}</code>
                <button
                  onClick={() => { navigator.clipboard?.writeText(lastTempPassword); toast.success('Copiado') }}
                  className="btn-ghost"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <button onClick={onCreated} className="btn-primary w-full mt-2">Cerrar</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nombre completo *</label>
                  <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="label">Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input w-full" />
                </div>
              </div>

              <div>
                <label className="label">Roles * (uno o varios)</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <input type="checkbox" checked={form.roles.has(r)} onChange={() => toggleRole(r)} />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Equipo asignado (opcional)</label>
                <select value={form.team_id} onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))} className="input w-full">
                  <option value="">— Ninguno —</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
        {!lastTempPassword && (
          <div className="p-4 border-t flex justify-end gap-2">
            <button onClick={onClose} disabled={isPending} className="btn-ghost">Cancelar</button>
            <button onClick={submit} disabled={isPending} className="btn-primary">
              {isPending ? 'Creando…' : 'Crear y enviar acceso'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EditMemberModal({
  member,
  teams,
  onClose,
  onSaved,
}: {
  member: Member
  teams: Team[]
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    full_name: member.full_name,
    email: member.email ?? '',
    phone: member.phone ?? '',
    roles: new Set<Role>(member.club_member_roles.map((r) => r.role)),
    team_id: member.club_member_roles.find((r) => r.team_id)?.team_id ?? '',
  })

  function toggleRole(r: Role) {
    setForm((f) => {
      const next = new Set(f.roles)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return { ...f, roles: next }
    })
  }

  function save() {
    startTransition(async () => {
      const profilePatch: { full_name?: string; phone?: string | null; email?: string } = {}
      if (form.full_name !== member.full_name) profilePatch.full_name = form.full_name
      if (form.phone !== (member.phone ?? '')) profilePatch.phone = form.phone || null
      if (form.email !== (member.email ?? '')) profilePatch.email = form.email

      if (Object.keys(profilePatch).length > 0) {
        const r1 = await updateMemberProfile(member.id, profilePatch)
        if (!r1.success) { toast.error(r1.error ?? 'Error'); return }
      }

      const r2 = await updateMemberRoles(member.id, Array.from(form.roles), form.team_id || null)
      if (r2.success) {
        toast.success('Miembro actualizado')
        onSaved()
      } else toast.error(r2.error ?? 'Error')
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h3 className="font-semibold">Editar miembro</h3>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre completo</label>
              <input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="label">Roles</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm p-2 rounded border cursor-pointer hover:bg-muted/50">
                  <input type="checkbox" checked={form.roles.has(r)} onChange={() => toggleRole(r)} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Equipo asignado</label>
            <select value={form.team_id} onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))} className="input w-full">
              <option value="">— Ninguno —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} disabled={isPending} className="btn-ghost">Cancelar</button>
          <button onClick={save} disabled={isPending} className="btn-primary">{isPending ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
