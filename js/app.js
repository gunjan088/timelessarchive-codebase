import { supabase } from './config.js'
import {
    fetchReviews, insertRestaurant, insertReview,
    getProfile, upsertProfile, getUniqueCuisines, subscribeToReviews, deleteReview, isUsernameTaken
} from './db.js'
import {
    renderSkeletons, renderCards, renderCuisinePills,
    renderCuisineFilter, showToast, openModal, closeModal
} from './ui.js'
import { renderNav, renderNavUser } from './nav.js'

// ── State ──────────────────────────────────────────────────────────────────
let currentUser   = null
let selectedPlace = null
let selectedRating = null
let selectedCuisine = null
let allReviews    = []
let activeFilter  = 'all'
let activeCuisineFilter = ''
let searchQuery   = ''

// ── DOM refs ───────────────────────────────────────────────────────────────
const authScreen    = document.getElementById('auth-screen')
const profileScreen = document.getElementById('profile-screen')
const appScreen     = document.getElementById('app-screen')
const reviewsGrid   = document.getElementById('reviews-grid')
const emptyState    = document.getElementById('empty-state')
const searchInput   = document.getElementById('restaurant-search')
const searchResults = document.getElementById('search-results')

// ── Screens ────────────────────────────────────────────────────────────────
function showScreen(name) {
    authScreen.classList.add('hidden')
    profileScreen.classList.add('hidden')
    appScreen.classList.add('hidden')
    if (name === 'auth')    authScreen.classList.remove('hidden')
    else if (name === 'profile') profileScreen.classList.remove('hidden')
    else                    appScreen.classList.remove('hidden')
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
    // Always show the app and load the feed — auth is only needed to add reviews
    showScreen('app')
    renderNav('food', false)
    wireNavButtons()
    await loadFeed()
    setupRealtime()

    // Silently check if user is already logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        currentUser = user
        const profile = await getProfile(user.id)
        if (!profile) {
            showScreen('profile')
        } else {
            renderNav('food', true)
            renderNavUser(profile.display_name, { onLogout: logoutHandler, showAddReview: true })
            wireNavButtons()
        }
    }
}

// ── Auth tabs ──────────────────────────────────────────────────────────────
let authMode = 'login'

document.getElementById('tab-login').addEventListener('click', () => {
    authMode = 'login'
    document.getElementById('tab-login').classList.add('active')
    document.getElementById('tab-signup').classList.remove('active')
    document.getElementById('signup-name').classList.add('hidden')
    document.getElementById('auth-btn').textContent = 'Sign In'
    document.getElementById('auth-msg').classList.add('hidden')
})

document.getElementById('tab-signup').addEventListener('click', () => {
    authMode = 'signup'
    document.getElementById('tab-signup').classList.add('active')
    document.getElementById('tab-login').classList.remove('active')
    document.getElementById('signup-name').classList.remove('hidden')
    document.getElementById('auth-btn').textContent = 'Create Account'
    document.getElementById('auth-msg').classList.add('hidden')
})

// ── Show/hide password ─────────────────────────────────────────────────────
document.getElementById('toggle-password').addEventListener('click', () => {
    const input = document.getElementById('password')
    const btn   = document.getElementById('toggle-password')
    if (input.type === 'password') {
        input.type = 'text'
        btn.textContent = '🙈'
    } else {
        input.type = 'password'
        btn.textContent = '👁'
    }
})

// ── Auth submit ────────────────────────────────────────────────────────────
document.getElementById('auth-btn').addEventListener('click', async () => {
    const email    = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const btn      = document.getElementById('auth-btn')
    const msg      = document.getElementById('auth-msg')

    msg.classList.add('hidden')
    if (!email)    { msg.textContent = 'Enter your email'; msg.classList.remove('hidden'); return }
    if (!password) { msg.textContent = 'Enter your password'; msg.classList.remove('hidden'); return }

    btn.disabled = true

    if (authMode === 'signup') {
        const name = document.getElementById('signup-name').value.trim()
        if (!name) { msg.textContent = 'Enter your name'; msg.classList.remove('hidden'); btn.disabled = false; return }

        btn.textContent = 'Creating account...'
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
            msg.textContent = error.message
            msg.classList.remove('hidden')
            btn.textContent = 'Create Account'
            btn.disabled = false
            return
        }
        currentUser = data.user
        await upsertProfile(currentUser.id, name)
        btn.textContent = 'Create Account'
        btn.disabled = false
        await enterApp(name)
        return
    } else {
        btn.textContent = 'Signing in...'
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            msg.textContent = error.message
            msg.classList.remove('hidden')
            btn.textContent = 'Sign In'
            btn.disabled = false
            return
        }
        currentUser = data.user
        const profile = await getProfile(currentUser.id)
        if (!profile) { showScreen('profile'); btn.disabled = false; return }
        btn.textContent = 'Sign In'
        btn.disabled = false
        await enterApp(profile.display_name)
        return
    }
})

