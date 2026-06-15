'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Calendar as CalIcon, Phone } from 'lucide-react'
import { CluberlyMark } from '@/components/brand/CluberlyMark'
import { bookDemoPublic } from './actions'

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

export function BookingView({ occupiedSlots, clubName, marketingClubId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    clubName: clubName ?? '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
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
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.75rem', color: '#0F172A' }}>¡Reserva confirmada!</h1>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Te he enviado un email de confirmación a <strong style={{ color: '#0F172A' }}>{form.contactEmail}</strong>. Te llamaré a la hora reservada.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            Si necesitas cambiar el día, responde a ese email y lo arreglamos.
          </p>
        </div>
      </div>
    )
  }

  const canSubmit = selectedDate && selectedTime && form.clubName && form.contactName && form.contactEmail

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
            Reserva 15 minutos conmigo
          </h1>
          <p style={{ color: '#475569', fontSize: '1rem' }}>
            Te enseño Cluberly sobre tu club concreto. Sin guion comercial. Si no te encaja, nos despedimos.
          </p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 20, padding: 'clamp(1.5rem,4vw,2.5rem)', boxShadow: '0 8px 40px rgba(236,72,153,0.12)', border: '1px solid #FBCFE8' }}>
          {/* Selector de día */}
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

          {/* Selector de hora */}
          {selectedDate && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>2 — Elige la hora</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {SLOTS.map((slot) => {
                  const occ = isOccupied(selectedDate, slot)
                  const sel = selectedTime === slot
                  return (
                    <button type="button" key={slot} disabled={occ} onClick={() => setSelectedTime(slot)}
                      style={{
                        padding: '0.75rem', borderRadius: 10, fontSize: '0.95rem', fontWeight: 700,
                        border: `2px solid ${sel ? '#EC4899' : occ ? '#E2E8F0' : '#E2E8F0'}`,
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
            </>
          )}

          {/* Datos */}
          {selectedTime && (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>3 — Tus datos</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Club *</span>
                  <input value={form.clubName} onChange={(e) => setForm({ ...form, clubName: e.target.value })} required
                    placeholder="C.D. Ejemplo"
                    style={{ padding: '0.625rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.95rem', outline: 'none' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Tu nombre *</span>
                  <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required
                    placeholder="Ana García"
                    style={{ padding: '0.625rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.95rem', outline: 'none' }} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Email *</span>
                  <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required
                    placeholder="ana@miclub.com"
                    style={{ padding: '0.625rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.95rem', outline: 'none' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Teléfono <span style={{ fontWeight: 400, color: '#94A3B8' }}>(para llamarte)</span></span>
                  <input type="tel" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="600 123 456"
                    style={{ padding: '0.625rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.95rem', outline: 'none' }} />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>¿Qué te gustaría que te enseñe? <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span></span>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  placeholder="Tenemos 180 jugadores, vamos con Excel..."
                  style={{ padding: '0.625rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
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
