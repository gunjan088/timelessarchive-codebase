'use client'
import { useState } from 'react'
import { deleteWishlistItem } from '@/lib/db/wishlist'
import type { WishlistItem } from '@/lib/db/wishlist'

export default function WishlistGrid({ initialItems, category }: {
    initialItems: WishlistItem[]
    category: string
}) {
    const [items, setItems] = useState(initialItems)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    async function handleDelete(id: string) {
        setDeletingId(id)
        try {
            await deleteWishlistItem(id)
            setItems(prev => prev.filter(i => i.id !== id))
        } finally {
            setDeletingId(null)
        }
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500">Nothing on your {category} wishlist yet.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
                <div key={item.id} className="group bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-600 transition-all">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white truncate">{item.name}</p>
                            {item.notes && (
                                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.notes}</p>
                            )}
                        </div>
                        <button
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 disabled:opacity-50 flex-shrink-0 mt-0.5"
                            aria-label="Remove from wishlist"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {item.item_type && (
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{item.item_type}</span>
                        )}
                        {item.item_genre && (
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{item.item_genre}</span>
                        )}
                        {item.imdb_rating && (
                            <span className="text-xs text-yellow-400">⭐ {item.imdb_rating} IMDb</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
