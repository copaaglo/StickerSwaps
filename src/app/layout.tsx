import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StickerSwaps — FIFA World Cup 2026',
  description: 'Trade your duplicate World Cup 2026 Panini stickers with collectors worldwide.',
  openGraph: {
    title: 'StickerSwaps — FIFA World Cup 2026',
    description: 'List your duplicates, post in the community feed, and trade stickers with ease.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
