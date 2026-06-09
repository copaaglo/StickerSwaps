import Link from 'next/link'
import { BookOpen, MessageCircle, Users, Star, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚽</span>
              <span className="font-bold text-white text-xl">StickerSwaps</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                2026
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm text-gray-300 hover:text-white transition-colors px-4 py-2"
              >
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="text-sm bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-semibold transition-colors shadow-lg"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Zap size={14} />
            48 teams · ~1,000 stickers · Live now across USA, Canada & Mexico
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6">
            Trade stickers
            <span className="block text-emerald-400">with your neighbors</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            The fastest way to complete your FIFA World Cup 2026 Panini album.
            List your duplicates, post in the community feed, and swap in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl"
            >
              Start trading free
            </Link>
            <Link
              href="/auth/login"
              className="bg-white/10 hover:bg-white/15 text-white border border-white/20 px-8 py-4 rounded-xl font-bold text-lg transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-4">Complete your album faster</h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            No more stuffing duplicates in a drawer. Find exactly who has what you need, right in your city.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: BookOpen,
                color: 'text-emerald-400',
                border: 'border-emerald-500/20',
                bg: 'bg-emerald-500/10',
                title: 'Track your collection',
                desc: 'Mark every sticker you own, flag duplicates, and build a want list to find exactly what you need.',
              },
              {
                icon: Users,
                color: 'text-blue-400',
                border: 'border-blue-500/20',
                bg: 'bg-blue-500/10',
                title: 'Community feed',
                desc: 'Post what you have or need, tag your trade type, and connect with collectors worldwide.',
              },
              {
                icon: MessageCircle,
                color: 'text-purple-400',
                border: 'border-purple-500/20',
                bg: 'bg-purple-500/10',
                title: 'Real-time messaging',
                desc: 'Chat instantly to agree on meet-up details. Notifications keep you in the loop.',
              },
            ].map(({ icon: Icon, color, border, bg, title, desc }) => (
              <div key={title} className={`bg-white/5 border ${border} rounded-2xl p-6`}>
                <div className={`w-12 h-12 ${bg} border ${border} rounded-xl flex items-center justify-center mb-4`}>
                  <Icon className={color} size={24} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 border-t border-white/10">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: '48', label: 'Teams', icon: Star },
            { value: '~1,000', label: 'Stickers', icon: Zap },
            { value: '3', label: 'Host countries', icon: Users },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label}>
              <div className="text-4xl font-extrabold text-emerald-400 mb-1">{value}</div>
              <div className="text-gray-400 text-sm flex items-center justify-center gap-1.5">
                <Icon size={13} />
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Join the beta — it&apos;s free</h2>
          <p className="text-gray-400 mb-8">
            We have 10 spots for beta testers. Be the first to complete your album.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-xl"
          >
            Claim your spot →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚽</span>
            <span className="text-gray-400 text-sm">StickerSwaps 2026</span>
          </div>
          <p className="text-gray-600 text-xs">Not affiliated with FIFA or Panini</p>
        </div>
      </footer>
    </div>
  )
}
