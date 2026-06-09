import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { timeAgo } from '@/lib/utils'
import { ArrowLeftRight, Plus, CheckCircle2, XCircle, Clock, Trophy } from 'lucide-react'

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  accepted: { label: 'Accepted', icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  completed: { label: 'Completed', icon: Trophy, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
}

export default async function TradesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  const user = session.user

  const { data: trades } = await supabase
    .from('trades')
    .select(`
      *,
      proposer:profiles!trades_proposer_id_fkey(*),
      receiver:profiles!trades_receiver_id_fkey(*),
      trade_stickers(*, sticker:stickers(*))
    `)
    .or(`proposer_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(100)

  const pending = trades?.filter(t => t.status === 'pending') ?? []
  const active = trades?.filter(t => t.status === 'accepted') ?? []
  const history = trades?.filter(t => ['completed', 'rejected', 'cancelled'].includes(t.status)) ?? []

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trades</h1>
          <p className="text-gray-500 text-sm mt-1">{pending.length} pending · {active.length} active</p>
        </div>
        <Link
          href="/nearby"
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          New trade
        </Link>
      </div>

      {[
        { label: 'Pending approval', trades: pending, emptyMsg: 'No pending trades' },
        { label: 'Active trades', trades: active, emptyMsg: 'No active trades' },
        { label: 'History', trades: history, emptyMsg: 'No completed trades yet' },
      ].map(({ label, trades: tradeList, emptyMsg }) => (
        <section key={label}>
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-3">{label}</h2>
          {tradeList.length === 0 ? (
            <div className="card p-8 text-center text-gray-400 text-sm">{emptyMsg}</div>
          ) : (
            <div className="space-y-3">
              {tradeList.map(trade => {
                const isProposer = trade.proposer_id === user.id
                const other = isProposer ? trade.receiver : trade.proposer
                const cfg = statusConfig[trade.status as keyof typeof statusConfig]
                const Icon = cfg.icon
                const giving = trade.trade_stickers?.filter((ts: any) => ts.direction === 'giving') ?? []
                const receiving = trade.trade_stickers?.filter((ts: any) => ts.direction === 'receiving') ?? []

                return (
                  <div key={trade.id} className={`card p-5 border ${cfg.bg}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full border flex items-center justify-center font-bold text-gray-700">
                          {(other?.full_name ?? other?.username)?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">
                            {isProposer ? 'You → ' : ''}{other?.full_name ?? other?.username}{!isProposer ? ' → You' : ''}
                          </div>
                          <div className="text-xs text-gray-400">{timeAgo(trade.created_at)}</div>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Stickers summary */}
                    {(giving.length > 0 || receiving.length > 0) && (
                      <div className="mt-4 flex items-center gap-3 text-xs text-gray-600">
                        <div className="flex-1 bg-white rounded-xl p-3 border">
                          <p className="font-medium text-gray-500 mb-1.5">Giving</p>
                          <div className="flex flex-wrap gap-1">
                            {giving.slice(0, 6).map((ts: any) => (
                              <span key={ts.id} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono text-xs">
                                {ts.sticker?.sticker_code}
                              </span>
                            ))}
                            {giving.length > 6 && <span className="text-gray-400">+{giving.length - 6}</span>}
                          </div>
                        </div>
                        <ArrowLeftRight size={16} className="text-gray-300 shrink-0" />
                        <div className="flex-1 bg-white rounded-xl p-3 border">
                          <p className="font-medium text-gray-500 mb-1.5">Receiving</p>
                          <div className="flex flex-wrap gap-1">
                            {receiving.slice(0, 6).map((ts: any) => (
                              <span key={ts.id} className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-mono text-xs">
                                {ts.sticker?.sticker_code}
                              </span>
                            ))}
                            {receiving.length > 6 && <span className="text-gray-400">+{receiving.length - 6}</span>}
                          </div>
                        </div>
                      </div>
                    )}

                    {trade.message && (
                      <p className="mt-3 text-sm text-gray-600 bg-white rounded-xl p-3 border italic">
                        &ldquo;{trade.message}&rdquo;
                      </p>
                    )}

                    {/* Actions */}
                    <TradeActions trade={trade} userId={user.id} isProposer={isProposer} />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}

      {trades?.length === 0 && (
        <div className="card p-16 text-center">
          <ArrowLeftRight size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">No trades yet</h3>
          <p className="text-gray-400 text-sm mb-6">Find traders near you and propose your first trade!</p>
          <Link href="/nearby" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
            Find traders nearby
          </Link>
        </div>
      )}
    </div>
  )
}

function TradeActions({ trade, userId, isProposer }: { trade: any; userId: string; isProposer: boolean }) {
  if (trade.status === 'pending' && !isProposer) {
    return (
      <div className="mt-4 flex gap-2">
        <form action={`/api/trades/${trade.id}/accept`} method="POST">
          <button type="submit" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors">
            Accept
          </button>
        </form>
        <form action={`/api/trades/${trade.id}/reject`} method="POST">
          <button type="submit" className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-semibold transition-colors">
            Decline
          </button>
        </form>
      </div>
    )
  }
  if (trade.status === 'accepted') {
    return (
      <div className="mt-4 flex gap-2">
        <form action={`/api/trades/${trade.id}/complete`} method="POST">
          <button type="submit" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition-colors">
            Mark complete
          </button>
        </form>
      </div>
    )
  }
  return null
}
