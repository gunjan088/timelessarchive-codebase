'use client'

import { useState, useMemo } from 'react'
import ReviewCard from './ReviewCard'
import { useAuthStore } from '@/store/auth'
import type { Review } from '@/lib/db/food'
import { deleteReview } from '@/lib/db/food'

type RatingFilter = 'all' | 'Like' | 'One-Time Try' | 'Dislike'

export default function ReviewFeed({ initialReviews, cuisines }: {
    initialReviews: Review[]
    cuisines: string[]
}) {
    const user = useAuthStore((s) => s.user)
    const [reviews, setReviews] = useState(initialReviews)
    const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
    const [cuisineFilter, setCuisineFilter] = useState('all')
    const [search, setSearch] = useState('')

    const filtered = useMemo(() => {
        return reviews.filter(r => {
            if (ratingFilter !== 'all' && (r.rating as unknown) !== ratingFilter) return false
            if (cuisineFilter !== 'all' && r.cuisine_type !== cuisineFilter) return false
            if (search) {
                const q = search.toLowerCase()
                const haystack = `${r.dish_name ?? ''} ${(r.restaurants as any)?.name ?? ''}`.toLowerCase()
                if (!haystack.includes(q)) return false
            }
            return true
        })
    }, [reviews, ratingFilter, cuisineFilter, search])

    async function handleDelete(id: string) {
        await deleteReview(id)
        setReviews(prev => prev.filter(r => r.id !== id))
    }

    return (
        <main className="max-w-6xl mx-auto px-4 py-6">
            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search dishes or restaurants..."
                    className="w-full sm:w-80 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                />
            </div>

            {/* Rating filter pills */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {(['all', 'Like', 'One-Time Try', 'Dislike'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setRatingFilter(f)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            ratingFilter === f
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                    >
                        {f === 'all' ? 'All' : f === 'Like' ? '🔥 Loved' : f === 'One-Time Try' ? '🤔 Once' : '🚫 Skip'}
                    </button>
                ))}
            </div>

            {/* Cuisine filter */}
            {cuisines.length > 0 && (
                <div className="flex gap-2 mb-6 flex-wrap">
                    <button
                        onClick={() => setCuisineFilter('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            cuisineFilter === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                    >
                        All cuisines
                    </button>
                    {cuisines.map(c => (
                        <button
                            key={c}
                            onClick={() => setCuisineFilter(c)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                cuisineFilter === c ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            )}

            {/* Cards grid */}
            {filtered.length === 0 ? (
                <p className="text-center text-gray-500 py-16">No reviews match your filters.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(r => (
                        <ReviewCard
                            key={r.id}
                            review={r}
                            currentUserId={user?.id ?? null}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>
            )}
        </main>
    )
}
