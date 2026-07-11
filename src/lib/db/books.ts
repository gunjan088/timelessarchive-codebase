import { createClient } from '@/lib/supabase/client'

export type BookReview = {
  id: string
  title: string
  author: string | null
  genre: string | null
  note: string | null
  rating: number | null
  status: string
  goodreads_rating: number | null
  created_at: string
  user_id: string
  profiles: {
    id: string
    display_name: string | null
  } | null
}

export async function fetchBookReviews(): Promise<BookReview[]> {
  const supabase = createClient()
  const [reviewsRes, profilesRes] = await Promise.all([
    supabase
      .from('book_reviews')
      .select('id, title, author, genre, note, rating, status, goodreads_rating, created_at, user_id')
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name')
  ])
  if (reviewsRes.error) throw reviewsRes.error
  const profileMap: Record<string, { id: string; display_name: string | null }> = {}
  if (profilesRes.data) profilesRes.data.forEach(p => { profileMap[p.id] = p })
  return (reviewsRes.data ?? []).map(r => ({ ...r, profiles: profileMap[r.user_id] || null })) as BookReview[]
}

export async function insertBookReview({
  userId,
  title,
  author,
  genre,
  note,
  rating,
  status = 'review',
  goodreadsRating,
}: {
  userId: string
  title: string
  author?: string | null
  genre?: string | null
  note?: string | null
  rating?: number | null
  status?: string
  goodreadsRating?: number | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('book_reviews')
    .insert([{
      user_id: userId,
      title,
      author: author || null,
      genre: genre || null,
      note: note || null,
      rating: rating || null,
      status,
      goodreads_rating: goodreadsRating || null
    }])
  if (error) throw error
}

export async function deleteBookReview(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('book_reviews').delete().eq('id', id)
  if (error) throw error
}
