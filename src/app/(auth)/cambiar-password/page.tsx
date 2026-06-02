import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChangePasswordForm } from '@/features/configuracion/components/ChangePasswordForm'
import { getMustChangePassword } from '@/features/configuracion/actions/account.actions'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cambiar contraseña' }
export const dynamic = 'force-dynamic'


export default async function CambiarPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const forced = await getMustChangePassword()

  return <ChangePasswordForm forced={forced} />
}
