'use client'
import Link from 'next/link'
import { TravelPost } from '@/lib/db/travel'

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getExcerpt(content: string | null, maxLen = 160): string {
    if (!content) return ''
    return content.length > maxLen ? content.slice(0, maxLen).trimEnd() + '…' : content
}

interface TravelListProps {
    posts: TravelPost[]
}

export default function TravelList({ posts }: TravelListProps) {
    if (posts.length === 0) {
        return (
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="text-center py-20 text-gray-600">
                    <p className="text-lg">No travel posts yet</p>
                </div>
            </main>
        )
    }

    return (
        <main className="max-w-6xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 gap-4">
                {posts.map(post => (
                    <Link
                        key={post.id}
                        href={`/travel/${post.id}`}
                        className="block bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5 group"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                                        📍 {post.destination}
                                    </span>
                                    <span className="text-xs text-gray-600">{formatDate(post.created_at)}</span>
                                </div>
                                <h2 className="text-xl font-bold text-white group-hover:text-orange-400 transition-colors mb-2">
                                    {post.title}
                                </h2>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    {getExcerpt(post.content)}
                                </p>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </main>
    )
}
