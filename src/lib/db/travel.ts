import { createClient } from '@/lib/supabase/client'

export type TravelPost = {
  id: string
  title: string
  destination: string
  content: string | null
  created_at: string
  user_id: string
  published?: boolean
}

export type TravelPlace = {
  id: string
  post_id: string
  name: string
  type: string | null
  notes: string | null
  created_at: string
}

export async function fetchTravelPosts(): Promise<TravelPost[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_posts')
    .select('id, title, destination, content, created_at, user_id')
    .eq('published', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchTravelPost(id: string): Promise<{ post: TravelPost; places: TravelPlace[] }> {
  const supabase = createClient()
  const [postRes, placesRes] = await Promise.all([
    supabase.from('travel_posts').select('*').eq('id', id).single(),
    supabase.from('travel_places').select('*').eq('post_id', id).order('created_at')
  ])
  if (postRes.error) throw postRes.error
  if (placesRes.error) throw placesRes.error
  return { post: postRes.data as TravelPost, places: (placesRes.data ?? []) as TravelPlace[] }
}

export async function insertTravelPost({
  userId,
  title,
  destination,
  content,
}: {
  userId: string
  title: string
  destination: string
  content?: string | null
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_posts')
    .insert([{ user_id: userId, title, destination, content }])
    .select('id')
  if (error) throw error
  return data[0].id
}

export async function insertTravelPlace({
  postId,
  name,
  type,
  notes,
}: {
  postId: string
  name: string
  type?: string | null
  notes?: string | null
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_places')
    .insert([{ post_id: postId, name, type, notes: notes || null }])
    .select('id')
  if (error) throw error
  return data[0].id
}

export async function updateTravelPost(
  id: string,
  { title, destination, content }: { title: string; destination: string; content?: string | null }
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('travel_posts')
    .update({ title, destination, content })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTravelPost(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('travel_posts').delete().eq('id', id)
  if (error) throw error
}
