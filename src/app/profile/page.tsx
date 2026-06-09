import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  const user = session.user

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return <ProfileClient userId={user.id} initialProfile={profile} />
}
