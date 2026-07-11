import { createClient } from '@/lib/supabase/client'

export type WishlistItem = {
  id: string
  name: string
  notes: string | null
  item_type: string | null
  item_genre: string | null
  imdb_rating: number | null
  rt_rating: number | null
  created_at: string
}

export type Itinerary = {
  id: string
  title: string
  destination: string
  start_date: string | null
  end_date: string | null
  status: string
  created_at: string
  user_id: string
}

export type ItineraryPlace = {
  id: string
  itinerary_id: string
  name: string
  category: string
  notes: string | null
  cost_estimate: number | null
  lat: number | null
  lng: number | null
  display_order: number
  city: string | null
  day_number: number | null
}

export type ItineraryBudget = {
  id: string
  itinerary_id: string
  category: string
  budget: number
}

export type PackingList = {
  id: string
  name: string
  itinerary_id: string | null
  created_at: string
  user_id: string
}

export type PackingItem = {
  id: string
  name: string
  is_checked: boolean
  display_order: number
}

// ── Wishlist ────────────────────────────────────────────────────────────────

export async function fetchWishlist(category: string): Promise<WishlistItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('wishlists')
    .select('id, name, notes, item_type, item_genre, imdb_rating, rt_rating, created_at')
    .eq('category', category)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function insertWishlistItem({
  userId,
  category,
  name,
  notes,
  itemType,
  itemGenre,
  imdbRating,
  rtRating,
}: {
  userId: string
  category: string
  name: string
  notes?: string | null
  itemType?: string | null
  itemGenre?: string | null
  imdbRating?: number | null
  rtRating?: number | null
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('wishlists')
    .insert([{
      user_id: userId, category, name,
      notes: notes || null,
      item_type: itemType || null,
      item_genre: itemGenre || null,
      imdb_rating: imdbRating || null,
      rt_rating: rtRating || null
    }])
    .select('id')
  if (error) throw error
  return data[0].id
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('wishlists').delete().eq('id', id)
  if (error) throw error
}

// ── Itineraries ─────────────────────────────────────────────────────────────

export async function fetchItineraries(): Promise<Itinerary[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('itineraries')
    .select('id, title, destination, start_date, end_date, status, created_at, user_id')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchItinerary(id: string): Promise<{
  itinerary: Itinerary
  places: ItineraryPlace[]
  budgets: ItineraryBudget[]
}> {
  const supabase = createClient()
  const [itinRes, placesRes, budgetsRes] = await Promise.all([
    supabase.from('itineraries').select('*').eq('id', id).maybeSingle(),
    supabase.from('itinerary_places').select('*').eq('itinerary_id', id).order('display_order'),
    supabase.from('itinerary_budgets').select('*').eq('itinerary_id', id)
  ])
  if (itinRes.error) throw itinRes.error
  if (!itinRes.data) throw new Error('Itinerary not found')
  return {
    itinerary: itinRes.data as Itinerary,
    places: (placesRes.data ?? []) as ItineraryPlace[],
    budgets: (budgetsRes.data ?? []) as ItineraryBudget[]
  }
}

export async function insertItinerary({
  userId,
  title,
  destination,
  startDate,
  endDate,
  status,
}: {
  userId: string
  title: string
  destination: string
  startDate?: string | null
  endDate?: string | null
  status: string
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('itineraries')
    .insert([{ user_id: userId, title, destination, start_date: startDate || null, end_date: endDate || null, status }])
    .select('id')
  if (error) throw error
  return data[0].id
}

export async function upsertItineraryBudget({
  itineraryId,
  category,
  budget,
}: {
  itineraryId: string
  category: string
  budget: number
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('itinerary_budgets')
    .upsert([{ itinerary_id: itineraryId, category, budget }], { onConflict: 'itinerary_id,category' })
  if (error) throw error
}

export async function updateItinerary(
  id: string,
  { title, destination, startDate, endDate, status }: {
    title: string
    destination: string
    startDate?: string | null
    endDate?: string | null
    status: string
  }
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('itineraries')
    .update({ title, destination, start_date: startDate || null, end_date: endDate || null, status })
    .eq('id', id)
  if (error) throw error
}

export async function deleteItinerary(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('itineraries').delete().eq('id', id)
  if (error) throw error
}

export async function insertItineraryPlace({
  itineraryId,
  name,
  category,
  notes,
  costEstimate,
  lat,
  lng,
  displayOrder,
  city,
  dayNumber,
}: {
  itineraryId: string
  name: string
  category: string
  notes?: string | null
  costEstimate?: number | null
  lat?: number | null
  lng?: number | null
  displayOrder?: number
  city?: string | null
  dayNumber?: number | null
}): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('itinerary_places')
    .insert([{
      itinerary_id: itineraryId,
      name,
      category,
      notes: notes ?? null,
      cost_estimate: costEstimate ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      display_order: displayOrder ?? 0,
      city: city ?? null,
      day_number: dayNumber ?? null
    }])
    .select('id')
  if (error) throw error
  return data[0].id
}

// ── Packing lists ────────────────────────────────────────────────────────────

export async function fetchPackingLists(): Promise<PackingList[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('packing_lists')
    .select('id, name, itinerary_id, created_at, user_id')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchPackingItems(listId: string): Promise<PackingItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('packing_items')
    .select('id, name, is_checked, display_order')
    .eq('list_id', listId)
    .order('display_order')
  if (error) throw error
  return data ?? []
}

export async function insertPackingList({
  userId,
  name,
  itineraryId,
}: {
  userId: string
  name: string
  itineraryId?: string | null
}): Promise<PackingList | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('packing_lists')
    .insert([{ user_id: userId, name, itinerary_id: itineraryId || null }])
    .select('id')
  if (error) throw error
  const id = data[0].id
  const { data: full, error: err2 } = await supabase
    .from('packing_lists')
    .select('id, name, itinerary_id, created_at, user_id')
    .eq('id', id)
    .maybeSingle()
  if (err2) throw err2
  return full as PackingList | null
}

export async function deletePackingList(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('packing_lists').delete().eq('id', id)
  if (error) throw error
}

export async function insertPackingItem({
  listId,
  name,
  displayOrder,
}: {
  listId: string
  name: string
  displayOrder?: number
}): Promise<PackingItem> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('packing_items')
    .insert([{ list_id: listId, name, display_order: displayOrder ?? 0 }])
    .select('id, name, is_checked, display_order')
  if (error) throw error
  return data[0] as PackingItem
}

export async function togglePackingItem(id: string, isChecked: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('packing_items').update({ is_checked: isChecked }).eq('id', id)
  if (error) throw error
}

export async function deletePackingItem(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('packing_items').delete().eq('id', id)
  if (error) throw error
}
