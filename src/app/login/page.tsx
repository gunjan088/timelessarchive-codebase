'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'email' | 'otp'

function LoginForm() {
    const [step, setStep] = useState<Step>('email')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const returnTo = searchParams.get('return') ?? '/'

    async function sendOtp(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithOtp({ email })
        setLoading(false)
        if (error) { setError(error.message); return }
        setStep('otp')
    }

    async function verifyOtp(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
        setLoading(false)
        if (error) { setError(error.message); return }
        router.push(returnTo)
        router.refresh()
    }

    return (
        <div className="w-full max-w-sm">
            {step === 'email' ? (
                <form onSubmit={sendOtp} className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold text-white">Sign in</h1>
                    <p className="text-sm text-gray-400">Enter your email to receive a sign-in code.</p>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
                    />
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-xl transition-all"
                    >
                        {loading ? 'Sending...' : 'Send code'}
                    </button>
                </form>
            ) : (
                <form onSubmit={verifyOtp} className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold text-white">Enter code</h1>
                    <p className="text-sm text-gray-400">Check your email at <span className="text-white">{email}</span>.</p>
                    <input
                        type="text"
                        value={otp}
                        onChange={e => setOtp(e.target.value)}
                        placeholder="123456"
                        required
                        inputMode="numeric"
                        maxLength={6}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors tracking-widest text-center text-lg"
                    />
                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 rounded-xl transition-all"
                    >
                        {loading ? 'Verifying...' : 'Verify'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setStep('email'); setOtp(''); setError(null) }}
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        Use a different email
                    </button>
                </form>
            )}
        </div>
    )
}

export default function LoginPage() {
    return (
        <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
            <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
                <LoginForm />
            </Suspense>
        </main>
    )
}
