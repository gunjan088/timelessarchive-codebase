import { supabase } from './config.js'
import {
    fetchReviews, insertRestaurant, insertReview,
    getProfile, upsertProfile, getUniqueCuisines, subscribeToReviews, deleteReview,
    fetchWishlist, insertWishlistItem, deleteWishlistItem
} from './db.js'
import {
    renderSkeletons, renderCards, renderCuisinePills,
    renderCuisineFilter, showToast, openModal, closeModal
} from './ui.js'
import { renderNav, renderNavUser } from './nav.js'
import { renderWishlistCards, openWishlistModal } from './wishlist.js'
import { escapeHtml } from './utils.js'

// ── State ──────────────────────────────────────────────────────────────────
let currentUser   = null
let selectedPlace = null
let selectedRating = null
let selectedCuisine = null
let allReviews    = []
let activeFilter  = 'all'
let activeCuisineFilter = ''
let searchQuery   = ''
let wishlistItems = []
let wishlistLoaded = false

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
    showScreen('app')

    // Resolve auth before rendering nav — prevents Add Review button from
    // briefly existing with currentUser=null and redirecting logged-in users
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        currentUser = user
        const profile = await getProfile(user.id)
        if (!profile) {
            showScreen('profile')
            return
        }
        renderNav('food', true)
        renderNavUser(profile.display_name, { onLogout: logoutHandler })
        document.getElementById('wishlist-chip')?.classList.remove('hidden')
    } else {
        renderNav('food', false)
        // If arrived via Sign In link from another page, show auth screen directly
        const returnPath = new URLSearchParams(window.location.search).get('return')
        if (returnPath) {
            showScreen('auth')
            return
        }
    }

    wireButtons()
    await loadFeed()
    setupRealtime()
}

// ── Email OTP auth ─────────────────────────────────────────────────────────
let pendingEmail = null

document.getElementById('send-otp-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim()
    const btn   = document.getElementById('send-otp-btn')
    const msg   = document.getElementById('auth-msg')

    msg.classList.add('hidden')
    if (!email) { msg.textContent = 'Enter your email'; msg.classList.remove('hidden'); return }

    btn.disabled = true
    btn.textContent = 'Sending...'
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
        msg.textContent = error.message
        msg.classList.remove('hidden')
        btn.textContent = 'Send Code'
        btn.disabled = false
        return
    }

    pendingEmail = email
    document.getElementById('email-display').textContent = email
    document.getElementById('email-step').classList.add('hidden')
    document.getElementById('otp-step').classList.remove('hidden')
    btn.textContent = 'Send Code'
    btn.disabled = false
})

document.getElementById('email').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('send-otp-btn').click()
})

document.getElementById('verify-otp-btn').addEventListener('click', async () => {
    const token = document.getElementById('otp-code').value.trim()
    const btn   = document.getElementById('verify-otp-btn')
    const msg   = document.getElementById('auth-msg')

    msg.classList.add('hidden')
    if (token.length < 6) { msg.textContent = 'Enter the 6-digit code'; msg.classList.remove('hidden'); return }

    btn.disabled = true
    btn.textContent = 'Verifying...'
    const { data, error } = await supabase.auth.verifyOtp({ email: pendingEmail, token, type: 'email' })
    if (error) {
        msg.textContent = error.message
        msg.classList.remove('hidden')
        btn.textContent = 'Verify'
        btn.disabled = false
        return
    }

    currentUser = data.user
    btn.textContent = 'Verify'
    btn.disabled = false
    const profile = await getProfile(currentUser.id)
    if (!profile) { showScreen('profile'); return }
    await enterApp(profile.display_name)
})

document.getElementById('otp-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('verify-otp-btn').click()
})

