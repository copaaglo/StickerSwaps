# StickerSwaps ⚽ — FIFA World Cup 2026

> Trade your duplicate Panini World Cup stickers with collectors near you.

## Features

- **Collection manager** — Mark stickers you have, your duplicates, and your want list
- **Nearby traders** — Interactive map showing collectors within your radius
- **Real-time messaging** — Chat instantly with other collectors via Supabase Realtime
- **Trade proposals** — Structured trade offers with sticker-level specificity
- **Location-based** — Uses browser geolocation + OpenStreetMap for city detection

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime |
| Maps | Leaflet + OpenStreetMap |
| Deploy | Vercel |

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo>
cd stickerswaps
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run `supabase/schema.sql`
3. Then run `supabase/seed.sql` to populate sticker data

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in from **Settings → API** in your Supabase dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add the two environment variables in Vercel project settings
4. Deploy!

## Supabase Setup Notes

After running the schema:
- Row Level Security is already configured in the schema
- Enable Realtime for `messages` and `trades` tables: Dashboard → Database → Replication
- The `handle_new_user` trigger auto-creates profiles on signup

## Sticker Data

The seed file covers ~333 stickers:
- Introduction, Stadium, Legends, and Star Player specials
- Full rosters for: USA, Mexico, Canada, Argentina, France, Brazil, Spain, England, Germany, Portugal, Netherlands, Italy
- Abbreviated rosters for 12+ additional teams

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── auth/                 # Login + Register
│   ├── dashboard/            # Main dashboard with stats
│   ├── collection/           # Sticker collection manager
│   ├── nearby/               # Map of nearby traders
│   ├── messages/             # Real-time chat
│   ├── trades/               # Trade proposals
│   ├── profile/              # User profile + location
│   └── api/trades/           # Trade action endpoints
├── components/
│   ├── Navbar.tsx
│   └── ui/
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   └── utils.ts
└── types/index.ts
supabase/
├── schema.sql
└── seed.sql
```

---

*Not affiliated with FIFA or Panini Group*
