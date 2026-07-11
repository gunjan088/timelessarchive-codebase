import { supabase } from './config.js'
import { fetchScreenReviews, insertScreenReview, deleteScreenReview, fetchWishlist, insertWishlistItem, deleteWishlistItem, getProfile } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { renderSkeletons, showToast, openModal, closeModal } from './ui.js'
import { renderWishlistCards } from './wishlist.js'
import { escapeHtml, getTimeAgo, getRatingBadge } from './utils.js'

const GENRES = ['Action', 'Comedy', 'Drama', 'Thriller', 'Horror', 'Sci-Fi', 'Romance', 'Animation', 'Crime', 'Fantasy', 'Other']

let currentUser = null
let allReviews  = []
let wishlistItems = []
let wishlistLoaded = false
let activeFilter = 'all'
let activeTypeFilter = ''
let activeGenreFilter = ''
let searchQuery = ''
let selectedRating = null
let selectedGenre = null

const reviewsGrid = document.getElementById('reviews-grid')
const emptyState  = document.getElementById('empty-state')

function renderCards(reviews) {
    if (!reviews.length) { reviewsGrid.innerHTML = ''; emptyState.classList.remove('hidden'); return }
    emptyState.classList.add('hidden')
    reviewsGrid.innerHTML = reviews.map(r => {
        const { badge, cls } = getRatingBadge(r.rating)
        const name = r.profiles?.display_name || 'Someone'
        return `
            <div class="group bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-4 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="font-bold text-white text-sm flex-1 leading-tight">${escapeHtml(r.title)}</span>
                    <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${cls} whitespace-nowrap flex-shrink-0">${badge}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap mb-3">
                    <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">${escapeHtml(r.type)}</span>
                    ${r.genre ? `<span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">${escapeHtml(r.genre)}</span>` : ''}
                    ${r.platform ? `<span class="text-xs text-gray-500">${escapeHtml(r.platform)}</span>` : ''}
                </div>
                ${r.note ? `<div class="bg-gray-800/60 rounded-xl px-3 py-2.5 border border-gray-700/40 mb-2"><p class="text-sm text-gray-200 italic">"${escapeHtml(r.note)}"</p></div>` : ''}
                <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/80">
                    <div class="flex items-center gap-1.5">
                        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold">${escapeHtml(name.charAt(0).toUpperCase())}</div>
                        <span class="text-xs text-gray-400">${escapeHtml(name)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-600">${getTimeAgo(r.created_at)}</span>
                        ${r.user_id === currentUser?.id ? `<button class="delete-btn opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-sm p-1 rounded hover:bg-red-400/10" data-id="${escapeHtml(r.id)}">✕</button>` : ''}
                    </div>
                </div>
            </div>
        `
    }).join('')
}

function renderFiltered() {
    if (activeFilter === 'wishlist') {
        let filtered = wishlistItems
        if (activeTypeFilter) filtered = filtered.filter(i => i.item_type === activeTypeFilter)
        if (activeGenreFilter) filtered = filtered.filter(i => i.item_genre === activeGenreFilter)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(q))
        }
        renderWishlistCards(filtered, reviewsGrid, emptyState, handleMarkVisited, (id) => {
            wishlistItems = wishlistItems.filter(i => i.id !== id)
        })
        return
    }
    let filtered = allReviews
    if (activeFilter !== 'all') filtered = filtered.filter(r => r.rating === activeFilter)
    if (activeTypeFilter) filtered = filtered.filter(r => r.type === activeTypeFilter)
    if (activeGenreFilter) filtered = filtered.filter(r => r.genre === activeGenreFilter)
    if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(r => r.title.toLowerCase().includes(q))
    }
    renderCards(filtered)
}

async function handleMarkVisited(wishlistId) {
    await deleteWishlistItem(wishlistId)
    wishlistItems = wishlistItems.filter(i => i.id !== wishlistId)
    wishlistLoaded = false
    showToast('Removed from wishlist')
}

async function loadFeed() {
    renderSkeletons(reviewsGrid, 6)
    try {
        allReviews = await fetchScreenReviews()
        renderFiltered()
    } catch (err) {
        showToast('Failed to load', 'error')
        reviewsGrid.innerHTML = ''
        emptyState.classList.remove('hidden')
    }
}

async function loadWishlist() {
    renderSkeletons(reviewsGrid, 3)
    try {
        wishlistItems = await fetchWishlist('movies')
        wishlistLoaded = true
        renderFiltered()
    } catch (err) {
        showToast('Failed to load wishlist', 'error')
    }
}

// ── Delete ─────────────────────────────────────────────────────────────────
reviewsGrid.addEventListener('click', async e => {
    const btn = e.target.closest('.delete-btn')
    if (!btn) return
    btn.textContent = '...'
    btn.disabled = true
    try {
        await deleteScreenReview(btn.dataset.id)
        allReviews = allReviews.filter(r => r.id !== btn.dataset.id)
        renderFiltered()
        showToast('Review deleted')
    } catch (err) {
        showToast('Failed to delete', 'error')
        btn.textContent = '✕'
        btn.disabled = false
    }
})

function renderGenrePills() {
    const container = document.getElementById('genre-pills')
    if (!container) return
    container.innerHTML = GENRES.map(g => `
        <button class="genre-pill cuisine-pill${selectedGenre === g ? ' selected' : ''}" data-genre="${g}">${g}</button>
    `).join('')
    container.querySelectorAll('.genre-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedGenre = selectedGenre === btn.dataset.genre ? null : btn.dataset.genre
            container.querySelectorAll('.genre-pill').forEach(p =>
                p.classList.toggle('selected', p.dataset.genre === selectedGenre)
            )
        })
    })
}

// ── Filters ────────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        activeFilter = btn.dataset.filter
        if (activeFilter === 'wishlist' && !wishlistLoaded) { loadWishlist(); return }
        renderFiltered()
    })
})

document.getElementById('type-filter').addEventListener('change', e => { activeTypeFilter = e.target.value; renderFiltered() })
document.getElementById('genre-filter').addEventListener('change', e => { activeGenreFilter = e.target.value; renderFiltered() })
document.getElementById('search-filter').addEventListener('input', e => { searchQuery = e.target.value; renderFiltered() })

// ── Modal ──────────────────────────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeModal)
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-overlay')) closeModal() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
        btn.classList.add('selected')
        selectedRating = btn.dataset.value
    })
})

document.getElementById('submit-btn').addEventListener('click', async () => {
    const title = document.getElementById('movie-title').value.trim()
    const type  = document.getElementById('movie-type').value
    const platform = document.getElementById('movie-platform').value.trim()
    const note  = document.getElementById('movie-note').value.trim()
    const btn   = document.getElementById('submit-btn')

    if (!currentUser)    return showToast('Sign in to add', 'error')
    if (!title)          return showToast('Enter a title', 'error')
    if (!selectedRating) return showToast('Pick a rating', 'error')

    btn.textContent = 'Saving...'
    btn.disabled = true
    try {
        await insertScreenReview({ userId: currentUser.id, title, type, platform, note, rating: selectedRating, genre: selectedGenre })
        showToast('Review saved! 🎬')
        closeModal()
        document.getElementById('movie-title').value = ''
        document.getElementById('movie-platform').value = ''
        document.getElementById('movie-note').value = ''
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
        selectedRating = null
        selectedGenre = null
        allReviews = await fetchScreenReviews()
        renderFiltered()
    } catch (err) {
        showToast(err.message || 'Failed to save', 'error')
    } finally {
        btn.textContent = 'Save Review'
        btn.disabled = false
    }
})

function switchModalTab(tab) {
    if (!tab) return
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
    // + Add button
    const addBtn = document.getElementById('add-btn')
    if (addBtn) {
        const fresh = addBtn.cloneNode(true)
        addBtn.parentNode.replaceChild(fresh, addBtn)
        fresh.addEventListener('click', () => {
            if (!currentUser) { showToast('Sign in to add', 'error'); return }
            switchModalTab('review')
            selectedGenre = null
            renderGenrePills()
            openModal()
        })
    }

    // Modal tabs
    document.querySelectorAll('.modal-tab').forEach(btn => {
        btn.addEventListener('click', () => switchModalTab(btn.dataset.tab))
    })

    // Watchlist submit
    const wlSubmit = document.getElementById('wl-submit-btn')
    if (wlSubmit) {
        const freshWl = wlSubmit.cloneNode(true)
        wlSubmit.parentNode.replaceChild(freshWl, wlSubmit)
        freshWl.addEventListener('click', async () => {
            const name = document.getElementById('wl-name').value.trim()
            if (!name) { showToast('Enter a title', 'error'); return }
            if (!currentUser) { showToast('Sign in to add', 'error'); return }
            freshWl.textContent = 'Saving...'
            freshWl.disabled = true
            try {
                await insertWishlistItem({
                    userId: currentUser.id, category: 'movies', name,
                    notes: document.getElementById('wl-notes').value.trim(),
                    itemType: document.getElementById('wl-type').value || null,
                    itemGenre: document.getElementById('wl-genre').value || null,
                    imdbRating: document.getElementById('wl-imdb').value.trim() || null,
                    rtRating: document.getElementById('wl-rt').value.trim() || null
                })
                showToast('Added to watchlist 🔖')
                wishlistLoaded = false
                closeModal()
                document.getElementById('wl-name').value = ''
                document.getElementById('wl-notes').value = ''
                document.getElementById('wl-type').value = ''
                document.getElementById('wl-genre').value = ''
                document.getElementById('wl-imdb').value = ''
                document.getElementById('wl-rt').value = ''
            } catch (err) {
                showToast('Failed to save', 'error')
            } finally {
                freshWl.textContent = 'Save to Watchlist'
                freshWl.disabled = false
            }
        })
    }
}

async function init() {
    // 1. Subscribe to auth state changes so session expiry is handled reactively
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return
        currentUser = session?.user ?? null
        renderNav('movies', !!currentUser)
        if (currentUser) {
            renderNavUser(currentUser.user_metadata?.display_name || currentUser.email, { onLogout: async () => { await supabase.auth.signOut(); location.reload() } })
        }
    })

    // 2. Resolve auth first
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user

    // 3. Render nav once with correct logged-in state
    if (user) {
        renderNav('movies', true)
        const profile = await getProfile(user.id)
        if (profile) {
            renderNavUser(profile.display_name, { onLogout: async () => { await supabase.auth.signOut(); location.reload() } })
        }
        document.getElementById('movies-wishlist-chip')?.classList.remove('hidden')
    } else {
        renderNav('movies', false)
    }

    // 4. Wire buttons (currentUser is now set)
    wireButtons()

    // 5. Load data
    await loadFeed()
}

init().catch(err => {
    console.error('Init failed:', err)
})
