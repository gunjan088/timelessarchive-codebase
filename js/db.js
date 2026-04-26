import { supabase } from './config.js'

export async function fetchReviews() {
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
    const profileMap = {}
    if (profilesRes.data) {
        profilesRes.data.forEach(p => { profileMap[p.id] = p })
    }

    // Attach profile to each review
    return reviewsRes.data.map(r => ({
        ...r,
        profiles: profileMap[r.user_id] || null
    }))
}

export async function insertRestaurant(place) {
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

export async function insertReview({ restaurantId, userId, dishName, rating, notes, cuisineType }) {
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

export async function getProfile(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle()
    if (error) return null
    return data
}

export async function upsertProfile(userId, displayName) {
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: displayName })
    if (error) throw error
}

export async function isUsernameTaken(name) {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('display_name', name)
        .maybeSingle()
    return !!data
}

export async function getUniqueCuisines() {
    const { data, error } = await supabase
        .from('reviews')
        .select('cuisine_type')
        .not('cuisine_type', 'is', null)
    if (error) throw error
    return [...new Set(data.map(r => r.cuisine_type).filter(Boolean))].sort()
}

export async function deleteReview(id) {
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) throw error
}

export function subscribeToReviews(callback) {
    return supabase
        .channel('reviews-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, callback)
        .subscribe()
}

// ── Travel ─────────────────────────────────────────────────────────────────

export async function fetchTravelPosts() {
    const { data, error } = await supabase
        .from('travel_posts')
        .select('id, title, destination, content, created_at, user_id')
        .eq('published', true)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function fetchTravelPost(id) {
    const [postRes, placesRes] = await Promise.all([
        supabase.from('travel_posts').select('*').eq('id', id).single(),
        supabase.from('travel_places').select('*').eq('post_id', id).order('created_at')
    ])
    if (postRes.error) throw postRes.error
    if (placesRes.error) throw placesRes.error
    return { post: postRes.data, places: placesRes.data || [] }
}

export async function insertTravelPost({ userId, title, destination, content }) {
    const { data, error } = await supabase
        .from('travel_posts')
        .insert([{ user_id: userId, title, destination, content }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function insertTravelPlace({ postId, name, type, notes }) {
    const { data, error } = await supabase
        .from('travel_places')
        .insert([{ post_id: postId, name, type, notes: notes || null }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function deleteTravelPost(id) {
    const { error } = await supabase.from('travel_posts').delete().eq('id', id)
    if (error) throw error
}

// ── Wishlist ────────────────────────────────────────────────────────────────

export async function fetchWishlist(category) {
    const { data, error } = await supabase
        .from('wishlists')
        .select('id, name, notes, created_at')
        .eq('category', category)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function insertWishlistItem({ userId, category, name, notes }) {
    const { data, error } = await supabase
        .from('wishlists')
        .insert([{ user_id: userId, category, name, notes: notes || null }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function deleteWishlistItem(id) {
    const { error } = await supabase.from('wishlists').delete().eq('id', id)
    if (error) throw error
}

// ── Screen reviews ──────────────────────────────────────────────────────────

export async function fetchScreenReviews() {
    const [reviewsRes, profilesRes] = await Promise.all([
        supabase
            .from('screen_reviews')
            .select('id, title, type, platform, note, rating, created_at, user_id')
            .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, display_name')
    ])
    if (reviewsRes.error) throw reviewsRes.error
    const profileMap = {}
    if (profilesRes.data) profilesRes.data.forEach(p => { profileMap[p.id] = p })
    return reviewsRes.data.map(r => ({ ...r, profiles: profileMap[r.user_id] || null }))
}

export async function insertScreenReview({ userId, title, type, platform, note, rating }) {
    const { error } = await supabase
        .from('screen_reviews')
        .insert([{ user_id: userId, title, type, platform: platform || null, note: note || null, rating }])
    if (error) throw error
}

export async function deleteScreenReview(id) {
    const { error } = await supabase.from('screen_reviews').delete().eq('id', id)
    if (error) throw error
}

// ── Itineraries ─────────────────────────────────────────────────────────────

export async function fetchItineraries() {
    const { data, error } = await supabase
        .from('itineraries')
        .select('id, title, destination, start_date, end_date, status, created_at, user_id')
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function fetchItinerary(id) {
    const [itin, places, budgets] = await Promise.all([
        supabase.from('itineraries').select('*').eq('id', id).single(),
        supabase.from('itinerary_places').select('*').eq('itinerary_id', id).order('display_order'),
        supabase.from('itinerary_budgets').select('*').eq('itinerary_id', id)
    ])
    if (itin.error) throw itin.error
    if (places.error) throw places.error
    if (budgets.error) throw budgets.error
    return {
        itinerary: itin.data,
        places: places.data || [],
        budgets: budgets.data || []
    }
}

export async function insertItinerary({ userId, title, destination, startDate, endDate, status }) {
    const { data, error } = await supabase
        .from('itineraries')
        .insert([{ user_id: userId, title, destination, start_date: startDate || null, end_date: endDate || null, status }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function insertItineraryPlace({ itineraryId, name, category, notes, costEstimate, lat, lng, displayOrder }) {
    const { data, error } = await supabase
        .from('itinerary_places')
        .insert([{
            itinerary_id: itineraryId,
            name,
            category,
            notes: notes || null,
            cost_estimate: costEstimate ?? null,
            lat: lat ?? null,
            lng: lng ?? null,
            display_order: displayOrder ?? 0
        }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function upsertItineraryBudget({ itineraryId, category, budget }) {
    const { error } = await supabase
        .from('itinerary_budgets')
        .upsert({ itinerary_id: itineraryId, category, budget }, { onConflict: 'itinerary_id,category' })
    if (error) throw error
}

export async function updateItineraryPlaceOrder(id, displayOrder) {
    const { error } = await supabase
        .from('itinerary_places')
        .update({ display_order: displayOrder })
        .eq('id', id)
    if (error) throw error
}

export async function deleteItinerary(id) {
    const { error } = await supabase.from('itineraries').delete().eq('id', id)
    if (error) throw error
}
