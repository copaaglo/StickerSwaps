'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import { Profile } from '@/types'
import { formatDistance } from '@/lib/utils'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const meIcon = L.divIcon({
  html: `<div style="background:#10b981;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

const traderIcon = (matching: number) => L.divIcon({
  html: `<div style="background:${matching > 0 ? '#3b82f6' : '#6b7280'};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25)"></div>`,
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], 11) }, [lat, lng, map])
  return null
}

interface NearbyUser {
  profile: Profile
  distance: number
  duplicateCount: number
  matchingStickers: number
}

export default function MapView({ myProfile, nearbyUsers }: { myProfile: Profile; nearbyUsers: NearbyUser[] }) {
  const lat = myProfile.location_lat!
  const lng = myProfile.location_lng!

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={11}
      style={{ height: '420px', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap lat={lat} lng={lng} />

      {/* My position */}
      <Marker position={[lat, lng]} icon={meIcon}>
        <Popup>
          <strong>You</strong><br />
          {myProfile.location_city}
        </Popup>
      </Marker>

      {/* Radius circle */}
      <Circle center={[lat, lng]} radius={25000} pathOptions={{ color: '#10b981', fillOpacity: 0.05, weight: 1 }} />

      {/* Nearby traders */}
      {nearbyUsers.map(({ profile, distance, duplicateCount, matchingStickers }) => (
        <Marker
          key={profile.id}
          position={[profile.location_lat!, profile.location_lng!]}
          icon={traderIcon(matchingStickers)}
        >
          <Popup>
            <div className="text-sm min-w-[160px]">
              <strong>{profile.full_name ?? profile.username}</strong>
              <p className="text-gray-500">@{profile.username}</p>
              <p className="mt-1">{formatDistance(distance)} away</p>
              <p>{duplicateCount} duplicates available</p>
              {matchingStickers > 0 && (
                <p className="text-emerald-600 font-medium">{matchingStickers} you want!</p>
              )}
              <div className="flex gap-2 mt-2">
                <a href={`/messages?with=${profile.id}`} className="text-blue-600 underline text-xs">Message</a>
                <a href={`/trades/new?with=${profile.id}`} className="text-emerald-600 underline text-xs">Trade</a>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
