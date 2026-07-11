import { createClient } from '@/lib/supabase/client'

export type ScreenReview = {
  id: string
  title: string
  type: string
  platform: string | null
  note: string | null
  rating: number
  genre: string | null
  created_at: string
  user_id: string
  profiles: {
    id: string
    display_name: string | null
  } | null
}

export async function fetchScreenReviews(): Promise<ScreenReview[]> {
  const supabase = createClient()
  const [reviewsRes, profilesRes] = await Promise.all([
    supabase
      .from('screen_reviews')
      .select('id, title, type, platform, note, rating, genre, created_at, user_id')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name')
  ])
  if (reviewsRes.error) throw reviewsRes.error
  const profileMap: Record<string, { id: string; display_name: string | null }> = {}
  if (profilesRes.data) profilesRes.data.forEach(p => { profileMap[p.id] = p })
  return (reviewsRes.data ?? []).map(r => ({ ...r, profiles: profileMap[r.user_id] || null })) as ScreenReview[]
}

export async function insertScreenReview({
  userId,
  title,
  type,
  platform,
  note,
  rating,
  genre,
}: {
  userId: string
  title: string
  type: string
  platform?: string | null
  note?: string | null
  rating: number
  genre?: string | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('screen_reviews')
    .insert([{ user_id: userId, title, type, platform: platform || null, note: note || null, rating, genre: genre || null }])
  if (error) throw error
}

export async function deleteScreenReview(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('screen_reviews').delete().eq('id', id)
  if (error) throw error
}
