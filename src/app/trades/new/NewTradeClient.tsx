'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, UserSticker } from '@/types'
import { cn } from '@/lib/utils'
import { LIMITS } from '@/lib/validate'
import { ArrowLeftRight, Check, X } from 'lucide-react'

interface Props {
  proposerId: string
  receiver: Profile
  myDuplicates: (UserSticker & { sticker: any })[]
  theirDuplicates: (UserSticker & { sticker: any })[]
}

export function NewTradeClient({ proposerId, receiver, myDuplicates, theirDuplicates }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [giving, setGiving] = useState<Set<number>>(new Set())
  const [receiving, setReceiving] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: number, set: Set<number>, setter: (s: Set<number>) => void, limit: number) {
    if (!set.has(id) && set.size >= limit) {
      setError(`You can select at most ${limit} stickers per side`)
      return
    }
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
    setError('')
  }

  async function submitTrade() {
    if (giving.size === 0 && receiving.size === 0) {
      setError('Select at least one sticker to give or receive')
      return
    }
    const trimmedMessage = message.trim().slice(0, LIMITS.tradeMessage)
    setSubmitting(true)
    setError('')

    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({ proposer_id: proposerId, receiver_id: receiver.id, message: trimmedMessage || null })
      .select()
      .single()

    if (tradeError || !trade) {
      setError('Failed to create trade. Please try again.')
      setSubmitting(false)
      return
    }

    const stickers = [
      ...Array.from(giving).map(id => ({ trade_id: trade.id, sticker_id: id, direction: 'giving' })),
      ...Array.from(receiving).map(id => ({ trade_id: trade.id, sticker_id: id, direction: 'receiving' })),
    ]

    await supabase.from('trade_stickers').insert(stickers)

    // Send auto message
    await supabase.from('messages').insert({
      sender_id: proposerId,
      receiver_id: receiver.id,
      content: `I've sent you a trade offer! ${trimmedMessage ? `"${trimmedMessage}"` : ''} Check your trades.`,
      trade_id: trade.id,
    })

    router.push('/trades')
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Propose a trade</h1>
        <p className="text-gray-500 text-sm mt-1">
          with <strong>{receiver.full_name ?? receiver.username}</strong>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* What you give */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">G</span>
            You give
          </h2>
          <p className="text-xs text-gray-400 mb-4">Your duplicates available for trade</p>
          {myDuplicates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No duplicates yet. Add them in Collection.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
              {myDuplicates.map(us => (
                <button
                  key={us.sticker_id}
                  onClick={() => toggle(us.sticker_id, giving, setGiving, LIMITS.maxStickersPerSide)}
                  className={cn(
                    'p-2 rounded-xl border text-left transition-all text-xs',
                    giving.has(us.sticker_id)
                      ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-300'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="font-mono font-bold text-gray-600 mb-1">{us.sticker?.sticker_code}</div>
                  <div className="text-gray-800 truncate leading-tight">{us.sticker?.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">×{us.quantity_duplicate}</div>
                  {giving.has(us.sticker_id) && (
                    <div className="mt-1 flex items-center gap-1 text-blue-600">
                      <Check size={10} /> Selected
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {giving.size > 0 && (
            <p className="mt-3 text-sm font-medium text-blue-600">{giving.size} sticker{giving.size !== 1 ? 's' : ''} selected to give</p>
          )}
        </div>

        {/* What you receive */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">R</span>
            You receive
          </h2>
          <p className="text-xs text-gray-400 mb-4">{receiver.full_name ?? receiver.username}&apos;s duplicates</p>
          {theirDuplicates.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              They have no duplicates listed yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
              {theirDuplicates.map(us => (
                <button
                  key={us.sticker_id}
                  onClick={() => toggle(us.sticker_id, receiving, setReceiving, LIMITS.maxStickersPerSide)}
                  className={cn(
                    'p-2 rounded-xl border text-left transition-all text-xs',
                    receiving.has(us.sticker_id)
                      ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  )}
                >
                  <div className="font-mono font-bold text-gray-600 mb-1">{us.sticker?.sticker_code}</div>
                  <div className="text-gray-800 truncate leading-tight">{us.sticker?.name}</div>
                  <div className="text-gray-400 text-xs mt-0.5">×{us.quantity_duplicate}</div>
                  {receiving.has(us.sticker_id) && (
                    <div className="mt-1 flex items-center gap-1 text-emerald-600">
                      <Check size={10} /> Selected
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
          {receiving.size > 0 && (
            <p className="mt-3 text-sm font-medium text-emerald-600">{receiving.size} sticker{receiving.size !== 1 ? 's' : ''} selected to receive</p>
          )}
        </div>
      </div>

      {/* Trade summary */}
      {(giving.size > 0 || receiving.size > 0) && (
        <div className="card p-4 bg-gray-50 flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-blue-600">{giving.size}</p>
            <p className="text-xs text-gray-500">giving</p>
          </div>
          <ArrowLeftRight size={20} className="text-gray-400" />
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-emerald-600">{receiving.size}</p>
            <p className="text-xs text-gray-500">receiving</p>
          </div>
        </div>
      )}

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Add a message (optional)</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Hey! I'd love to trade these stickers with you. Can we meet at..."
          rows={3}
          maxLength={LIMITS.tradeMessage}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/{LIMITS.tradeMessage}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={submitTrade}
          disabled={submitting || (giving.size === 0 && receiving.size === 0)}
          className="flex-1 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending…
            </>
          ) : (
            <>
              <ArrowLeftRight size={16} />
              Send trade offer
            </>
          )}
        </button>
      </div>
    </div>
  )
}
