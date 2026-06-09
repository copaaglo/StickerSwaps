'use client'
import { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sticker, UserSticker } from '@/types'
import { cn, getStickerColor } from '@/lib/utils'
import { mapDbError } from '@/lib/errors'
import { Search, Filter, Plus, Minus, Heart, X, Pencil, CheckCircle2, ImageOff } from 'lucide-react'
import { EditorPanel } from './EditorPanel'

// ─── helpers ────────────────────────────────────────────────────────────────

function resolvedSrc(sticker: Sticker, mapping: Record<string, string>) {
  const mapped = mapping[sticker.sticker_code]
  return mapped
    ? `/stickers/${mapped}`
    : `/stickers/${sticker.sticker_code.replace(/ /g, '_')}.jpg`
}

type ImageStatus = 'mapped' | 'auto' | 'missing'
function imageStatus(
  sticker: Sticker,
  mapping: Record<string, string>,
  imageSet: Set<string>,
): ImageStatus {
  if (mapping[sticker.sticker_code]) return 'mapped'
  if (imageSet.has(sticker.sticker_code.replace(/ /g, '_') + '.jpg')) return 'auto'
  return 'missing'
}

const FALLBACK_EMOJI: Record<string, string> = {
  team_logo: '🏅', team_photo: '👥', fwc_special: '✨', intro: '⭐',
}

// ─── StickerImage ────────────────────────────────────────────────────────────

