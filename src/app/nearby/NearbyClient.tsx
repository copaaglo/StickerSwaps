'use client'
import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Profile } from '@/types'
import { haversineDistance, formatDistance } from '@/lib/utils'
import { MapPin, MessageCircle, ArrowLeftRight, Users, SlidersHorizontal } from 'lucide-react'

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => (
  <div className="h-96 bg-gray-100 rounded-2xl flex items-center justify-center">
    <p className="text-gray-400">Loading map…</p>
  </div>
)})

interface OtherSticker { user_id: string; sticker_id: number; quantity_duplicate: number; wants: boolean }
interface MySticker { sticker_id: number; wants: boolean }

interface Props {
  currentUserId: string
  myProfile: Profile | null
  otherProfiles: Profile[]
  myStickers: MySticker[]
  otherStickers: OtherSticker[]
}

export function NearbyClient({ currentUserId, myProfile, otherProfiles, myStickers, otherStickers }: Props) {
  const [radiusKm, setRadiusKm] = useState(25)
  const [locationGranted, setLocationGranted] = useState(!!myProfile?.location_lat)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

  const myWants = useMemo(() => new Set(myStickers.filter(s => s.wants).map(s => s.sticker_id)), [myStickers])

  const nearbyUsers = useMemo(() => {
    if (!myProfile?.location_lat || !myProfile?.location_lng) return []
    return otherProfiles
      .map(profile => {
        if (!profile.location_lat || !profile.location_lng) return null
        const distance = haversineDistance(
          myProfile.location_lat!, myProfile.location_lng!,
          profile.location_lat, profile.location_lng
        )
        if (distance > radiusKm) return null
        const userStickers = otherStickers.filter(s => s.user_id === profile.id)
        const duplicateCount = userStickers.filter(s => s.quantity_duplicate > 0).length
        const wantedCount = userStickers.filter(s => s.wants).length
        const matchingStickers = userStickers.filter(s => s.quantity_duplicate > 0 && myWants.has(s.sticker_id)).length
        return { profile, distance, duplicateCount, wantedCount, matchingStickers }
      })
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .sort((a, b) => b.matchingStickers - a.matchingStickers || a.distance - b.distance)
  }, [myProfile, otherProfiles, otherStickers, myWants, radiusKm])

  if (!locationGranted || !myProfile?.location_lat) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
          <MapPin size={40} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Enable location to find traders</h2>
        <p className="text-gray-500 max-w-sm mb-8">
          We need your location to show you collectors near you. Your exact location is never shown to other users.
        </p>
        <Link
          href="/profile"
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
        >
          Set my location
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nearby Traders</h1>
          <p className="text-gray-500 text-sm mt-1">
            {nearbyUsers.length} collector{nearbyUsers.length !== 1 ? 's' : ''} within {radiusKm}km of {myProfile.location_city ?? 'you'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-2 rounded-l-xl border text-sm font-medium transition-colors ${viewMode === 'map' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            Map
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 rounded-r-xl border text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            List
          </button>
        </div>
      </div>

      {/* Radius filter */}
      <div className="card p-4 flex items-center gap-4">
        <SlidersHorizontal size={16} className="text-gray-400 shrink-0" />
        <span className="text-sm text-gray-600 shrink-0">Search radius:</span>
        <input
          type="range"
          min={5} max={100} step={5}
          value={radiusKm}
          onChange={e => setRadiusKm(Number(e.target.value))}
          className="flex-1 accent-emerald-500"
        />
        <span className="text-sm font-semibold text-gray-900 w-16 text-right">{radiusKm} km</span>
      </div>

      {viewMode === 'map' && (
        <div className="card overflow-hidden">
          <MapView
            myProfile={myProfile}
            nearbyUsers={nearbyUsers}
          />
        </div>
      )}

      {/* User cards */}
      <div className="space-y-3">
        {nearbyUsers.length === 0 ? (
          <div className="card p-12 text-center">
            <Users size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No traders in this area yet</p>
            <p className="text-gray-400 text-sm mt-1">Try increasing the search radius or invite friends!</p>
          </div>
        ) : (
          nearbyUsers.map(({ profile, distance, duplicateCount, wantedCount, matchingStickers }) => (
            <div key={profile.id} className="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
              {/* Avatar */}
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 text-xl font-bold text-emerald-700">
                {(profile.full_name ?? profile.username)?.[0]?.toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{profile.full_name ?? profile.username}</span>
                  <span className="text-xs text-gray-400">@{profile.username}</span>
                  {matchingStickers > 0 && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      ✓ {matchingStickers} you want
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} />
                    {formatDistance(distance)} away
                    {profile.location_city && ` · ${profile.location_city}`}
                  </span>
                  <span>{duplicateCount} duplicates</span>
                  <span>{wantedCount} wanted</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/messages?with=${profile.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <MessageCircle size={14} />
                  Message
                </Link>
                <Link
                  href={`/trades/new?with=${profile.id}`}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                  <ArrowLeftRight size={14} />
                  Trade
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
