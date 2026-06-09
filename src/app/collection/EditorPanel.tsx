'use client'
import { useState, useMemo } from 'react'
import { Sticker } from '@/types'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'

type FileStatus = 'mapped' | 'auto' | 'free'
type ShowFilter = 'all' | 'mapped' | 'auto' | 'free'

interface Props {
  files: string[]
  stickers: Sticker[]
  mapping: Record<string, string>
  draggedFile: string | null
  selectedFile: string | null
  onDragStart: (file: string) => void
  onDragEnd: () => void
  onClickFile: (file: string) => void
}

export function EditorPanel({
  files,
  stickers,
  mapping,
  draggedFile,
  selectedFile,
  onDragStart,
  onDragEnd,
  onClickFile,
}: Props) {
  const [teamFilter, setTeamFilter] = useState('')
  const [showFilter, setShowFilter] = useState<ShowFilter>('all')

  const imageSet = useMemo(() => new Set(files), [files])

  // Files that are a natural match for a sticker code
  const naturallyMatched = useMemo(() => {
    const s = new Set<string>()
    for (const st of stickers) {
      const f = st.sticker_code.replace(/ /g, '_') + '.jpg'
      if (imageSet.has(f)) s.add(f)
    }
    return s
  }, [stickers, imageSet])

  // Reverse lookup: filename → sticker_code (from explicit mapping)
  const reverseMapping = useMemo(
    () => Object.fromEntries(Object.entries(mapping).map(([code, file]) => [file, code])),
    [mapping]
  )

  function fileStatus(file: string): FileStatus {
    if (reverseMapping[file]) return 'mapped'
    if (naturallyMatched.has(file)) return 'auto'
    return 'free'
  }

  const counts = useMemo(() => {
    let mapped = 0, auto = 0, free = 0
    for (const f of files) {
      const s = fileStatus(f)
      if (s === 'mapped') mapped++
      else if (s === 'auto') auto++
      else free++
    }
    return { mapped, auto, free }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, reverseMapping, naturallyMatched])

  const visible = useMemo(() => files.filter(f => {
    if (teamFilter && !f.toLowerCase().startsWith(teamFilter.toLowerCase())) return false
    if (showFilter !== 'all' && fileStatus(f) !== showFilter) return false
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [files, teamFilter, showFilter, reverseMapping, naturallyMatched])

  const filterBtns: { key: ShowFilter; label: string; count: number; color: string; active: string }[] = [
    { key: 'mapped', label: 'mapped', count: counts.mapped, color: 'bg-emerald-50 text-emerald-700', active: 'bg-emerald-500 text-white' },
    { key: 'auto',   label: 'auto',   count: counts.auto,   color: 'bg-blue-50 text-blue-700',       active: 'bg-blue-500 text-white' },
    { key: 'free',   label: 'free',   count: counts.free,   color: 'bg-gray-50 text-gray-600',        active: 'bg-gray-500 text-white' },
  ]

  return (
    <div className="w-52 shrink-0 flex flex-col gap-2 sticky top-4 self-start max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Photos · {files.length}
      </p>

      {/* Status filter chips */}
      <div className="flex gap-1">
        {filterBtns.map(btn => (
          <button
            key={btn.key}
            onClick={() => setShowFilter(prev => prev === btn.key ? 'all' : btn.key)}
            className={cn(
              'flex-1 rounded-lg py-1 text-center transition-colors',
              showFilter === btn.key ? btn.active : btn.color
            )}
          >
            <div className="text-xs font-bold leading-none">{btn.count}</div>
            <div className="leading-none mt-0.5" style={{ fontSize: '8px' }}>{btn.label}</div>
          </button>
        ))}
      </div>

      {/* Team filter */}
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          placeholder="e.g. ALG, ARG…"
          className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-1">
        {visible.map(file => {
          const status = fileStatus(file)
          const mappedTo = reverseMapping[file]
          const isSelected = selectedFile === file
          const isDragging = draggedFile === file

          return (
            <div
              key={file}
              draggable
              onDragStart={() => onDragStart(file)}
              onDragEnd={onDragEnd}
              onClick={() => onClickFile(file)}
              title={mappedTo ? `→ ${mappedTo}` : file}
              className={cn(
                'relative cursor-pointer rounded overflow-hidden border select-none transition-all',
                isSelected
                  ? 'ring-2 ring-blue-500 border-blue-500 scale-95'
                  : isDragging
                  ? 'opacity-40 ring-1 ring-blue-400 border-blue-400'
                  : status === 'mapped'
                  ? 'border-emerald-400 hover:border-emerald-500'
                  : status === 'auto'
                  ? 'border-blue-300 hover:border-blue-400'
                  : 'border-gray-200 hover:border-blue-300',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/stickers/${file}`}
                alt={file}
                draggable={false}
                loading="lazy"
                className="w-full aspect-square object-cover"
              />

              {/* Overlay badges */}
              {status === 'mapped' && (
                <div className="absolute inset-0 bg-emerald-900/50 flex items-end justify-center pb-0.5 pointer-events-none">
                  <span className="text-white truncate px-0.5 font-mono leading-none" style={{ fontSize: '7px' }}>
                    {mappedTo}
                  </span>
                </div>
              )}
              {status === 'auto' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white leading-none px-0.5 rounded-bl pointer-events-none" style={{ fontSize: '7px' }}>
                  auto
                </div>
              )}

              <p className="text-center text-gray-400 truncate px-0.5 bg-white py-0.5 leading-none" style={{ fontSize: '8px' }}>
                {file.replace('.jpg', '')}
              </p>
            </div>
          )
        })}

        {visible.length === 0 && (
          <p className="col-span-3 text-xs text-gray-400 text-center py-4">No photos match</p>
        )}
      </div>
    </div>
  )
}
