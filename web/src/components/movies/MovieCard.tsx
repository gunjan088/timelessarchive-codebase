'use client'
import { ScreenReview } from '@/lib/db/movies'

function getRatingBadge(rating: number | string): { badge: string; cls: string } {
    const r = String(rating)
    if (r === 'Like')         return { badge: '🔥 Loved',  cls: 'bg-green-900/40 text-green-400 border-green-800/60' }
    if (r === 'Dislike')      return { badge: '🚫 Skip',   cls: 'bg-red-900/40 text-red-400 border-red-800/60' }
    if (r === 'One-Time Try') return { badge: '🤔 Once',   cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/60' }
    return                           { badge: '🤔 Once',   cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/60' }
}

function getTimeAgo(dateString: string): string {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface MovieCardProps {
    review: ScreenReview
    currentUserId: string | null
    onDelete: (id: string) => void
    isDeleting: boolean
}

export default function MovieCard({ review, currentUserId, onDelete, isDeleting }: MovieCardProps) {
    const { badge, cls } = getRatingBadge(review.rating)
    const name = review.profiles?.display_name || 'Someone'
    const initial = name.charAt(0).toUpperCase()

    return (
        <div className="group bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-4 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-bold text-white text-sm flex-1 leading-tight">{review.title}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${cls} whitespace-nowrap flex-shrink-0`}>
                    {badge}
                </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                    {review.type}
                </span>
                {review.genre && (
                    <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        {review.genre}
                    </span>
                )}
                {review.platform && (
                    <span className="text-xs text-gray-500">{review.platform}</span>
                )}
            </div>
            {review.note && (
                <div className="bg-gray-800/60 rounded-xl px-3 py-2.5 border border-gray-700/40 mb-2">
                    <p className="text-sm text-gray-200 italic">&ldquo;{review.note}&rdquo;</p>
                </div>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/80">
                <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold text-white">
                        {initial}
                    </div>
                    <span className="text-xs text-gray-400">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">{getTimeAgo(review.created_at)}</span>
                    {review.user_id === currentUserId && (
                        <button
                            onClick={() => onDelete(review.id)}
                            disabled={isDeleting}
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-sm p-1 rounded hover:bg-red-400/10"
                        >
                            {isDeleting ? '...' : '✕'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
