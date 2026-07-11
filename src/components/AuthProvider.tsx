'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/auth'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const setUser = useAuthStore((s) => s.setUser)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') return
            setUser(session?.user ?? null)
        })
        return () => subscription.unsubscribe()
    }, [setUser])

    return <>{children}</>
}
