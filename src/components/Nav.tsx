'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const LINKS = [
    { href: '/', label: 'Food', emoji: '🍽️' },
    { href: '/travel', label: 'Travel', emoji: '✈️' },
    { href: '/movies', label: 'Movies', emoji: '🎬' },
    { href: '/books', label: 'Books', emoji: '📚' },
]

export default function Nav() {
    const pathname = usePathname()
    const router = useRouter()
    const user = useAuthStore((s) => s.user)

    async function handleLogout() {
        const supabase = createBrowserSupabaseClient()
        await supabase.auth.signOut()
        router.refresh()
    }

    return (
        <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur border-b border-gray-800">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-6">
                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
                        <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                            <span className="hidden sm:inline">Timeless Archive</span>
                            <span className="sm:hidden">TA</span>
                        </span>
                    </Link>
                    <nav className="flex items-center gap-0.5 sm:gap-1">
                        {LINKS.map(({ href, label, emoji }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    pathname === href
                                        ? 'bg-gray-800 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                                }`}
                            >
                                <span>{emoji}</span>
                                <span className="hidden sm:inline ml-1">{label}</span>
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {user ? (
                        <>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {((user.user_metadata?.display_name as string) ?? user.email ?? '?')[0].toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-300 hidden sm:block">
                                {(user.user_metadata?.display_name as string) ?? user.email}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="text-gray-500 hover:text-white text-xs transition-colors border border-gray-700 hover:border-gray-500 px-2.5 py-1.5 rounded-lg"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <Link
                            href={`/login?return=${encodeURIComponent(pathname)}`}
                            className="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-3 py-2 rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-lg shadow-orange-500/20 whitespace-nowrap"
                        >
                            Sign In
                        </Link>
                    )}
                </div>
            </div>
        </header>
    )
}
