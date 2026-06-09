import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MessagesClient } from './MessagesClient'

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const params = await searchParams
  const withUserId = params.with

  // Get all conversations (unique partners)
  const [sentRes, receivedRes, profileRes] = await Promise.all([
    supabase.from('messages').select('*, receiver:profiles!messages_receiver_id_fkey(*)').eq('sender_id', user.id).order('created_at', { ascending: false }),
    supabase.from('messages').select('*, sender:profiles!messages_sender_id_fkey(*)').eq('receiver_id', user.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  // If ?with= param, load that profile
  let withProfile = null
  if (withUserId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', withUserId).single()
    withProfile = data
  }

  // Build conversation list from sent + received
  const allMessages = [
    ...(sentRes.data ?? []).map((m: any) => ({ ...m, partner: m.receiver })),
    ...(receivedRes.data ?? []).map((m: any) => ({ ...m, partner: m.sender })),
  ]

  const conversationMap = new Map<string, any>()
  for (const msg of allMessages) {
    const partnerId = msg.partner?.id
    if (!partnerId) continue
    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, { partner: msg.partner, lastMessage: msg, unread: 0 })
    }
    if (msg.receiver_id === user.id && !msg.read) {
      conversationMap.get(partnerId).unread++
    }
  }

  const conversations = Array.from(conversationMap.values())
    .sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime())

  return (
    <MessagesClient
      currentUserId={user.id}
      currentUserProfile={profileRes.data}
      conversations={conversations}
      initialWithUserId={withUserId ?? null}
      initialWithProfile={withProfile}
    />
  )
}