const StickerImage = memo(function StickerImage({
  sticker,
  mapping,
  bustKey,
}: {
  sticker: Sticker
  mapping: Record<string, string>
  bustKey?: number
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [bustKey, sticker.sticker_code])

  const emoji = FALLBACK_EMOJI[sticker.type] ?? '👤'
  const bgClass =
    sticker.type === 'team_logo'  ? 'bg-purple-50' :
    sticker.type === 'team_photo' ? 'bg-blue-50' :
    sticker.type === 'fwc_special'? 'bg-emerald-50' :
    sticker.type === 'intro'      ? 'bg-amber-50' : 'bg-gray-50'

  if (failed) {
    return (
      <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-3xl ${bgClass}`}>
        {emoji}
      </div>
    )
  }

  const base = resolvedSrc(sticker, mapping)
  const src  = bustKey ? `${base}?t=${bustKey}` : base

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={sticker.name}
      onError={() => setFailed(true)}
      className="w-full aspect-square rounded-lg object-cover"
    />
  )
})

// ─── types ───────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  stickers: Sticker[]
  userStickers: UserSticker[]
  stickerMapping: Record<string, string>
  isOwner?: boolean
  imageFiles?: string[]
}

type Tab        = 'all' | 'have' | 'duplicates' | 'wanted'
type ImgFilter  = 'all' | 'has' | 'missing'

// ─── CollectionClient ────────────────────────────────────────────────────────

export function CollectionClient({
  userId, stickers, userStickers, stickerMapping, isOwner, imageFiles,
}: Props) {
  // Stable client — created once per mount, never recreated on re-render
  const supabase = useRef(createClient()).current

  // ── collection state ──────────────────────────────────────────────────────
  const [localMap, setLocalMap] = useState<Record<number, UserSticker>>(() =>
    Object.fromEntries(userStickers.map(us => [us.sticker_id, us]))
  )
  const [search,  setSearch]  = useState('')
  const [section, setSection] = useState('all')
  const [tab,     setTab]     = useState<Tab>('all')
  const [saving,  setSaving]  = useState<Set<number>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── editor state ──────────────────────────────────────────────────────────
  const [editorMode,   setEditorMode]   = useState(false)
  const [mapping,      setMapping]      = useState<Record<string, string>>(stickerMapping)
  const [draggedFile,  setDraggedFile]  = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [draggingOver, setDraggingOver] = useState<number | null>(null)
  const [imgBusters,   setImgBusters]   = useState<Record<number, number>>({})
  const [imgFilter,    setImgFilter]    = useState<ImgFilter>('all')

  const imageSet = useMemo(() => new Set(imageFiles ?? []), [imageFiles])

  // ── computed ──────────────────────────────────────────────────────────────
  const sections = useMemo(() => {
    const s = new Set(stickers.map(st => st.team))
    return ['all', ...Array.from(s)]
  }, [stickers])

  // Per-team stats for dropdown labels
  const teamStats = useMemo(() => {
    const stats: Record<string, { total: number; have: number }> = {}
    for (const st of stickers) {
      if (!stats[st.team]) stats[st.team] = { total: 0, have: 0 }
      stats[st.team].total++
      if ((localMap[st.id]?.quantity_have ?? 0) > 0) stats[st.team].have++
    }
    return stats
  }, [stickers, localMap])

  const totalHave  = useMemo(() => Object.values(localMap).filter(us => us.quantity_have > 0).length, [localMap])
  const totalDups  = useMemo(() => Object.values(localMap).reduce((a, us) => a + us.quantity_duplicate, 0), [localMap])
  const totalWants = useMemo(() => Object.values(localMap).filter(us => us.wants).length, [localMap])

  // Normal-mode filtered stickers
  const filtered = useMemo(() => stickers.filter(st => {
    const us = localMap[st.id]
    if (search && !st.name.toLowerCase().includes(search.toLowerCase()) &&
        !st.team.toLowerCase().includes(search.toLowerCase()) &&
        !st.sticker_code.toLowerCase().includes(search.toLowerCase())) return false
    if (section !== 'all' && st.team !== section) return false
    if (tab === 'have'       && (!us || us.quantity_have === 0))      return false
    if (tab === 'duplicates' && (!us || us.quantity_duplicate === 0)) return false
    if (tab === 'wanted'     && (!us || !us.wants))                   return false
    return true
  }), [stickers, localMap, search, section, tab])

  // Editor-mode filtered stickers (ignore tab, add image filter)
  const editorFiltered = useMemo(() => stickers.filter(st => {
    if (search && !st.name.toLowerCase().includes(search.toLowerCase()) &&
        !st.sticker_code.toLowerCase().includes(search.toLowerCase())) return false
    if (section !== 'all' && st.team !== section) return false
    const status = imageStatus(st, mapping, imageSet)
    if (imgFilter === 'has'     && status === 'missing') return false
    if (imgFilter === 'missing' && status !== 'missing') return false
    return true
  }), [stickers, search, section, mapping, imageSet, imgFilter])

  // Editor image stats
  const imgStats = useMemo(() => {
    let mapped = 0, auto = 0, missing = 0
    for (const st of stickers) {
      const s = imageStatus(st, mapping, imageSet)
      if (s === 'mapped')  mapped++
      else if (s === 'auto') auto++
      else missing++
    }
    return { mapped, auto, missing, total: stickers.length }
  }, [stickers, mapping, imageSet])

  // ── actions ───────────────────────────────────────────────────────────────
  const upsert = useCallback(async (stickerId: number, patch: Partial<UserSticker>) => {
    setSaveError(null)
    setSaving(s => new Set(s).add(stickerId))

    const previous = localMap[stickerId]  // keep for rollback
    const next: UserSticker = {
      id: previous?.id ?? '',
      user_id: userId,
      sticker_id: stickerId,
      quantity_have: previous?.quantity_have ?? 0,
      quantity_duplicate: previous?.quantity_duplicate ?? 0,
      wants: previous?.wants ?? false,
      ...patch,
    }

    // Optimistic update
    setLocalMap(m => ({ ...m, [stickerId]: next }))

    // Omit id when empty — new rows must let Supabase generate the UUID.
    // Sending id:'' is an invalid UUID and Postgres rejects it silently.
    const payload: Record<string, unknown> = {
      user_id: userId,
      sticker_id: stickerId,
      quantity_have: next.quantity_have,
      quantity_duplicate: next.quantity_duplicate,
      wants: next.wants,
    }
    if (next.id) payload.id = next.id

    const { data, error } = await supabase
      .from('user_stickers')
      .upsert(payload, { onConflict: 'user_id,sticker_id' })
      .select()
      .single()

    if (error) {
      // Roll back the optimistic change so the UI stays truthful
      setLocalMap(m => {
        const rolled = { ...m }
        if (previous) rolled[stickerId] = previous
        else delete rolled[stickerId]
        return rolled
      })
      const msg = mapDbError(error)
      setSaveError(msg)
      console.error('[collection] upsert failed:', error.code, msg, error.details)
    } else if (data) {
      // Capture server-assigned id so future updates hit the right row
      setLocalMap(m => ({ ...m, [stickerId]: data as UserSticker }))
    }

    setSaving(s => { const n = new Set(s); n.delete(stickerId); return n })
  }, [localMap, userId, supabase])

  const handleAssign = useCallback(async (sticker: Sticker) => {
    const file = draggedFile ?? selectedFile
    if (!file) return

    setDraggingOver(null)
    setDraggedFile(null)
    setSelectedFile(null)

    // Optimistic update
    setMapping(m => ({ ...m, [sticker.sticker_code]: file }))
    setImgBusters(b => ({ ...b, [sticker.id]: Date.now() }))

    const res = await fetch('/api/admin/assign-sticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stickerCode: sticker.sticker_code, filename: file }),
    })
    if (!res.ok) {
      // Revert
      setMapping(m => { const n = { ...m }; delete n[sticker.sticker_code]; return n })
    }
  }, [draggedFile, selectedFile])

  const handleUnassign = useCallback(async (sticker: Sticker) => {
    setMapping(m => { const n = { ...m }; delete n[sticker.sticker_code]; return n })
    setImgBusters(b => ({ ...b, [sticker.id]: Date.now() }))
    await fetch('/api/admin/assign-sticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stickerCode: sticker.sticker_code, filename: null }),
    })
  }, [])

  const handleCardClick = useCallback((sticker: Sticker) => {
    if (!editorMode) return
    if (selectedFile || draggedFile) handleAssign(sticker)
  }, [editorMode, selectedFile, draggedFile, handleAssign])

  // ── render helpers ────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string }[] = [
    { key: 'all',        label: 'All stickers' },
    { key: 'have',       label: 'I have' },
    { key: 'duplicates', label: 'Duplicates' },
    { key: 'wanted',     label: 'Wanted' },
  ]

  const completionPct = stickers.length ? Math.round((totalHave / stickers.length) * 100) : 0
  const displayStickers = editorMode ? editorFiltered : filtered

  // ── sticker card ──────────────────────────────────────────────────────────
  function renderCard(sticker: Sticker) {
    const us    = localMap[sticker.id]
    const have  = us?.quantity_have ?? 0
    const dups  = us?.quantity_duplicate ?? 0
    const wants = us?.wants ?? false
    const isSaving   = saving.has(sticker.id)
    const isDropping = editorMode && draggingOver === sticker.id
    const canAssign  = editorMode && (!!selectedFile || !!draggedFile)
    const status     = editorMode ? imageStatus(sticker, mapping, imageSet) : null

    const statusRing =
      status === 'mapped'  ? 'ring-2 ring-emerald-400' :
      status === 'auto'    ? 'ring-1 ring-blue-300' :
      status === 'missing' ? 'ring-1 ring-red-200' : ''

    return (
      <div
        key={sticker.id}
        onClick={() => handleCardClick(sticker)}
        onDragOver={editorMode ? e => { e.preventDefault(); setDraggingOver(sticker.id) } : undefined}
        onDragLeave={editorMode ? () => setDraggingOver(null) : undefined}
        onDrop={editorMode ? e => { e.preventDefault(); handleAssign(sticker) } : undefined}
        className={cn(
          'card p-3 flex flex-col gap-2 transition-all',
          !editorMode && have > 0 ? 'border-emerald-200 bg-emerald-50/30' : '',
          !editorMode && dups > 0 ? 'border-blue-200' : '',
          editorMode ? statusRing : '',
          isDropping ? 'ring-2 ring-blue-500 bg-blue-50/50 scale-[1.02]' : '',
          canAssign && !isDropping ? 'cursor-copy hover:ring-2 hover:ring-blue-400 hover:scale-[1.01]' : '',
        )}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-1">
          <span className={cn('text-xs px-1.5 py-0.5 rounded border font-mono font-bold truncate', getStickerColor(sticker.type))}>
            {sticker.sticker_code}
          </span>
          {isSaving && (
            <svg className="animate-spin h-3 w-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {editorMode && status && (
            <span className={cn(
              'text-xs px-1 py-0.5 rounded shrink-0',
              status === 'mapped'  ? 'bg-emerald-100 text-emerald-700' :
              status === 'auto'    ? 'bg-blue-100 text-blue-700' :
                                     'bg-red-100 text-red-500',
            )}>
              {status === 'mapped' ? '✓' : status === 'auto' ? '~' : '✗'}
            </span>
          )}
        </div>

        <StickerImage sticker={sticker} mapping={mapping} bustKey={imgBusters[sticker.id]} />

        {/* Name / team */}
        <div>
          <p className="text-xs font-semibold text-gray-800 leading-tight truncate">{sticker.name}</p>
          <p className="text-xs text-gray-400 truncate">{sticker.team}</p>
        </div>

        {/* Normal-mode controls */}
        {!editorMode && (
          <div className="flex flex-col gap-1.5 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Have</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => upsert(sticker.id, { quantity_have: Math.max(0, have - 1) })}
                  disabled={have === 0}
                  className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center"
                >
                  <Minus size={10} />
                </button>
                <span className={cn('w-5 text-center text-xs font-bold', have > 0 ? 'text-emerald-600' : 'text-gray-400')}>
                  {have}
                </span>
                <button
                  onClick={() => upsert(sticker.id, { quantity_have: have + 1 })}
                  className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center"
                >
                  <Plus size={10} className="text-emerald-700" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Dups</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => upsert(sticker.id, { quantity_duplicate: Math.max(0, dups - 1) })}
                  disabled={dups === 0}
                  className="w-6 h-6 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center"
                >
                  <Minus size={10} />
                </button>
                <span className={cn('w-5 text-center text-xs font-bold', dups > 0 ? 'text-blue-600' : 'text-gray-400')}>
                  {dups}
                </span>
                <button
                  onClick={() => upsert(sticker.id, { quantity_duplicate: dups + 1 })}
                  disabled={have === 0}
                  className="w-6 h-6 rounded-md bg-blue-100 hover:bg-blue-200 disabled:opacity-30 flex items-center justify-center"
                >
                  <Plus size={10} className="text-blue-700" />
                </button>
              </div>
            </div>

            <button
              onClick={() => upsert(sticker.id, { wants: !wants })}
              className={cn(
                'w-full py-1 rounded-md text-xs font-medium flex items-center justify-center gap-1 transition-colors',
                wants ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              )}
            >
              <Heart size={10} className={wants ? 'fill-current' : ''} />
              {wants ? 'Wanted' : 'Want'}
            </button>
          </div>
        )}

        {/* Editor-mode: unassign button */}
        {editorMode && status !== 'missing' && (
          <button
            onClick={e => { e.stopPropagation(); handleUnassign(sticker) }}
            className="text-xs text-red-400 hover:text-red-600 text-right mt-auto transition-colors"
          >
            unassign
          </button>
        )}
      </div>
    )
  }

  // ── main content ──────────────────────────────────────────────────────────
  const mainContent = (
    <div className="space-y-5">
      {/* Save error banner */}
      {saveError && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-center justify-between gap-3 text-sm text-rose-700">
          <span><b>Save failed:</b> {saveError}</span>
          <button onClick={() => setSaveError(null)} className="shrink-0 text-rose-400 hover:text-rose-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Collection</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {totalHave} owned · {totalDups} duplicates · {totalWants} wanted
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => { setEditorMode(m => !m); setSelectedFile(null) }}
            className={cn(
              'shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              editorMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            <Pencil size={14} />
            {editorMode ? 'Exit editor' : 'Label photos'}
          </button>
        )}
      </div>

      {/* Progress bar (all users) */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Collection Progress</span>
          <span className="font-bold text-emerald-600">{completionPct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-emerald-600">{totalHave}</span>
            /{stickers.length} owned
          </span>
          <span>
            <span className="font-semibold text-blue-500">{totalDups}</span> duplicates
          </span>
          <span>
            <span className="font-semibold text-rose-500">{totalWants}</span> wanted
          </span>
        </div>
      </div>

      {/* Editor mode: image stats + click-to-assign banner */}
      {editorMode && (
        <div className="space-y-2">
          {/* Image coverage stats */}
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Photo Coverage</span>
              <span className="text-sm font-bold text-gray-900">
                {imgStats.mapped + imgStats.auto}/{imgStats.total}
              </span>
            </div>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-gray-600"><b className="text-emerald-700">{imgStats.mapped}</b> mapped</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-gray-600"><b className="text-blue-700">{imgStats.auto}</b> auto-matched</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-300" />
                <span className="text-gray-600"><b className="text-red-600">{imgStats.missing}</b> missing</span>
              </span>
            </div>
          </div>

          {/* Click-to-assign active banner */}
          {selectedFile && (
            <div className="rounded-xl bg-blue-600 text-white px-4 py-2.5 flex items-center justify-between text-sm">
              <span>
                Click a sticker card to assign <b className="font-mono">{selectedFile}</b>
              </span>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-blue-200 hover:text-white ml-3"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Image filter */}
          <div className="flex gap-2">
            {([
              { key: 'all' as ImgFilter,     label: 'All',     icon: null },
              { key: 'has' as ImgFilter,      label: 'Has photo',icon: CheckCircle2 },
              { key: 'missing' as ImgFilter,  label: 'Missing', icon: ImageOff },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setImgFilter(key)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  imgFilter === key
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {Icon && <Icon size={12} />}
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400 self-center">
              Showing {editorFiltered.length}
            </span>
          </div>
        </div>
      )}

      {/* Tabs (normal mode only) */}
      {!editorMode && (
        <div className="flex gap-2 border-b border-gray-200">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === t.key
                  ? 'border-emerald-500 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters row */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={editorMode ? 'Search sticker…' : 'Search player, team, number…'}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={section}
            onChange={e => setSection(e.target.value)}
            className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
          >
            {sections.map(s => {
              const ts = teamStats[s]
              const label = s === 'all'
                ? `All sections · ${totalHave}/${stickers.length}`
                : ts
                ? `${s} · ${ts.have}/${ts.total}`
                : s
              return <option key={s} value={s}>{label}</option>
            })}
          </select>
        </div>
      </div>

      {!editorMode && (
        <p className="text-sm text-gray-500">Showing {filtered.length} stickers</p>
      )}

      {/* Sticker grid */}
      <div className={cn(
        'grid gap-3',
        editorMode
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
      )}>
        {displayStickers.map(renderCard)}
      </div>

      {displayStickers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-1">No stickers found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      )}
    </div>
  )

  // ── layout ────────────────────────────────────────────────────────────────
  if (editorMode && isOwner) {
    return (
      <div className="flex gap-4 items-start">
        <EditorPanel
          files={imageFiles ?? []}
          stickers={stickers}
          mapping={mapping}
          draggedFile={draggedFile}
          selectedFile={selectedFile}
          onDragStart={f => { setSelectedFile(null); setDraggedFile(f) }}
          onDragEnd={() => setDraggedFile(null)}
          onClickFile={f => setSelectedFile(prev => prev === f ? null : f)}
        />
        <div className="flex-1 min-w-0">{mainContent}</div>
      </div>
    )
  }

  return mainContent
}
