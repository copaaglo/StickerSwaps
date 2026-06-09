'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Post, Profile } from '@/types'
import { cn, timeAgo } from '@/lib/utils'
import { Plus, X, MessageCircle, Trash2, Send, Users } from 'lucide-react'
import { mapDbError } from '@/lib/errors'

export const POST_TAGS = [
  { id: 'looking-to-trade', label: 'Looking to Trade', emoji: '🔄', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { id: 'specific-card',    label: 'Specific Card',    emoji: '🎯', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'have-duplicates',  label: 'Have Duplicates',  emoji: '📦', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { id: 'meet-up',          label: 'Meet Up',          emoji: '🤝', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'bulk-trade',       label: 'Bulk Trade',       emoji: '📊', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { id: 'complete-team',    label: 'Complete Team',    emoji: '⚽', color: 'bg-red-100 text-red-700 border-red-300' },
  { id: 'foil-stickers',    label: 'Foil Stickers',    emoji: '✨', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { id: 'mail-trade',       label: 'Mail Trade',       emoji: '📬', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'urgent',           label: 'Urgent',           emoji: '🚨', color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { id: 'new-collector',    label: 'New Collector',    emoji: '🌱', color: 'bg-teal-100 text-teal-700 border-teal-300' },
]

function tagById(id: string) {
  return POST_TAGS.find(t => t.id === id)
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = name?.[0]?.toUpperCase() ?? '?'
  return (
    <div className={cn(
      'bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold shrink-0',
      size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm',
    )}>
      {initial}
    </div>
  )
}

interface Props {
  currentUserId: string
  currentProfile: Profile | null
  initialPosts: Post[]
}

export function PostsFeed({ currentUserId, currentProfile, initialPosts }: Props) {
  const supabase = createClient()
  const [posts, setPosts]               = useState<Post[]>(initialPosts)
  const [creating, setCreating]         = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [content, setContent]           = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [postError, setPostError]       = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // Realtime: new posts from other users + deletions
  useEffect(() => {
    const channel = supabase
      .channel('posts-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async payload => {
        const newPost = payload.new as Post
        if (newPost.user_id === currentUserId) return // Already added optimistically
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', newPost.user_id).single()
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev
          return [{ ...newPost, profile: profile ?? undefined }, ...prev]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, payload => {
        setPosts(prev => prev.filter(p => p.id !== (payload.old as Post).id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, currentUserId])

  function toggleTag(id: string) {
    setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || selectedTags.length === 0 || submitting) return
    setPostError(null)
    setSubmitting(true)

    // Snapshot values before clearing state
    const tagsSnapshot    = selectedTags
    const contentSnapshot = content.trim()

    const optimisticId = `opt-${Date.now()}`
    const optimistic: Post = {
      id: optimisticId,
      user_id: currentUserId,
      tags: tagsSnapshot,
      content: contentSnapshot,
      created_at: new Date().toISOString(),
      profile: currentProfile ?? undefined,
    }
    setPosts(prev => [optimistic, ...prev])
    setContent('')
    setSelectedTags([])
    setCreating(false)

    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: currentUserId, tags: tagsSnapshot, content: contentSnapshot })
      .select('*, profile:profiles(*)')
      .single()

    if (!error && data) {
      setPosts(prev => prev.map(p => p.id === optimisticId ? (data as Post) : p))
    } else {
      // Revert optimistic post and restore the form so the user can retry
      setPosts(prev => prev.filter(p => p.id !== optimisticId))
      setContent(contentSnapshot)
      setSelectedTags(tagsSnapshot)
      setCreating(true)
      setPostError(mapDbError(error) ?? 'Failed to post. Make sure the posts table exists in Supabase.')
      console.error('[PostsFeed] insert error:', error)
    }
    setSubmitting(false)
  }, [content, selectedTags, submitting, currentUserId, currentProfile, supabase])

  async function handleDelete(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId))
    await supabase.from('posts').delete().eq('id', postId)
  }

  const displayName = (profile?: Profile | null) =>
    profile?.full_name ?? profile?.username ?? 'Unknown'

  const visiblePosts = activeFilter
    ? posts.filter(p => p.tags.includes(activeFilter))
    : posts

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Users size={20} className="text-emerald-500" />
            Community Feed
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Posts from collectors worldwide</p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} />
            Create Post
          </button>
        )}
      </div>

      {/* Tag filter bar */}
      {posts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveFilter(null)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              activeFilter === null
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            )}
          >
            All
          </button>
          {POST_TAGS.map(tag => {
            const count = posts.filter(p => p.tags.includes(tag.id)).length
            if (count === 0) return null
            return (
              <button
                key={tag.id}
                onClick={() => setActiveFilter(prev => prev === tag.id ? null : tag.id)}
                className={cn(
                  'shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  activeFilter === tag.id
                    ? `${tag.color} border-current`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                )}
              >
                {tag.emoji} {tag.label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Create post form */}
      {creating && (
        <div className="card p-5 border-emerald-200 space-y-4">
          {/* Author row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={displayName(currentProfile)} />
              <div>
                <p className="font-semibold text-sm text-gray-900">{displayName(currentProfile)}</p>
                {currentProfile?.location_city && (
                  <p className="text-xs text-gray-400">{currentProfile.location_city}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => { setCreating(false); setSelectedTags([]); setContent(''); setPostError(null) }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tag picker */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Tags <span className="text-rose-400">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {POST_TAGS.map(tag => {
                  const active = selectedTags.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all select-none',
                        active
                          ? `${tag.color} border-current shadow-sm scale-95`
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-100',
                      )}
                    >
                      <span>{tag.emoji}</span>
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Message textarea */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Message <span className="text-rose-400">*</span>
              </p>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="e.g. In Mississauga looking to trade for England players, I have many Argentina duplicates!"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
              <p className={cn(
                'text-xs text-right mt-1 transition-colors',
                content.length > 270 ? 'text-rose-400' : 'text-gray-400',
              )}>
                {content.length}/300
              </p>
            </div>

            {postError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {postError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {selectedTags.length === 0 && 'Select at least one tag'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCreating(false); setSelectedTags([]); setContent(''); setPostError(null) }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || selectedTags.length === 0 || submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <Send size={14} />
                  {submitting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Posts list */}
      {visiblePosts.length === 0 && !creating ? (
        <div className="card p-10 text-center text-gray-400">
          <MessageCircle size={36} className="mx-auto mb-3 opacity-25" />
          <p className="font-medium text-sm">
            {activeFilter ? 'No posts with this tag' : 'No posts yet'}
          </p>
          <p className="text-xs mt-1">
            {activeFilter ? 'Try a different filter' : 'Be the first to post in the community!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiblePosts.map(post => {
            const profile  = post.profile
            const name     = displayName(profile)
            const isOwn    = post.user_id === currentUserId
            const firstName = profile?.full_name?.split(' ')[0] ?? profile?.username ?? 'them'

            return (
              <div key={post.id} className="card p-5 space-y-3 hover:shadow-sm transition-shadow">
                {/* Author row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} />
                    <div>
                      <p className="font-semibold text-sm text-gray-900 leading-tight">{name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {profile?.location_city
                          ? <>{profile.location_city} · {timeAgo(post.created_at)}</>
                          : timeAgo(post.created_at)
                        }
                      </p>
                    </div>
                  </div>
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      title="Delete post"
                      className="text-gray-300 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map(tagId => {
                    const tag = tagById(tagId)
                    if (!tag) return null
                    return (
                      <span
                        key={tagId}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium',
                          tag.color,
                        )}
                      >
                        {tag.emoji} {tag.label}
                      </span>
                    )
                  })}
                </div>

                {/* Content */}
                <p className="text-sm text-gray-800 leading-relaxed">{post.content}</p>

                {/* Action */}
                {!isOwn && (
                  <div className="pt-1 border-t border-gray-50">
                    <Link
                      href={`/messages?with=${post.user_id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium transition-colors"
                    >
                      <MessageCircle size={14} />
                      Message {firstName}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
