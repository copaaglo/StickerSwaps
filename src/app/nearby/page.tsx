import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NearbyClient } from './NearbyClient'

export default async function NearbyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [profileRes, allProfilesRes, userStickersRes, allUserStickersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('*').neq('id', user.id).not('location_lat', 'is', null).limit(500),
    supabase.from('user_stickers').select('sticker_id, wants').eq('user_id', user.id).limit(1000),
    supabase.from('user_stickers').select('user_id, sticker_id, quantity_duplicate, wants').neq('user_id', user.id).limit(5000),
  ])

  return (
    <NearbyClient
      currentUserId={user.id}
      myProfile={profileRes.data}
      otherProfiles={allProfilesRes.data ?? []}
      myStickers={userStickersRes.data ?? []}
      otherStickers={allUserStickersRes.data ?? []}
    />
  )
}
