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

export async function getUniqueCuisines() {
    const { data, error } = await supabase
        .from('reviews')
        .select('cuisine_type')
        .not('cuisine_type', 'is', null)
    if (error) throw error
    return [...new Set(data.map(r => r.cuisine_type).filter(Boolean))].sort()
}

export function subscribeToReviews(callback) {
    return supabase
        .channel('reviews-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, callback)
        .subscribe()
}
