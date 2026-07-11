'use client'

import type { Review } from '@/lib/db/food'

interface ReviewCardProps {
    review: Review
    currentUserId?: string | null
    onDelete?: (id: string) => void
}

function getRatingBadge(rating: unknown): { badge: string; cls: string } {
    if (rating === 'Like')         return { badge: '🔥 Loved', cls: 'bg-green-900/40 text-green-400 border-green-800/60' }
    if (rating === 'Dislike')      return { badge: '🚫 Skip',  cls: 'bg-red-900/40 text-red-400 border-red-800/60' }
    if (rating === 'One-Time Try') return { badge: '🤔 Once',  cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/60' }
    return { badge: String(rating), cls: 'bg-gray-800 text-gray-400 border-gray-700' }
}

function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
}

export default function ReviewCard({ review: r, currentUserId, onDelete }: ReviewCardProps) {
    const { badge, cls: badgeClass } = getRatingBadge(r.rating)
    const timeAgo = getTimeAgo(r.created_at)
    const name = r.profiles?.display_name || 'Someone'
    const initial = name.charAt(0).toUpperCase()
    const shortAddr = r.restaurants?.address?.split(',').slice(1, 3).join(',').trim() ?? ''

    return (
        <div className="group bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-4 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5">
            {/* Header: restaurant name + rating badge */}
            <div className="flex items-start justify-between gap-2 mb-2">
                {r.restaurants?.google_maps_url ? (
                    <a
                        href={r.restaurants.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-white hover:text-orange-400 transition-colors leading-tight line-clamp-2 flex-1 text-sm"
                    >
                        {r.restaurants?.name}
                    </a>
                ) : (
                    <span className="font-bold text-white leading-tight line-clamp-2 flex-1 text-sm">
                        {r.restaurants?.name}
                    </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeClass} whitespace-nowrap flex-shrink-0`}>
                    {badge}
                </span>
            </div>

            {/* Cuisine + short address */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {r.cuisine_type && (
                    <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        {r.cuisine_type}
                    </span>
                )}
                {shortAddr && (
                    <span className="text-xs text-gray-600 truncate">{shortAddr}</span>
                )}
            </div>

            {/* Dish name */}
            <div className="bg-gray-800/60 rounded-xl px-3 py-2.5 border border-gray-700/40">
                <p className="text-sm text-gray-200">🍴 <span className="font-medium">{r.dish_name}</span></p>
            </div>

            {/* Notes */}
            {r.notes && (
                <p className="text-xs text-gray-400 mt-2 italic line-clamp-2">&ldquo;{r.notes}&rdquo;</p>
            )}

            {/* Footer: avatar + name, time, delete */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/80">
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {initial}
                    </div>
                    <span className="text-xs text-gray-400">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{timeAgo}</span>
                    {r.user_id === currentUserId && onDelete && (
                        <button
                            onClick={() => onDelete(r.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-sm leading-none p-1 rounded hover:bg-red-400/10"
                            title="Delete"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