document.getElementById('change-email-btn').addEventListener('click', () => {
    document.getElementById('otp-step').classList.add('hidden')
    document.getElementById('email-step').classList.remove('hidden')
    document.getElementById('auth-msg').classList.add('hidden')
    document.getElementById('otp-code').value = ''
    pendingEmail = null
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
    document.getElementById('wishlist-chip')?.classList.add('hidden')
    if (activeFilter === 'wishlist') {
        activeFilter = 'all'
    }
    // Re-render cards to remove delete buttons
    renderFiltered()
}

let activeModalTab = 'review'

function switchModalTab(tab) {
    if (!tab) return
    activeModalTab = tab
    document.querySelectorAll('.modal-tab').forEach(btn => {
        const isActive = btn.dataset.tab === tab
        btn.classList.toggle('text-orange-400', isActive)
        btn.classList.toggle('border-b-2', isActive)
        btn.classList.toggle('border-orange-400', isActive)
        btn.classList.toggle('-mb-px', isActive)
        btn.classList.toggle('text-gray-500', !isActive)
    })
    document.getElementById('tab-review').classList.toggle('hidden', tab !== 'review')
    document.getElementById('tab-wishlist').classList.toggle('hidden', tab !== 'wishlist')
}

function wireButtons() {
    // + Add button (always visible in filter bar)
    const addBtn = document.getElementById('add-btn')
    if (addBtn) {
        const fresh = addBtn.cloneNode(true)
        addBtn.parentNode.replaceChild(fresh, addBtn)
        fresh.addEventListener('click', () => {
            if (!currentUser) { showToast('Sign in to add', 'error'); return }
            resetModal()
            switchModalTab('review')
            openModal()
        })
    }

    // Modal tabs
    document.querySelectorAll('.modal-tab').forEach(btn => {
        btn.addEventListener('click', () => switchModalTab(btn.dataset.tab))
    })

    // Wishlist submit
    const wlSubmit = document.getElementById('wl-submit-btn')
    if (wlSubmit) {
        const fresh = wlSubmit.cloneNode(true)
        wlSubmit.parentNode.replaceChild(fresh, wlSubmit)
        fresh.addEventListener('click', async () => {
            const name = document.getElementById('wl-name').value.trim()
            if (!name) { showToast('Enter a name', 'error'); return }
            fresh.textContent = 'Saving...'
            fresh.disabled = true
            try {
                await insertWishlistItem({ userId: currentUser.id, category: 'food', name, notes: document.getElementById('wl-notes').value.trim() })
                showToast('Added to wishlist 🔖')
                wishlistLoaded = false
                closeModal()
                document.getElementById('wl-name').value = ''
                document.getElementById('wl-notes').value = ''
            } catch (err) {
                showToast('Failed to save', 'error')
            } finally {
                fresh.textContent = 'Save to Wishlist'
                fresh.disabled = false
            }
        })
    }
}

async function enterApp(displayName) {
    // If user signed in from another page, send them back
    const returnPath = new URLSearchParams(window.location.search).get('return')
    if (returnPath && returnPath.startsWith('/') && !returnPath.startsWith('//')) {
        window.location.href = returnPath
        return
    }

    showScreen('app')
    renderNav('food', true)
    renderNavUser(displayName, { onLogout: logoutHandler })
    wireButtons()
    document.getElementById('wishlist-chip')?.classList.remove('hidden')
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
    if (activeFilter === 'wishlist') {
        renderWishlistCards(wishlistItems, reviewsGrid, emptyState, handleMarkVisited, (id) => {
            wishlistItems = wishlistItems.filter(i => i.id !== id)
        })
        return
    }
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

async function loadWishlist() {
    renderSkeletons(reviewsGrid, 3)
    try {
        wishlistItems = await fetchWishlist('food')
        wishlistLoaded = true
        renderFiltered()
    } catch (err) {
        showToast('Failed to load wishlist', 'error')
        renderCards([], reviewsGrid, emptyState)
    }
}

async function handleMarkVisited(wishlistId, name) {
    await deleteWishlistItem(wishlistId)
    wishlistItems = wishlistItems.filter(i => i.id !== wishlistId)
    wishlistLoaded = false
    resetModal()
    document.getElementById('restaurant-search').value = name
    openModal()
    showToast(`Opening review for "${name}"`)
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
        if (activeFilter === 'wishlist' && !wishlistLoaded) { loadWishlist(); return }
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
    document.getElementById('manual-entry-row').classList.add('hidden')
    document.getElementById('manual-restaurant-name').value = ''
    document.getElementById('manual-confirm-msg').classList.add('hidden')
    switchModalTab('review')
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
                        <div class="font-semibold text-white text-sm">${escapeHtml(shortName)}</div>
                        <div class="text-xs text-gray-400 truncate mt-0.5">${escapeHtml(place.display_name)}</div>
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

// ── Manual restaurant entry ────────────────────────────────────────────────
document.getElementById('add-manually-btn').addEventListener('click', () => {
    const row = document.getElementById('manual-entry-row')
    const isHidden = row.classList.contains('hidden')
    row.classList.toggle('hidden')
    if (isHidden) {
        // Pre-fill with whatever is already typed in the search box
        const nameInput = document.getElementById('manual-restaurant-name')
        nameInput.value = searchInput.value
        nameInput.focus()
        searchResults.classList.add('hidden')
        if (nameInput.value) {
            selectedPlace = { name: nameInput.value, address: 'Added manually', url: null }
            document.getElementById('manual-confirm-msg').classList.remove('hidden')
        }
    } else {
        // Toggled off — clear manual selection if it was set manually
        if (selectedPlace?.address === 'Added manually') selectedPlace = null
        document.getElementById('manual-confirm-msg').classList.add('hidden')
    }
})

document.getElementById('manual-restaurant-name').addEventListener('input', e => {
    const name = e.target.value.trim()
    if (name) {
        selectedPlace = { name, address: 'Added manually', url: null }
        document.getElementById('manual-confirm-msg').classList.remove('hidden')
    } else {
        selectedPlace = null
        document.getElementById('manual-confirm-msg').classList.add('hidden')
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