document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('auth-btn').click()
})

// ── Profile setup (fallback for existing email users without a profile) ────
document.getElementById('save-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('display-name').value.trim()
    if (!name) return
    await upsertProfile(currentUser.id, name)
    await enterApp(name)
})

document.getElementById('display-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-name-btn').click()
})

// ── Logout ─────────────────────────────────────────────────────────────────
async function logoutHandler() {
    try { await supabase.auth.signOut() } catch (_) {}
    currentUser = null
    renderNav('food', false)
    // Re-render cards to remove delete buttons
    renderFiltered()
}

function wireNavButtons() {
    const btn = document.getElementById('add-review-btn')
    if (!btn) return
    const fresh = btn.cloneNode(true)
    btn.parentNode.replaceChild(fresh, btn)
    fresh.addEventListener('click', () => {
        if (!currentUser) { showScreen('auth'); return }
        resetModal()
        openModal()
    })
}

async function enterApp(displayName) {
    showScreen('app')
    renderNav('food', true)
    renderNavUser(displayName, { onLogout: logoutHandler, showAddReview: true })
    wireNavButtons()
    // Only reload feed if needed (first load already happened in init)
    if (!allReviews.length) {
        await loadFeed()
        setupRealtime()
    } else {
        // Re-render to show delete buttons on own reviews
        renderFiltered()
    }
}

// ── Feed ───────────────────────────────────────────────────────────────────
async function loadFeed() {
    renderSkeletons(reviewsGrid, 6)
    try {
        allReviews = await fetchReviews()
        renderFiltered()
        const cuisines = await getUniqueCuisines()
        renderCuisineFilter(document.getElementById('cuisine-filter'), cuisines)
    } catch (err) {
        showToast('Failed to load reviews', 'error')
        console.error(err)
        renderCards([], reviewsGrid, emptyState)
    }
}

function renderFiltered() {
    let filtered = allReviews
    if (activeFilter !== 'all') {
        filtered = filtered.filter(r => r.rating === activeFilter)
    }
    if (activeCuisineFilter) {
        filtered = filtered.filter(r => r.cuisine_type === activeCuisineFilter)
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(r =>
            r.restaurants.name.toLowerCase().includes(q) ||
            r.dish_name.toLowerCase().includes(q)
        )
    }
    renderCards(filtered, reviewsGrid, emptyState, currentUser?.id)
}

// ── Delete ─────────────────────────────────────────────────────────────────
reviewsGrid.addEventListener('click', async e => {
    const btn = e.target.closest('.delete-btn')
    if (!btn) return
    const id = btn.dataset.id
    btn.textContent = '...'
    btn.disabled = true
    try {
        await deleteReview(id)
        allReviews = allReviews.filter(r => r.id !== id)
        renderFiltered()
        showToast('Review deleted')
    } catch (err) {
        showToast('Failed to delete', 'error')
        btn.textContent = '✕'
        btn.disabled = false
    }
})

// ── Filter chips ───────────────────────────────────────────────────────────
document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        activeFilter = btn.dataset.filter
        renderFiltered()
    })
})

document.getElementById('cuisine-filter').addEventListener('change', e => {
    activeCuisineFilter = e.target.value
    renderFiltered()
})

document.getElementById('search-filter').addEventListener('input', e => {
    searchQuery = e.target.value
    renderFiltered()
})

// ── Modal ──────────────────────────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeModal)

document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal()
})

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal()
})

