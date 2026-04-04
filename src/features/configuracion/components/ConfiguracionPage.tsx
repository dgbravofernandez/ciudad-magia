'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Users, DollarSign, Calendar, UserCog, Mail, Trophy, Shirt,
  Settings, Package, Shield, Save, ChevronRight
} from 'lucide-react'

const MODULOS = [
  { key: 'jugadores', label: 'Jugadores', desc: 'Gestión de plantilla, inscripciones y fichajes', icon: Users },
  { key: 'contabilidad', label: 'Contabilidad', desc: 'Cuotas, gastos, caja registradora', icon: DollarSign },
  { key: 'entrenadores', label: 'Entrenadores', desc: 'Sesiones, ejercicios, pizarra táctica, partidos', icon: Calendar },
  { key: 'personal', label: 'Personal del club', desc: 'Fisio, infancia, redes sociales, dirección', icon: UserCog },
  { key: 'comunicaciones', label: 'Comunicaciones', desc: 'Email masivo, plantillas, historial', icon: Mail },
  { key: 'torneos', label: 'Torneos', desc: 'Grupos, brackets, clasificaciones', icon: Trophy },
  { key: 'ropa', label: 'Ropa', desc: 'Pedidos de equipación y tallas', icon: Shirt },
]

const ROLES_LABELS: Record<string, string> = {
  admin: 'Admin', direccion: 'Dirección', director_deportivo: 'Dir. Deportivo',
  coordinador: 'Coordinador', entrenador: 'Entrenador', fisio: 'Fisio',
  infancia: 'Infancia', redes: 'Redes Sociales',
}

interface Props {
  settings: Record<string, unknown> | null
  members: Array<{ id: string; full_name: string; email: string; club_member_roles: Array<{ role: string }> }>
  clubId: string
}

export function ConfiguracionPage({ settings, members, clubId }: Props) {
  const [tab, setTab] = useState<'general' | 'modulos' | 'usuarios'>('general')
  const [primaryColor, setPrimaryColor] = useState((settings?.primary_color as string) ?? '#3b82f6')
  const [siblingDiscount, setSiblingDiscount] = useState((settings?.sibling_discount_enabled as boolean) ?? false)
  const [siblingPercent, setSiblingPercent] = useState((settings?.sibling_discount_percent as number) ?? 40)
  const [modules, setModules] = useState<Record<string, boolean>>(
    (settings?.enabled_modules as Record<string, boolean>) ??
    Object.fromEntries(MODULOS.map(m => [m.key, true]))
  )

  const tabs = [
    { key: 'general', label: 'Ajustes generales', icon: Settings },
    { key: 'modulos', label: 'Módulos', icon: Package },
    { key: 'usuarios', label: 'Usuarios y roles', icon: Shield },
  ] as const

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">Gestiona los ajustes del club</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color principal del club</label>
            <div className="flex items-center gap-3">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer p-1" />
              <span className="text-sm text-gray-500 font-mono">{primaryColor}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Descuento 2º hermano</label>
              <button onClick={() => setSiblingDiscount(v => !v)} className={`relative w-11 h-6 rounded-full transition-colors ${siblingDiscount ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${siblingDiscount ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            {siblingDiscount && (
              <div className="flex items-center gap-2">
                <input type="number" value={siblingPercent} onChange={e => setSiblingPercent(Number(e.target.value))} min={0} max={100} className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                <span className="text-sm text-gray-500">% de descuento sobre la cuota menor</span>
              </div>
            )}
          </div>
          <button onClick={() => toast.success('Ajustes guardados')} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Save className="w-4 h-4" /> Guardar cambios
          </button>
        </div>
      )}

      {tab === 'modulos' && (
        <div className="grid gap-3 max-w-2xl">
          {MODULOS.map(m => (
            <div key={m.key} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                <m.icon className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{m.label}</p>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </div>
              <button onClick={() => setModules(v => ({ ...v, [m.key]: !v[m.key] }))} className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${modules[m.key] ? 'bg-blue-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${modules[m.key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
          <button onClick={() => toast.success('Módulos actualizados')} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium w-fit" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Save className="w-4 h-4" /> Guardar
          </button>
        </div>
      )}

      {tab === 'usuarios' && (
        <div className="bg-white rounded-xl border border-gray-200 max-w-3xl">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <p className="font-medium text-gray-900">{members.length} miembros</p>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700">
              <Users className="w-3.5 h-3.5" /> Invitar usuario
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {members.map(m => {
              const initials = m.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() ?? '?'
              return (
                <div key={m.id} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{m.full_name}</p>
                    <p className="text-xs text-gray-500">{m.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.club_member_roles?.map((r: { role: string }) => (
                      <span key={r.role} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{ROLES_LABELS[r.role] ?? r.role}</span>
                    ))}
                  </div>
                  <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
