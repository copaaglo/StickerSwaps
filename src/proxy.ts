import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

const AUTH_LIMIT = 20
const AUTH_WINDOW_MS = 15 * 60 * 1000
const API_LIMIT = 100
const API_WINDOW_MS = 15 * 60 * 1000

function getIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function rateLimitedResponse(limit: number, resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Too many requests', retryAfter },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    },
  )
}

export async function proxy(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    const ip = getIP(request)

    if (pathname.startsWith('/auth/')) {
      const { limited, resetAt } = checkRateLimit(`auth:${ip}`, AUTH_LIMIT, AUTH_WINDOW_MS)
      if (limited) return rateLimitedResponse(AUTH_LIMIT, resetAt)
    } else if (pathname.startsWith('/api/')) {
      const { limited, resetAt } = checkRateLimit(`api:${ip}`, API_LIMIT, API_WINDOW_MS)
      if (limited) return rateLimitedResponse(API_LIMIT, resetAt)
    }

    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const protectedPaths = ['/dashboard', '/collection', '/messages', '/profile']
    const isProtected = protectedPaths.some(p => request.nextUrl.pathname.startsWith(p))

    if (isProtected && !user) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    if (user && (request.nextUrl.pathname === '/auth/login' || request.nextUrl.pathname === '/auth/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch {
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
