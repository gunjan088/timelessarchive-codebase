'use client'
import Link from 'next/link'
import { TravelPost as TravelPostType, TravelPlace } from '@/lib/db/travel'

function typeStyle(type: string | null): string {
    if (type === 'Eat')  return 'bg-orange-900/40 text-orange-400 border-orange-800/60'
    if (type === 'Stay') return 'bg-blue-900/40 text-blue-400 border-blue-800/60'
    if (type === 'Do')   return 'bg-green-900/40 text-green-400 border-green-800/60'
    return 'bg-purple-900/40 text-purple-400 border-purple-800/60'
}

function typeEmoji(type: string | null): string {
    if (type === 'Eat')  return '🍽️'
    if (type === 'Stay') return '🏨'
    if (type === 'Do')   return '🎯'
    return '👁️'
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface TravelPostProps {
    post: TravelPostType
    places: TravelPlace[]
}

const PLACE_TYPES = ['Eat', 'Stay', 'Do', 'See']

export default function TravelPost({ post, places }: TravelPostProps) {
    // Group places by type
    const grouped = PLACE_TYPES.reduce<Record<string, TravelPlace[]>>((acc, t) => {
        const group = places.filter(p => p.type === t)
        if (group.length > 0) acc[t] = group
        return acc
    }, {})

    // Also include any places with unrecognized types
    const otherPlaces = places.filter(p => p.type && !PLACE_TYPES.includes(p.type))
    if (otherPlaces.length > 0) {
        grouped['Other'] = otherPlaces
    }

    return (
        <main className="max-w-3xl mx-auto px-4 py-8">
            <div className="mb-8">
                <Link href="/travel" className="text-gray-500 hover:text-gray-300 text-sm transition-colors mb-4 inline-block">
                    ← Back to Travel
                </Link>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                        📍 {post.destination}
                    </span>
                    <span className="text-xs text-gray-600">{formatDate(post.created_at)}</span>
                </div>
                <h1 className="text-3xl font-bold text-white mb-6">{post.title}</h1>
                {post.content && (
                    <div className="prose prose-invert prose-sm max-w-none">
                        <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</div>
                    </div>
                )}
            </div>

            {Object.keys(grouped).length > 0 && (
                <div className="space-y-8">
                    <h2 className="text-xl font-bold text-white border-b border-gray-800 pb-3">Places</h2>
                    {Object.entries(grouped).map(([type, typePlaces]) => (
                        <div key={type}>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                <span>{typeEmoji(type)}</span>
                                <span>{type}</span>
                            </h3>
                            <div className="space-y-3">
                                {typePlaces.map(place => (
                                    <div key={place.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                                        <div className="flex items-start gap-3">
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${typeStyle(place.type)} whitespace-nowrap flex-shrink-0 mt-0.5`}>
                                                {place.type ?? 'See'}
                                            </span>
                                            <div className="flex-1">
                                                <p className="font-semibold text-white text-sm">{place.name}</p>
                                                {place.notes && (
                                                    <p className="text-gray-400 text-sm mt-1">{place.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    )
}
