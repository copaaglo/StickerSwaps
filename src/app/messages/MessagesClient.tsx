'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile, Message } from '@/types'
import { timeAgo, cn } from '@/lib/utils'
import { LIMITS } from '@/lib/validate'
import { Send, MessageCircle, ArrowLeft } from 'lucide-react'

interface Conversation {
  partner: Profile
  lastMessage: Message
  unread: number
}

interface Props {
  currentUserId: string
  currentUserProfile: Profile | null
  conversations: Conversation[]
  initialWithUserId: string | null
  initialWithProfile: Profile | null
}

export function MessagesClient({ currentUserId, currentUserProfile, conversations, initialWithUserId, initialWithProfile }: Props) {
  const supabase = createClient()
  const [convos, setConvos] = useState(conversations)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(initialWithUserId)
  const [activePartner, setActivePartner] = useState<Profile | null>(initialWithProfile)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (partnerId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)

    // Mark as read
    await supabase.from('messages')
      .update({ read: true })
      .eq('sender_id', partnerId)
      .eq('receiver_id', currentUserId)
      .eq('read', false)
  }, [supabase, currentUserId])

  useEffect(() => {
    if (activePartnerId) {
      loadMessages(activePartnerId)
    }
  }, [activePartnerId, loadMessages])

  // Realtime subscription
  useEffect(() => {
    if (!activePartnerId) return
    const channel = supabase
      .channel(`messages:${currentUserId}:${activePartnerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`,
      }, payload => {
        const msg = payload.new as Message
        if (msg.sender_id === activePartnerId) {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, currentUserId, activePartnerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function selectPartner(partnerId: string, partnerProfile: Profile) {
    setActivePartnerId(partnerId)
    setActivePartner(partnerProfile)
    setMessages([])
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const content = newMsg.trim()
    if (!content || !activePartnerId || sending) return
    if (content.length > LIMITS.chatMessage) return
    setSending(true)
    setNewMsg('')

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: activePartnerId,
      content,
      trade_id: null,
      read: false,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    const { data } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: activePartnerId,
      content,
    }).select().single()

    if (data) {
      setMessages(prev => prev.map(m => m.id === optimistic.id ? data : m))
    }
    setSending(false)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar */}
      <div className={cn(
        'w-80 shrink-0 card overflow-hidden flex flex-col',
        activePartnerId ? 'hidden md:flex' : 'flex w-full md:w-80'
      )}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 && !initialWithProfile ? (
            <div className="p-6 text-center text-gray-400">
              <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Post in the community feed to connect with traders!</p>
            </div>
          ) : (
            <>
              {/* If starting new convo via ?with= that isn't in convos */}
              {initialWithProfile && !convos.find(c => c.partner.id === initialWithProfile.id) && (
                <button
                  onClick={() => selectPartner(initialWithProfile.id, initialWithProfile)}
                  className={cn(
                    'w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50',
                    activePartnerId === initialWithProfile.id ? 'bg-emerald-50' : ''
                  )}
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold shrink-0">
                    {(initialWithProfile.full_name ?? initialWithProfile.username)?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm truncate">
                      {initialWithProfile.full_name ?? initialWithProfile.username}
                    </div>
                    <div className="text-xs text-gray-400 truncate">New conversation</div>
                  </div>
                </button>
              )}
              {convos.map(({ partner, lastMessage, unread }) => (
                <button
                  key={partner.id}
                  onClick={() => selectPartner(partner.id, partner)}
                  className={cn(
                    'w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50',
                    activePartnerId === partner.id ? 'bg-emerald-50' : ''
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                      {(partner.full_name ?? partner.username)?.[0]?.toUpperCase()}
                    </div>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-medium text-sm truncate', unread > 0 ? 'text-gray-900' : 'text-gray-700')}>
                        {partner.full_name ?? partner.username}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{timeAgo(lastMessage.created_at)}</span>
                    </div>
                    <div className={cn('text-xs truncate mt-0.5', unread > 0 ? 'text-gray-600 font-medium' : 'text-gray-400')}>
                      {lastMessage.sender_id === currentUserId ? 'You: ' : ''}{lastMessage.content}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Chat pane */}
      {activePartnerId && activePartner ? (
        <div className="flex-1 card overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <button
              onClick={() => { setActivePartnerId(null); setActivePartner(null) }}
              className="md:hidden p-1 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
              {(activePartner.full_name ?? activePartner.username)?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{activePartner.full_name ?? activePartner.username}</div>
              <div className="text-xs text-gray-400">@{activePartner.username}</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="text-center text-gray-400 text-sm pt-8">Loading…</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm pt-8">
                <p>Say hi to start trading!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                      isMe
                        ? 'bg-emerald-500 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    )}>
                      <p>{msg.content}</p>
                      <p className={cn('text-xs mt-1', isMe ? 'text-emerald-200' : 'text-gray-400')}>
                        {timeAgo(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 flex gap-3">
            <input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder="Type a message…"
              maxLength={LIMITS.chatMessage}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={!newMsg.trim() || sending}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center gap-2"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 card hidden md:flex items-center justify-center text-gray-400">
          <div className="text-center">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-medium">Select a conversation</p>
            <p className="text-sm mt-1">or post in the community feed to find traders</p>
          </div>
        </div>
      )}
    </div>
  )
}
