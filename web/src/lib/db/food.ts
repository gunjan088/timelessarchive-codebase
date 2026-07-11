import { createClient } from '@/lib/supabase/client'

export type Review = {
  id: string
  dish_name: string
  rating: number
  notes: string | null
  cuisine_type: string | null
  created_at: string
  user_id: string
  restaurants: {
    name: string
    address: string
    google_maps_url: string | null
  } | null
  profiles: {
    id: string
    display_name: string | null
  } | null
}

export async function fetchReviews(): Promise<Review[]> {
  const supabase = createClient()
  const [reviewsRes, profilesRes] = await Promise.all([
    supabase
      .from('reviews')
      .select(`
        id,
        dish_name,
        rating,
        notes,
        cuisine_type,
        created_at,
        user_id,
        restaurants ( name, address, google_maps_url )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, display_name')
  ])

  if (reviewsRes.error) throw reviewsRes.error

  // Build a quick lookup map for profiles
  const profileMap: Record<string, { id: string; display_name: string | null }> = {}
  if (profilesRes.data) {
    profilesRes.data.forEach(p => { profileMap[p.id] = p })
  }

  // Attach profile to each review
  return (reviewsRes.data ?? []).map(r => ({
    ...r,
    profiles: profileMap[r.user_id] || null
  })) as unknown as Review[]
}

export async function insertRestaurant(place: { name: string; address: string; url: string | null }): Promise<string> {
  const supabase = createClient()
  // Reuse existing row if same name+address to avoid duplicates
  const { data: existing } = await supabase
    .from('restaurants')
    .select('id')
    .eq('name', place.name)
    .eq('address', place.address)
    .limit(1)
  if (existing && existing.length > 0) return existing[0].id

  const { data, error } = await supabase
    .from('restaurants')
    .insert([{ name: place.name, address: place.address, google_maps_url: place.url }])
    .select('id')
  if (error) throw error
  return data[0].id
}

export async function insertReview({
  restaurantId,
  userId,
  dishName,
  rating,
  notes,
  cuisineType,
}: {
  restaurantId: string
  userId: string
  dishName: string
  rating: number
  notes?: string | null
  cuisineType?: string | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('reviews')
    .insert([{
      restaurant_id: restaurantId,
      user_id: userId,
      dish_name: dishName,
      rating,
      notes: notes || null,
      cuisine_type: cuisineType || null
    }])
  if (error) throw error
}

export async function getProfile(userId: string): Promise<{ display_name: string | null } | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}

export async function upsertProfile(userId: string, displayName: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: displayName })
  if (error) throw error
}

export async function getUniqueCuisines(): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('cuisine_type')
    .not('cuisine_type', 'is', null)
  if (error) throw error
  return [...new Set((data ?? []).map(r => r.cuisine_type).filter(Boolean))].sort() as string[]
}

export async function deleteReview(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) throw error
}

export function subscribeToReviews(callback: (payload: unknown) => void) {
  const supabase = createClient()
  return supabase
    .channel('reviews-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, callback)
    .subscribe()
}
