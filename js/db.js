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
        .select('id, name, notes, item_type, item_genre, imdb_rating, rt_rating, created_at')
        .eq('category', category)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function insertWishlistItem({ userId, category, name, notes, itemType, itemGenre, imdbRating, rtRating }) {
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

export async function deleteWishlistItem(id) {
    const { error } = await supabase.from('wishlists').delete().eq('id', id)
    if (error) throw error
}

// ── Screen reviews ──────────────────────────────────────────────────────────

export async function fetchScreenReviews() {
    const [reviewsRes, profilesRes] = await Promise.all([
        supabase
            .from('screen_reviews')
            .select('id, title, type, platform, note, rating, genre, created_at, user_id')
            .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, display_name')
    ])
    if (reviewsRes.error) throw reviewsRes.error
    const profileMap = {}
    if (profilesRes.data) profilesRes.data.forEach(p => { profileMap[p.id] = p })
    return reviewsRes.data.map(r => ({ ...r, profiles: profileMap[r.user_id] || null }))
}

export async function insertScreenReview({ userId, title, type, platform, note, rating, genre }) {
    const { error } = await supabase
        .from('screen_reviews')
        .insert([{ user_id: userId, title, type, platform: platform || null, note: note || null, rating, genre: genre || null }])
    if (error) throw error
}

export async function deleteScreenReview(id) {
    const { error } = await supabase.from('screen_reviews').delete().eq('id', id)
    if (error) throw error
}

// ── Book reviews ────────────────────────────────────────────────────────────

export async function fetchBookReviews() {
    const [reviewsRes, profilesRes] = await Promise.all([
        supabase
            .from('book_reviews')
            .select('id, title, author, genre, note, rating, status, goodreads_rating, created_at, user_id')
            .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, display_name')
    ])
    if (reviewsRes.error) throw reviewsRes.error
    const profileMap = {}
    if (profilesRes.data) profilesRes.data.forEach(p => { profileMap[p.id] = p })
    return reviewsRes.data.map(r => ({ ...r, profiles: profileMap[r.user_id] || null }))
}

export async function insertBookReview({ userId, title, author, genre, note, rating, status = 'review', goodreadsRating }) {
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

export async function deleteBookReview(id) {
    const { error } = await supabase.from('book_reviews').delete().eq('id', id)
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
    const [itinRes, placesRes, budgetsRes] = await Promise.all([
        supabase.from('itineraries').select('*').eq('id', id).maybeSingle(),
        supabase.from('itinerary_places').select('*').eq('itinerary_id', id).order('display_order'),
        supabase.from('itinerary_budgets').select('*').eq('itinerary_id', id)
    ])
    if (itinRes.error) throw itinRes.error
    if (!itinRes.data) throw new Error('Itinerary not found')
    return { itinerary: itinRes.data, places: placesRes.data || [], budgets: budgetsRes.data || [] }
}

export async function insertItinerary({ userId, title, destination, startDate, endDate, status }) {
    const { data, error } = await supabase
        .from('itineraries')
        .insert([{ user_id: userId, title, destination, start_date: startDate || null, end_date: endDate || null, status }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function upsertItineraryBudget({ itineraryId, category, budget }) {
    const { error } = await supabase
        .from('itinerary_budgets')
        .upsert([{ itinerary_id: itineraryId, category, budget }], { onConflict: 'itinerary_id,category' })
    if (error) throw error
}

export async function deleteItinerary(id) {
    const { error } = await supabase.from('itineraries').delete().eq('id', id)
    if (error) throw error
}

export async function insertItineraryPlace({ itineraryId, name, category, notes, costEstimate, lat, lng, displayOrder, city, dayNumber }) {
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

export async function fetchPackingLists() {
    const { data, error } = await supabase
        .from('packing_lists')
        .select('id, name, itinerary_id, created_at, user_id')
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function fetchPackingItems(listId) {
    const { data, error } = await supabase
        .from('packing_items')
        .select('id, name, is_checked, display_order')
        .eq('list_id', listId)
        .order('display_order')
    if (error) throw error
    return data
}

export async function insertPackingList({ userId, name, itineraryId }) {
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
    return full
}

export async function deletePackingList(id) {
    const { error } = await supabase.from('packing_lists').delete().eq('id', id)
    if (error) throw error
}

export async function insertPackingItem({ listId, name, displayOrder }) {
    const { data, error } = await supabase
        .from('packing_items')
        .insert([{ list_id: listId, name, display_order: displayOrder ?? 0 }])
        .select('id, name, is_checked, display_order')
    if (error) throw error
    return data[0]
}

export async function togglePackingItem(id, isChecked) {
    const { error } = await supabase.from('packing_items').update({ is_checked: isChecked }).eq('id', id)
    if (error) throw error
}

export async function deletePackingItem(id) {
    const { error } = await supabase.from('packing_items').delete().eq('id', id)
    if (error) throw error
}
