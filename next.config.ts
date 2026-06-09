import type { NextConfig } from 'next'

const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname
const isDev = process.env.NODE_ENV === 'development'

const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' is only included in development for Webpack HMR; excluded in production.
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${SUPABASE_HOST} https://*.tile.openstreetmap.org`,
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://nominatim.openstreetmap.org`,
  "font-src 'self' data:",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: SUPABASE_HOST },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',            value: CSP },
          { key: 'X-Content-Type-Options',             value: 'nosniff' },
          { key: 'X-Frame-Options',                    value: 'DENY' },
          { key: 'Referrer-Policy',                    value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',                 value: 'geolocation=(self), camera=(), microphone=()' },
          { key: 'Strict-Transport-Security',          value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
