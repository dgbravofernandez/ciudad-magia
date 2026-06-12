'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, Plus, Phone, Video, MapPin, Check, X, AlertCircle, TrendingUp } from 'lucide-react'
import { scheduleDemo, updateDemoStatus, cancelDemo } from '../actions/demos.actions'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any

interface Props {
  upcoming: AnyObj[]
  past: AnyObj[]
  weekDemos: AnyObj[]
  weekStart: string
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-900/40 text-blue-300',
  done: 'bg-slate-700 text-slate-300',
  no_show: 'bg-amber-900/40 text-amber-300',
  canceled: 'bg-slate-800 text-slate-500',
  converted: 'bg-emerald-900/40 text-emerald-300',
}
const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Pendiente',
  done: 'Realizada',
  no_show: 'No vino',
  canceled: 'Cancelada',
  converted: '🎉 Cliente',
}

export function DemosView({ upcoming, past, weekDemos, weekStart }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    date: '',
    time: '14:30',
    durationMin: 30,
    channel: 'call' as 'call' | 'video' | 'presencial',
    notes: '',
  })

  function handleSchedule() {
    if (!form.contactName || !form.date || !form.time) {
      return toast.error('Faltan datos: nombre, fecha y hora')
    }
    // Build local Madrid datetime and convert to ISO
    const [h, m] = form.time.split(':').map(Number)
    const local = new Date(`${form.date}T00:00:00`)
    local.setHours(h, m, 0, 0)

    startTransition(async () => {
      const res = await scheduleDemo({
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        scheduledAt: local.toISOString(),
        durationMin: form.durationMin,
        channel: form.channel,
        notes: form.notes,
      })
      if (res.success) {
        toast.success('Demo agendada')
        setShowModal(false)
        setForm({ ...form, contactName: '', contactEmail: '', contactPhone: '', date: '', notes: '' })
        router.refresh()
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  function handleStatusChange(demoId: string, status: 'done' | 'no_show' | 'converted') {
    startTransition(async () => {
      const res = await updateDemoStatus(demoId, status)
      if (res.success) { toast.success('Actualizada'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  function handleCancel(demoId: string) {
    if (!confirm('¿Cancelar esta demo?')) return
    startTransition(async () => {
      const res = await cancelDemo(demoId)
      if (res.success) { toast.success('Cancelada'); router.refresh() }
      else toast.error(res.error ?? 'Error')
    })
  }

  // Calendario semanal — 5 columnas (L-V) x slots de 30min (14:30, 15:00, 15:30, 16:00)
  const startWeek = new Date(weekStart)
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(startWeek)
    d.setDate(startWeek.getDate() + i)
    return d
  })
  const slots = ['14:30', '15:00', '15:30', '16:00']

  function findDemoFor(day: Date, slot: string): AnyObj | undefined {
    const [h, m] = slot.split(':').map(Number)
    return weekDemos.find((d) => {
      const dt = new Date(d.scheduled_at)
      return (
        dt.getFullYear() === day.getFullYear() &&
        dt.getMonth() === day.getMonth() &&
        dt.getDate() === day.getDate() &&
        dt.getHours() === h &&
        dt.getMinutes() === m
      )
    })
  }

  const stats = {
    upcoming: upcoming.filter((d) => d.status === 'scheduled').length,
    done: past.filter((d) => d.status === 'done').length,
    converted: past.filter((d) => d.status === 'converted').length,
    no_show: past.filter((d) => d.status === 'no_show').length,
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Demos agendadas</h1>
          <p className="text-sm text-slate-400 mt-1">Tu agenda comercial: L-V 14:30-16:30 Madrid</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 text-sm font-bold">
          <Plus className="w-4 h-4" /> Agendar demo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-blue-400" /><span className="text-xs text-slate-400">Próximas</span></div>
          <p className="text-2xl font-bold text-blue-300">{stats.upcoming}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><Check className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-400">Realizadas</span></div>
          <p className="text-2xl font-bold text-slate-300">{stats.done}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-400" /><span className="text-xs text-slate-400">Convertidas</span></div>
          <p className="text-2xl font-bold text-emerald-300">{stats.converted}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1"><AlertCircle className="w-4 h-4 text-amber-400" /><span className="text-xs text-slate-400">No vinieron</span></div>
          <p className="text-2xl font-bold text-amber-300">{stats.no_show}</p>
        </div>
      </div>

      {/* Calendario semanal */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Esta semana — vista calendario</h2>
        <div className="grid grid-cols-6 gap-2 text-xs">
          <div></div>
          {days.map((d) => (
            <div key={d.toISOString()} className="text-center text-slate-400 py-2 capitalize">
              {d.toLocaleDateString('es-ES', { weekday: 'short' })} {d.getDate()}
            </div>
          ))}
          {slots.map((slot) => (
            <>
              <div key={slot} className="text-slate-500 py-2 text-right pr-2">{slot}</div>
              {days.map((d) => {
                const demo = findDemoFor(d, slot)
                return (
                  <div key={`${slot}-${d.toISOString()}`}
                    className={`border rounded p-1.5 min-h-[44px] text-xs ${demo ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200' : 'bg-slate-800/30 border-slate-800 text-slate-600'}`}>
                    {demo && (
                      <>
                        <div className="font-medium truncate">{demo.contact_name}</div>
                        <div className="text-slate-400 truncate">{Array.isArray(demo.marketing_clubs) ? demo.marketing_clubs[0]?.name : demo.marketing_clubs?.name}</div>
                      </>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Próximas demos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3">Próximas demos ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Sin demos agendadas todavía. Cuando un club te responda al email, agéndala aquí.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((d) => {
              const club = Array.isArray(d.marketing_clubs) ? d.marketing_clubs[0] : d.marketing_clubs
              const when = new Date(d.scheduled_at)
              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800">
                  <div className="text-center w-20 shrink-0">
                    <div className="text-xs text-slate-400 capitalize">{when.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div className="text-lg font-mono text-white">{when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium truncate">{d.contact_name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                    </div>
                    {club && <p className="text-xs text-slate-400 truncate">{club.name} · {club.location}</p>}
                    {d.contact_phone && <p className="text-xs text-slate-500 truncate">📞 {d.contact_phone}</p>}
                    {d.notes && <p className="text-xs text-slate-500 mt-1 italic">{d.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.channel === 'call' && <Phone className="w-4 h-4 text-slate-400" />}
                    {d.channel === 'video' && <Video className="w-4 h-4 text-slate-400" />}
                    {d.channel === 'presencial' && <MapPin className="w-4 h-4 text-slate-400" />}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleStatusChange(d.id, 'done')} disabled={isPending}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">Hecha</button>
                    <button onClick={() => handleStatusChange(d.id, 'converted')} disabled={isPending}
                      className="px-2 py-1 text-xs bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded">Cliente</button>
                    <button onClick={() => handleCancel(d.id)} disabled={isPending}
                      className="p-1 hover:bg-red-900/40 text-slate-400 hover:text-red-300 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Histórico */}
      {past.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3">Histórico ({past.length})</h2>
          <div className="space-y-1">
            {past.map((d) => {
              const club = Array.isArray(d.marketing_clubs) ? d.marketing_clubs[0] : d.marketing_clubs
              const when = new Date(d.scheduled_at)
              return (
                <div key={d.id} className="flex items-center gap-3 p-2 text-sm hover:bg-slate-800/30 rounded">
                  <div className="text-xs text-slate-500 w-32 shrink-0">{when.toLocaleDateString('es-ES')} {when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white">{d.contact_name}</span>
                    {club && <span className="text-slate-500 ml-2">· {club.name}</span>}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[d.status]}`}>{STATUS_LABELS[d.status]}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal agendar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg mb-4">Nueva demo</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre del contacto *</label>
                <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" placeholder="Pepe Coordinador" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
                  <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fecha (L-V)</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hora (14:30-16:30)</label>
                  <select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm">
                    <option value="14:30">14:30</option>
                    <option value="15:00">15:00</option>
                    <option value="15:30">15:30</option>
                    <option value="16:00">16:00</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Duración (min)</label>
                  <input type="number" min={15} max={120} value={form.durationMin}
                    onChange={(e) => setForm({ ...form, durationMin: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Canal</label>
                  <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as 'call' | 'video' | 'presencial' })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm">
                    <option value="call">Llamada</option>
                    <option value="video">Videollamada</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notas</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" placeholder="Qué dijo en el email, qué quiere ver..." />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setShowModal(false)} className="px-3 py-2 text-sm text-slate-400 hover:text-white">Cancelar</button>
              <button onClick={handleSchedule} disabled={isPending}
                className="px-4 py-2 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 text-sm font-bold disabled:opacity-50">
                Agendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
