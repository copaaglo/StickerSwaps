import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, MessageCircle, TrendingUp, Package } from 'lucide-react'
import { PostsFeed } from './PostsFeed'
import { Post } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    profileRes,
    stickerStatsRes,
    msgStatsRes,
    totalStickersRes,
    postsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_stickers').select('quantity_have, quantity_duplicate, wants').eq('user_id', user.id),
    supabase.from('messages').select('id', { count: 'exact' }).eq('receiver_id', user.id).eq('read', false),
    supabase.from('stickers').select('id'),
    supabase.from('posts').select('*, profile:profiles(*)').order('created_at', { ascending: false }).limit(50),
  ])

  const profile       = profileRes.data
  const stickers      = stickerStatsRes.data ?? []
  const totalStickers = totalStickersRes.data?.length ?? 0
  const initialPosts  = (postsRes.data ?? []) as Post[]

  const totalHave       = stickers.reduce((a, s) => a + s.quantity_have, 0)
  const totalDuplicates = stickers.reduce((a, s) => a + s.quantity_duplicate, 0)
  const totalWants      = stickers.filter(s => s.wants).length
  const unreadMessages  = msgStatsRes.count ?? 0
  const ownedCount      = stickers.filter(s => s.quantity_have > 0).length
  const albumProgress   = totalStickers > 0 ? Math.round((ownedCount / totalStickers) * 100) : 0

  const stats = [
    { label: 'Stickers owned', value: totalHave,       icon: BookOpen,   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Duplicates',     value: totalDuplicates, icon: Package,    color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'Want list',      value: totalWants,      icon: TrendingUp, color: 'text-purple-600',  bg: 'bg-purple-50' },
    { label: 'Messages',       value: unreadMessages,  icon: MessageCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile?.full_name?.split(' ')[0] ?? profile?.username ?? 'Collector'}! 👋
          </h1>
          <p className="text-gray-500 mt-1">
            {profile?.location_city
              ? `Trading in ${profile.location_city}`
              : 'Set your location to find nearby traders'}
          </p>
        </div>
        {!profile?.location_city && (
          <Link
            href="/profile"
            className="text-sm bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl hover:bg-amber-100 transition-colors font-medium"
          >
            📍 Set location
          </Link>
        )}
      </div>

      {/* Album progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Album progress</h2>
          <span className="text-sm font-bold text-emerald-600">{albumProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${albumProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {ownedCount} / {totalStickers} unique stickers collected
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={color} size={20} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Quick actions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              href: '/collection',
              icon: BookOpen,
              title: 'Manage collection',
              desc: 'Mark stickers you have and need',
              color: 'bg-emerald-500',
            },
            {
              href: '/messages',
              icon: MessageCircle,
              title: `Messages${unreadMessages > 0 ? ` (${unreadMessages})` : ''}`,
              desc: 'Chat with other collectors',
              color: 'bg-purple-500',
            },
          ].map(({ href, icon: Icon, title, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="card p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group"
            >
              <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="text-white" size={20} />
              </div>
              <div className="font-semibold text-gray-900 text-sm">{title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting started tip */}
      {totalHave === 0 && (
        <div className="card p-6 border-emerald-200 bg-emerald-50">
          <h3 className="font-semibold text-emerald-900 mb-2">🚀 Getting started</h3>
          <ol className="text-sm text-emerald-800 space-y-1.5 list-decimal list-inside">
            <li>Go to <Link href="/collection" className="underline">Collection</Link> and mark which stickers you have</li>
            <li>Mark your duplicates so others can see what you can trade</li>
            <li>Post in the Community Feed below to let collectors know what you need</li>
            <li>Send a message to connect and arrange a swap!</li>
          </ol>
        </div>
      )}

      {/* Community feed */}
      <div className="border-t border-gray-200 pt-8">
        <PostsFeed
          currentUserId={user.id}
          currentProfile={profile}
          initialPosts={initialPosts}
        />
      </div>
    </div>
  )
}
