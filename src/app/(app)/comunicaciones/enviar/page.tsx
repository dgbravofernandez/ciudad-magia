import { createAdminClient } from '@/lib/supabase/admin'
import { getClubContext } from '@/lib/supabase/get-club-id'
import { EmailComposer } from '@/features/comunicaciones/components/EmailComposer'
import { Topbar } from '@/components/layout/Topbar'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Enviar Comunicación' }
export const dynamic = 'force-dynamic'

export default async function EnviarPage() {
  const { clubId } = await getClubContext()
  if (!clubId) return <div className="p-6 text-sm">No autenticado</div>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any

  const { data: dbTemplates } = await supabase
    .from('email_templates')
    .select('*')
    .eq('club_id', clubId)
    .order('name')

  // Fallback: si no hay plantillas en DB, usar defaults hardcodeados
  // para que el dropdown nunca aparezca vacío.
  const DEFAULTS = [
    { id: 'default-1', name: 'Bienvenida al club', subject: 'Bienvenido/a a {club_nombre}', body: 'Estimado/a {tutor_nombre},\n\nNos complace comunicarte que {jugador_nombre} ha sido inscrito/a satisfactoriamente en {club_nombre} para la temporada {temporada}.\n\nQuedamos a tu disposición.\n\nUn saludo,\nEl equipo de {club_nombre}' },
    { id: 'default-2', name: 'Recordatorio cuota', subject: 'Recordatorio: cuota mensual pendiente', body: 'Estimado/a {tutor_nombre},\n\nTe recordamos que la cuota mensual de {jugador_nombre} correspondiente a {mes} está pendiente de pago.\n\nImporte: {importe} €\n\nPuedes realizar el pago mediante transferencia bancaria o en efectivo.\n\nGracias por tu colaboración.\n\nUn saludo,\n{club_nombre}' },
    { id: 'default-3', name: 'Carta de prueba', subject: 'Autorización para prueba en {club_nombre}', body: 'Estimado/a {tutor_nombre},\n\nPor medio de la presente, comunicamos que {jugador_nombre}, con fecha de nacimiento {fecha_nacimiento}, queda autorizado/a para realizar una prueba de evaluación en {club_nombre}.\n\nLa prueba tendrá lugar el día {fecha_prueba} en nuestras instalaciones.\n\nAtentamente,\n{director_nombre}\nDirector Deportivo\n{club_nombre}' },
    { id: 'default-4', name: 'Convocatoria partido', subject: 'Convocatoria: {equipo} - {fecha_partido}', body: 'Estimado/a {tutor_nombre},\n\n{jugador_nombre} está convocado/a para el partido del {fecha_partido} a las {hora} en {lugar}.\n\nPor favor, confirma asistencia respondiendo a este correo.\n\nUn saludo,\n{entrenador_nombre}' },
  ]
  const templates = (dbTemplates && dbTemplates.length > 0) ? dbTemplates : DEFAULTS

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, categories(name)')
    .eq('club_id', clubId)
    .eq('active', true)
    .order('name')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('club_id', clubId)
    .order('name')

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, tutor_name, tutor_email')
    .eq('club_id', clubId)
    .neq('status', 'low')
    .order('last_name')

  // Count players for estimation
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'active')

  const { count: pendingPlayers } = await supabase
    .from('quota_payments')
    .select('player_id', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'pending')

  return (
    <div className="flex flex-col h-full">
      <Topbar title="Enviar Comunicación" />
      <div className="flex-1 p-6">
        <EmailComposer
          clubId={clubId}
          templates={((templates ?? []) as never[]).map((t: never) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tpl = t as any
          return { ...tpl, body: tpl.body_html ?? tpl.body ?? '' }
        }) as never}
          teams={(teams ?? []) as never}
          categories={(categories ?? []) as never}
          players={(players ?? []) as never}
          totalPlayers={totalPlayers ?? 0}
          pendingPlayersCount={pendingPlayers ?? 0}
        />
      </div>
    </div>
  )
}
