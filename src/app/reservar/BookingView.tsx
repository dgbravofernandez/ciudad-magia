'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Calendar as CalIcon, Phone } from 'lucide-react'
import { CluberlyMark } from '@/components/brand/CluberlyMark'
import { bookDemoPublic, requestCallbackPublic } from './actions'

interface Props {
  occupiedSlots: string[]    // ISO strings
  clubName: string | null
  marketingClubId: string | null
}

const SLOTS = ['14:30', '15:00', '15:30', '16:00']

function nextWeekdays(n: number): Date[] {
  const out: Date[] = []
  const cur = new Date()
  cur.setHours(0, 0, 0, 0)
  while (out.length < n) {
    cur.setDate(cur.getDate() + 1)
    if (cur.getDay() !== 0 && cur.getDay() !== 6) out.push(new Date(cur))
  }
  return out
}

type Mode = 'callback' | 'slot'

export function BookingView({ occupiedSlots, clubName, marketingClubId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [mode, setMode] = useState<Mode>('callback')
  const [form, setForm] = useState({
    clubName: clubName ?? '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    preferredTime: '',
    notes: '',
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

  const days = useMemo(() => nextWeekdays(10), [])
  const occupiedSet = useMemo(() => {
    const set = new Set<string>()
    for (const iso of occupiedSlots) {
      const d = new Date(iso)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      set.add(key)
    }
    return set
  }, [occupiedSlots])

  function isOccupied(day: Date, slot: string): boolean {
    const [h, m] = slot.split(':').map(Number)
    return occupiedSet.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${h}:${String(m).padStart(2, '0')}`)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (mode === 'callback') {
      if (!form.clubName || !form.contactName || !form.contactEmail) return toast.error('Faltan datos')
      if (!form.preferredTime.trim()) return toast.error('Dime cuándo te viene mejor')
      startTransition(async () => {
        const res = await requestCallbackPublic({
          marketingClubId,
          clubName: form.clubName,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          preferredTime: form.preferredTime,
          notes: form.notes,
        })
        if (res.success) setDone(true)
        else toast.error(res.error ?? 'Error')
      })
      return
    }

    // mode === 'slot'
    if (!selectedDate || !selectedTime) return toast.error('Elige día y hora')
    const [h, m] = selectedTime.split(':').map(Number)
    const when = new Date(selectedDate)
    when.setHours(h, m, 0, 0)

    startTransition(async () => {
      const res = await bookDemoPublic({
        marketingClubId,
        clubName: form.clubName,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        scheduledAt: when.toISOString(),
        notes: form.notes,
      })
      if (res.success) {
        setDone(true)
      } else {
        toast.error(res.error ?? 'Error')
      }
    })
  }

  if (done) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
        background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
      }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '2.5rem', maxWidth: 480, textAlign: 'center', boxShadow: '0 10px 40px rgba(236,72,153,0.15)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#EC4899,#BE185D)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={32} color="#fff" />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.75rem', color: '#0F172A' }}>
            {mode === 'callback' ? '¡Hecho! Te contacto yo' : '¡Reserva confirmada!'}
          </h1>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>
            {mode === 'callback' ? (
              <>Te he enviado un email a <strong style={{ color: '#0F172A' }}>{form.contactEmail}</strong>. Te escribo o te llamo cuando me has dicho que te viene bien.</>
            ) : (
              <>Te he enviado un email de confirmación a <strong style={{ color: '#0F172A' }}>{form.contactEmail}</strong>. Te llamaré a la hora reservada.</>
            )}
          </p>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            Si necesitas cambiar algo, responde a ese email y lo arreglamos.
          </p>
        </div>
      </div>
    )
  }

  const inputStyle = { padding: '0.625rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.95rem', outline: 'none' } as const
  const labelSpan = { fontSize: '0.75rem', fontWeight: 600, color: '#475569' } as const

  const callbackReady = !!(form.clubName && form.contactName && form.contactEmail && form.preferredTime.trim())
  const slotReady = !!(selectedDate && selectedTime && form.clubName && form.contactName && form.contactEmail)
  const canSubmit = mode === 'callback' ? callbackReady : slotReady

  // Bloque de datos de contacto, compartido por ambos modos
  const contactFields = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={labelSpan}>Club *</span>
          <input value={form.clubName} onChange={(e) => setForm({ ...form, clubName: e.target.value })} required
            placeholder="C.D. Ejemplo" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={labelSpan}>Tu nombre *</span>
          <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required
            placeholder="Ana García" style={inputStyle} />
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={labelSpan}>Email *</span>
          <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required
            placeholder="ana@miclub.com" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={labelSpan}>Teléfono <span style={{ fontWeight: 400, color: '#94A3B8' }}>(para llamarte)</span></span>
          <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            placeholder="600 123 456" style={inputStyle} />
        </label>
      </div>
    </>
  )

  return (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <CluberlyMark size={36} />
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#0F172A' }}>cluberly</span>
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 'clamp(1.5rem,4vw,2rem)', marginTop: '1.5rem', marginBottom: '0.5rem', color: '#0F172A', letterSpacing: '-0.02em' }}>
            Te enseño Cluberly en 15 minutos
          </h1>
          <p style={{ color: '#475569', fontSize: '1rem' }}>
            Sobre tu club concreto. Sin guion comercial. Tú me dices cuándo te viene bien y me adapto.
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 20, padding: 'clamp(1.5rem,4vw,2.5rem)', boxShadow: '0 8px 40px rgba(236,72,153,0.12)', border: '1px solid #FBCFE8' }}>
          {/* Selector de modo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem', background: '#F8FAFC', padding: 4, borderRadius: 12 }}>
            {([['callback', '📞 Que me llamen'], ['slot', '🗓 Reservar hueco']] as const).map(([m, label]) => (
              <button type="button" key={m} onClick={() => setMode(m)}
                style={{
                  padding: '0.7rem', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.9rem',
                  background: mode === m ? '#fff' : 'transparent',
                  color: mode === m ? '#BE185D' : '#64748B',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── MODO CALLBACK: dime cuándo y me adapto ── */}
          {mode === 'callback' && (
            <>
              <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.5 }}>
                Déjame tus datos y cuándo te viene mejor. Te escribo o te llamo en ese rato, sin que tengas que cuadrar agendas.
              </p>
              {contactFields}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                <span style={labelSpan}>¿Cuándo te viene mejor? *</span>
                <input value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value })} required
                  placeholder="Ej: mañanas de 10 a 12, o tardes después de las 19h, o el sábado"
                  style={inputStyle} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                <span style={labelSpan}>¿Qué te gustaría que te enseñe? <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></span>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  placeholder="Tenemos 180 jugadores, vamos con Excel..."
                  style={{ ...inputStyle, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }} />
              </label>
              <button type="submit" disabled={!canSubmit || isPending} style={{
                width: '100%', padding: '0.95rem', borderRadius: 10, border: 'none',
                background: canSubmit && !isPending ? 'linear-gradient(135deg,#EC4899,#BE185D)' : '#CBD5E1',
                color: '#fff', fontWeight: 800, fontSize: '1rem',
                cursor: canSubmit && !isPending ? 'pointer' : 'not-allowed',
              }}>
                {isPending ? 'Enviando…' : 'Que me llamen →'}
              </button>
            </>
          )}

          {/* ── MODO SLOT: reservar hueco concreto ── */}
          {mode === 'slot' && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>1 — Elige el día</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {days.map((d) => {
                  const sel = selectedDate && selectedDate.toDateString() === d.toDateString()
                  return (
                    <button type="button" key={d.toISOString()} onClick={() => { setSelectedDate(d); setSelectedTime(null) }}
                      style={{
                        padding: '0.625rem 0.5rem', borderRadius: 10, border: `2px solid ${sel ? '#EC4899' : '#E2E8F0'}`,
                        background: sel ? '#FDF2F8' : '#fff', cursor: 'pointer', textAlign: 'center',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: '0.7rem', color: sel ? '#BE185D' : '#64748B', fontWeight: 600, textTransform: 'capitalize' }}>
                        {d.toLocaleDateString('es-ES', { weekday: 'short' })}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: sel ? '#BE185D' : '#0F172A' }}>
                        {d.getDate()}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: sel ? '#BE185D' : '#94A3B8', textTransform: 'capitalize' }}>
                        {d.toLocaleDateString('es-ES', { month: 'short' })}
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedDate && (
                <>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>2 — Elige la hora <span style={{ fontWeight: 400, fontSize: '0.8rem', color: '#94A3B8' }}>(tardes L-V)</span></h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {SLOTS.map((slot) => {
                      const occ = isOccupied(selectedDate, slot)
                      const sel = selectedTime === slot
                      return (
                        <button type="button" key={slot} disabled={occ} onClick={() => setSelectedTime(slot)}
                          style={{
                            padding: '0.75rem', borderRadius: 10, fontSize: '0.95rem', fontWeight: 700,
                            border: `2px solid ${sel ? '#EC4899' : '#E2E8F0'}`,
                            background: occ ? '#F1F5F9' : sel ? '#EC4899' : '#fff',
                            color: occ ? '#94A3B8' : sel ? '#fff' : '#0F172A',
                            cursor: occ ? 'not-allowed' : 'pointer',
                            textDecoration: occ ? 'line-through' : 'none',
                          }}>
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
                    ¿No te encaja ninguna? <button type="button" onClick={() => setMode('callback')} style={{ background: 'none', border: 'none', color: '#BE185D', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '0.8rem' }}>Dime tú cuándo y me adapto →</button>
                  </p>
                </>
              )}

              {selectedTime && (
                <>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>3 — Tus datos</h2>
                  {contactFields}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                    <span style={labelSpan}>¿Qué te gustaría que te enseñe? <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></span>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                      placeholder="Tenemos 180 jugadores, vamos con Excel..."
                      style={{ ...inputStyle, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }} />
                  </label>
                  <button type="submit" disabled={!canSubmit || isPending} style={{
                    width: '100%', padding: '0.95rem', borderRadius: 10, border: 'none',
                    background: canSubmit && !isPending ? 'linear-gradient(135deg,#EC4899,#BE185D)' : '#CBD5E1',
                    color: '#fff', fontWeight: 800, fontSize: '1rem',
                    cursor: canSubmit && !isPending ? 'pointer' : 'not-allowed',
                  }}>
                    {isPending ? 'Reservando…' : 'Confirmar reserva →'}
                  </button>
                </>
              )}
            </>
          )}
        </form>

        {/* Trust line */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#64748B' }}>
          <CalIcon size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          Llamada de 15 minutos · Sin compromiso · <Phone size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
          O escríbeme a <a href="tel:+34665676341" style={{ color: '#BE185D', fontWeight: 600 }}>665 676 341</a>
        </div>
      </div>
    </div>
  )
}