function resetModal() {
    selectedPlace   = null
    selectedRating  = null
    selectedCuisine = null
    searchInput.value = ''
    document.getElementById('dish-name').value = ''
    document.getElementById('notes').value = ''
    searchResults.classList.add('hidden')
    document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
    renderCuisinePills(document.getElementById('cuisine-pills'))
}

// ── Cuisine pills (inside modal) ───────────────────────────────────────────
document.getElementById('cuisine-pills').addEventListener('click', e => {
    const pill = e.target.closest('.cuisine-pill')
    if (!pill) return
    selectedCuisine = selectedCuisine === pill.dataset.cuisine ? null : pill.dataset.cuisine
    document.querySelectorAll('.cuisine-pill').forEach(p => {
        p.classList.toggle('selected', p.dataset.cuisine === selectedCuisine)
    })
})

// ── Rating buttons ─────────────────────────────────────────────────────────
document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
        btn.classList.add('selected')
        selectedRating = btn.dataset.value
    })
})

// ── Restaurant search (Nominatim) ──────────────────────────────────────────
let searchTimeout = null

searchInput.addEventListener('input', e => {
    clearTimeout(searchTimeout)
    const query = e.target.value.trim()
    if (query.length < 3) { searchResults.classList.add('hidden'); return }

    searchTimeout = setTimeout(async () => {
        try {
            const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Bangalore')}&limit=5`)
            const data = await res.json()
            searchResults.innerHTML = ''

            if (data.length > 0) {
                searchResults.classList.remove('hidden')
                data.forEach(place => {
                    const shortName = place.name || place.display_name.split(',')[0]
                    const li = document.createElement('li')
                    li.className = 'p-3 hover:bg-gray-700 cursor-pointer transition-colors'
                    li.innerHTML = `
                        <div class="font-semibold text-white text-sm">${shortName}</div>
                        <div class="text-xs text-gray-400 truncate mt-0.5">${place.display_name}</div>
                    `
                    li.onclick = () => {
                        searchInput.value = shortName
                        selectedPlace = {
                            name: shortName,
                            address: place.display_name,
                            url: `https://maps.google.com/maps?q=${place.lat},${place.lon}`
                        }
                        searchResults.classList.add('hidden')
                    }
                    searchResults.appendChild(li)
                })
            } else {
                searchResults.innerHTML = '<li class="p-4 text-sm text-gray-500 text-center italic">No places found. Try another name.</li>'
                searchResults.classList.remove('hidden')
            }
        } catch (err) {
            console.error('Search error:', err)
        }
    }, 500)
})

document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden')
    }
})

// ── Submit review ──────────────────────────────────────────────────────────
document.getElementById('submit-btn').addEventListener('click', async () => {
    if (!selectedPlace)  return showToast('Select a restaurant from the list', 'error')
    const dishName = document.getElementById('dish-name').value.trim()
    if (!dishName)       return showToast('What did you order?', 'error')
    if (!selectedRating) return showToast('How was it?', 'error')

    const btn = document.getElementById('submit-btn')
    btn.textContent = 'Saving...'
    btn.disabled = true

    try {
        const restaurantId = await insertRestaurant(selectedPlace)
        const notes = document.getElementById('notes').value.trim()
        await insertReview({
            restaurantId,
            userId: currentUser.id,
            dishName,
            rating: selectedRating,
            notes,
            cuisineType: selectedCuisine
        })
        showToast('Review saved! 🎉')
        closeModal()
        allReviews = await fetchReviews()
        renderFiltered()
        const cuisines = await getUniqueCuisines()
        renderCuisineFilter(document.getElementById('cuisine-filter'), cuisines)
    } catch (err) {
        showToast(err.message || 'Failed to save', 'error')
        console.error(err)
    } finally {
        btn.textContent = 'Save Review'
        btn.disabled = false
    }
})

// ── Realtime ───────────────────────────────────────────────────────────────
function setupRealtime() {
    subscribeToReviews(async () => {
        allReviews = await fetchReviews()
        renderFiltered()
        const cuisines = await getUniqueCuisines()
        renderCuisineFilter(document.getElementById('cuisine-filter'), cuisines)
    })
}

// ── Start ──────────────────────────────────────────────────────────────────
init().catch(err => {
    console.error('Init failed:', err)
    showScreen('app')
})
