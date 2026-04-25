import { supabase } from './config.js'
import {
    fetchReviews, insertRestaurant, insertReview,
    getProfile, upsertProfile, getUniqueCuisines, subscribeToReviews
} from './db.js'
import {
    renderSkeletons, renderCards, renderCuisinePills,
    renderCuisineFilter, showToast, openModal, closeModal
} from './ui.js'

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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        currentUser = user
        const profile = await getProfile(user.id)
        if (!profile) {
            showScreen('profile')
        } else {
            setUserBadge(profile.display_name)
            showScreen('app')
            await loadFeed()
            setupRealtime()
        }
    } else {
        showScreen('auth')
    }
}

function setUserBadge(name) {
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase()
    document.getElementById('user-name').textContent = name
}

// ── Auth ───────────────────────────────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', async () => {
    const email    = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const btn      = document.getElementById('login-btn')
    const msg      = document.getElementById('auth-msg')

    btn.textContent = 'Signing in...'
    btn.disabled = true
    msg.classList.add('hidden')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    btn.textContent = 'Sign In'
    btn.disabled = false

    if (error) {
        msg.textContent = error.message
        msg.classList.remove('hidden')
        return
    }

    currentUser = data.user
    const profile = await getProfile(currentUser.id)
    if (!profile) {
        showScreen('profile')
    } else {
        setUserBadge(profile.display_name)
        showScreen('app')
        await loadFeed()
        setupRealtime()
    }
})

document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click()
})

// ── Profile setup (first login) ────────────────────────────────────────────
document.getElementById('save-name-btn').addEventListener('click', async () => {
    const name = document.getElementById('display-name').value.trim()
    if (!name) return
    await upsertProfile(currentUser.id, name)
    setUserBadge(name)
    showScreen('app')
    await loadFeed()
    setupRealtime()
})

document.getElementById('display-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-name-btn').click()
})

// ── Logout ─────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut()
    currentUser = null
    allReviews  = []
    showScreen('auth')
})

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
    renderCards(filtered, reviewsGrid, emptyState)
}

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
document.getElementById('add-review-btn').addEventListener('click', () => {
    resetModal()
    openModal()
})

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
init()
