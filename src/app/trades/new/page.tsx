import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isValidUUID } from '@/lib/validate'
import { NewTradeClient } from './NewTradeClient'

export default async function NewTradePage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  const user = session.user

  const params = await searchParams
  const withUserId = params.with
  if (!withUserId || !isValidUUID(withUserId)) redirect('/nearby')

  const [receiverRes, myStickersRes, theirStickersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', withUserId).single(),
    supabase.from('user_stickers').select('*, sticker:stickers(*)').eq('user_id', user.id).gt('quantity_duplicate', 0).limit(200),
    supabase.from('user_stickers').select('*, sticker:stickers(*)').eq('user_id', withUserId).gt('quantity_duplicate', 0).limit(200),
  ])

  if (!receiverRes.data) redirect('/nearby')

  return (
    <NewTradeClient
      proposerId={user.id}
      receiver={receiverRes.data}
      myDuplicates={myStickersRes.data ?? []}
      theirDuplicates={theirStickersRes.data ?? []}
    />
  )
}
