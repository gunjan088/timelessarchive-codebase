import { fetchWishlist } from '@/lib/db/wishlist'
import WishlistGrid from '@/components/wishlist/WishlistGrid'

export const dynamic = 'force-dynamic'

export default async function WishlistPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>
}) {
    const { category = 'food' } = await searchParams
    const items = await fetchWishlist(category)
    return (
        <main className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white">Wishlist</h1>
            </div>
            {/* Category tabs */}
            <div className="flex gap-2 mb-6">
                {['food', 'movies', 'books', 'travel'].map(cat => (
                    <a
                        key={cat}
                        href={`/wishlist?category=${cat}`}
                        className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                            category === cat
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                    >
                        {cat}
                    </a>
                ))}
            </div>
            <WishlistGrid initialItems={items} category={category} />
        </main>
    )
}
