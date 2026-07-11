'use client'
import { useState } from 'react'
import { BookReview, deleteBookReview } from '@/lib/db/books'
import { useAuthStore } from '@/store/auth'
import BookCard from './BookCard'

const STATUS_OPTIONS = [
    { value: 'review', label: 'Reviews' },
    { value: 'read', label: 'Read' },
    { value: 'wishlist', label: 'Want to Read' },
]

const RATING_OPTIONS = ['Like', 'One-Time Try', 'Dislike']

interface BookFeedProps {
    initialReviews: BookReview[]
}

export default function BookFeed({ initialReviews }: BookFeedProps) {
    const [reviews, setReviews] = useState<BookReview[]>(initialReviews)
    const [statusFilter, setStatusFilter] = useState<string>('review')
    const [ratingFilter, setRatingFilter] = useState<string>('')
    const [search, setSearch] = useState<string>('')
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const user = useAuthStore((s) => s.user)

    const filtered = reviews.filter(r => {
        if (statusFilter && r.status !== statusFilter) return false
        if (ratingFilter && String(r.rating) !== ratingFilter) return false
        if (search) {
            const q = search.toLowerCase()
            const titleMatch = r.title.toLowerCase().includes(q)
            const authorMatch = (r.author || '').toLowerCase().includes(q)
            if (!titleMatch && !authorMatch) return false
        }
        return true
    })

    async function handleDelete(id: string) {
        setDeletingId(id)
        try {
            await deleteBookReview(id)
            setReviews(prev => prev.filter(r => r.id !== id))
        } catch {
            // silently fail
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <main className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                    type="text"
                    placeholder="Search books or authors..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                >
                    <option value="">All Statuses</option>
                    {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
                <select
                    value={ratingFilter}
                    onChange={e => setRatingFilter(e.target.value)}
                    className="bg-gray-900 border border-gray-700 text-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                >
                    <option value="">All Ratings</option>
                    {RATING_OPTIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-20 text-gray-600">
                    <p className="text-lg">No books found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(review => (
                        <BookCard
                            key={review.id}
                            review={review}
                            currentUserId={user?.id ?? null}
                            onDelete={handleDelete}
                            isDeleting={deletingId === review.id}
                        />
                    ))}
                </div>
            )}
        </main>
    )
}
