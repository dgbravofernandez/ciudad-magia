'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, X, Check, Heart } from 'lucide-react'
import { submitReferrals } from './actions'

interface Props {
  referrerName: string | null
  referrerClubId: string | null
}

interface ReferralRow {
  clubName: string
  contactEmail: string
  contactPhone: string
  notes: string
}

const EMPTY_ROW: ReferralRow = { clubName: '', contactEmail: '', contactPhone: '', notes: '' }

export function ReferView({ referrerName: initRefName, referrerClubId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [referrerName, setReferrerName] = useState(initRefName ?? '')
  const [rows, setRows] = useState<ReferralRow[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }])

  function updateRow(i: number, patch: Partial<ReferralRow>) {
    const next = [...rows]
    next[i] = { ...next[i], ...patch }
    setRows(next)
  }
  function addRow() {
    if (rows.length >= 10) return toast.error('Máximo 10 referidos por vez')
    setRows([...rows, { ...EMPTY_ROW }])
  }
  function removeRow(i: number) {
    if (rows.length <= 1) return
    setRows(rows.filter((_, idx) => idx !== i))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!referrerName.trim()) return toast.error('Pon tu nombre')
    const valid = rows.filter(r => r.clubName.trim())
    if (valid.length === 0) return toast.error('Añade al menos un club')

    startTransition(async () => {
      const res = await submitReferrals({
        referrerClubId,
        referrerName,
        referrals: valid,
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
            <Heart size={32} color="#fff" fill="#fff" />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.75rem', color: '#0F172A' }}>¡Gracias de verdad!</h1>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Voy a contactar con esos clubes esta semana. Si alguno se hace cliente, te avisaré.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: '1.5rem' }}>
            Una recomendación tuya vale más que 100 emails fríos. Lo agradezco un montón.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', padding: '2rem 1rem',
      background: 'linear-gradient(160deg,#ffffff 0%,#FDF2F8 100%)',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#EC4899,#BE185D)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800 }}>C</div>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#0F172A' }}>cluberly</span>
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 'clamp(1.5rem,4vw,2rem)', marginTop: '1.5rem', marginBottom: '0.5rem', color: '#0F172A', letterSpacing: '-0.02em' }}>
            ¿Conoces a otros clubes a los que les puede encajar?
          </h1>
          <p style={{ color: '#475569', fontSize: '1rem', maxWidth: 540, margin: '0 auto' }}>
            {initRefName
              ? `Hola ${initRefName}. Una recomendación tuya pesa más que 100 emails fríos. Si te apetece, dime 2 clubes parecidos al tuyo.`
              : `Una recomendación tuya pesa más que 100 emails fríos. Dime 2-3 clubes parecidos al tuyo y los contacto yo.`
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 20, padding: 'clamp(1.5rem,4vw,2.5rem)', boxShadow: '0 8px 40px rgba(236,72,153,0.12)', border: '1px solid #FBCFE8' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Tu nombre *</span>
            <input value={referrerName} onChange={(e) => setReferrerName(e.target.value)} required
              placeholder="Ana García, C.D. Ejemplo"
              style={{ padding: '0.625rem 0.875rem', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: '0.9375rem', outline: 'none' }} />
          </label>

          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0F172A' }}>Clubes que recomiendas</h2>

          {rows.map((row, i) => (
            <div key={i} style={{ background: '#FAFAFA', borderRadius: 12, padding: '1rem', marginBottom: '0.75rem', border: '1px solid #F1F5F9', position: 'relative' }}>
              {rows.length > 1 && (
                <button type="button" onClick={() => removeRow(i)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}
                  aria-label="Quitar">
                  <X size={16} />
                </button>
              )}
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#BE185D', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Club #{i + 1}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input value={row.clubName} onChange={(e) => updateRow(i, { clubName: e.target.value })}
                  placeholder="Nombre del club *"
                  style={{ padding: '0.5rem 0.625rem', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }} />
                <input value={row.contactEmail} onChange={(e) => updateRow(i, { contactEmail: e.target.value })}
                  placeholder="Email contacto (opcional)" type="email"
                  style={{ padding: '0.5rem 0.625rem', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <input value={row.contactPhone} onChange={(e) => updateRow(i, { contactPhone: e.target.value })}
                  placeholder="Teléfono (opcional)" type="tel"
                  style={{ padding: '0.5rem 0.625rem', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }} />
                <input value={row.notes} onChange={(e) => updateRow(i, { notes: e.target.value })}
                  placeholder="Notas (opcional): a quién preguntar, etc."
                  style={{ padding: '0.5rem 0.625rem', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: '0.875rem', outline: 'none' }} />
              </div>
            </div>
          ))}

          <button type="button" onClick={addRow}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#BE185D', background: 'transparent', border: '1px dashed #FBCFE8', borderRadius: 8, padding: '0.5rem 0.875rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: '1.5rem' }}>
            <Plus size={14} /> Añadir otro club
          </button>

          <button type="submit" disabled={isPending} style={{
            width: '100%', padding: '0.95rem', borderRadius: 10, border: 'none',
            background: isPending ? '#CBD5E1' : 'linear-gradient(135deg,#EC4899,#BE185D)',
            color: '#fff', fontWeight: 800, fontSize: '1rem',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}>
            {isPending ? 'Enviando…' : 'Enviar recomendaciones →'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8125rem', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <Check size={14} /> Solo los uso yo. No los compartimos con nadie.
          </p>
        </form>
      </div>
    </div>
  )
}
