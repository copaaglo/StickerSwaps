'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { LIMITS, isValidUsername } from '@/lib/validate'
import { mapDbError } from '@/lib/errors'
import { MapPin, Save, Loader2, User } from 'lucide-react'

interface Props {
  userId: string
  initialProfile: Profile | null
}

export function ProfileClient({ userId, initialProfile }: Props) {
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [form, setForm] = useState({
    full_name: initialProfile?.full_name ?? '',
    username: initialProfile?.username ?? '',
    bio: initialProfile?.bio ?? '',
    location_city: initialProfile?.location_city ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function detectLocation() {
    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json`)
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown'
          await supabase.from('profiles').update({ location_lat: lat, location_lng: lng, location_city: city }).eq('id', userId)
          setForm(prev => ({ ...prev, location_city: city }))
          setProfile(prev => prev ? { ...prev, location_lat: lat, location_lng: lng, location_city: city } : prev)
        } catch {
          setError('Could not detect city name')
        }
        setGettingLocation(false)
      },
      () => {
        setError('Location access denied. Please allow location in your browser settings.')
        setGettingLocation(false)
      }
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const username = form.username.trim()
    const full_name = form.full_name.trim().slice(0, LIMITS.fullName) || null
    const bio = form.bio.trim().slice(0, LIMITS.bio) || null

    if (!isValidUsername(username)) {
      setError('Username must be 3–20 characters: lowercase letters, numbers, underscores only')
      return
    }

    setSaving(true)
    setError('')
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name, username, bio })
      .eq('id', userId)
    if (err) {
      setError(mapDbError(err))
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and location settings</p>
      </div>

      {/* Avatar */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl font-bold text-emerald-600">
          {(form.full_name || form.username)?.[0]?.toUpperCase() ?? <User size={32} />}
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl">{form.full_name || form.username}</h2>
          <p className="text-gray-400 text-sm">@{form.username}</p>
          {profile?.location_city && (
            <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
              <MapPin size={12} />
              {profile.location_city}
            </p>
          )}
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={save} className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Personal info</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
            <input
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="John Doe"
              maxLength={LIMITS.fullName}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
            <input
              value={form.username}
              onChange={e => set('username', e.target.value.toLowerCase())}
              required
              placeholder="john_doe"
              maxLength={LIMITS.username.max}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
          <textarea
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            placeholder="Tell traders about yourself… e.g. 'Collecting since age 8, looking for Spanish team stickers!'"
            rows={3}
            maxLength={LIMITS.bio}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold transition-colors text-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save changes'}
        </button>
      </form>

      {/* Location */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Location</h2>
        <p className="text-sm text-gray-500">
          Your location helps you find sticker collectors nearby. Only your city is shown to other users — never your exact address.
        </p>

        {profile?.location_city ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <MapPin size={20} className="text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">{profile.location_city}</p>
              <p className="text-xs text-emerald-600">Location set</p>
            </div>
            <button
              onClick={detectLocation}
              disabled={gettingLocation}
              className="ml-auto text-sm text-emerald-600 hover:text-emerald-800 font-medium"
            >
              Update
            </button>
          </div>
        ) : (
          <button
            onClick={detectLocation}
            disabled={gettingLocation}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {gettingLocation ? (
              <><Loader2 size={16} className="animate-spin" /> Detecting location…</>
            ) : (
              <><MapPin size={16} /> Detect my location</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
