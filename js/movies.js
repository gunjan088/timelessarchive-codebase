import { supabase } from './config.js'
import { fetchScreenReviews, insertScreenReview, deleteScreenReview, fetchWishlist, insertWishlistItem, deleteWishlistItem } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { renderSkeletons, showToast, openModal, closeModal } from './ui.js'
import { renderWishlistCards, openWishlistModal } from './wishlist.js'
import { escapeHtml, getTimeAgo } from './utils.js'

let currentUser = null
let allReviews  = []
let wishlistItems = []
let wishlistLoaded = false
let activeFilter = 'all'
let activeTypeFilter = ''
let searchQuery = ''
let selectedRating = null

const reviewsGrid = document.getElementById('reviews-grid')
const emptyState  = document.getElementById('empty-state')

function getRatingBadge(rating) {
    if (rating === 'Like')        return { badge: '🔥 Loved',   cls: 'bg-green-900/40 text-green-400 border-green-800/60' }
    if (rating === 'Dislike')     return { badge: '🚫 Skip',    cls: 'bg-red-900/40 text-red-400 border-red-800/60' }
    return                               { badge: '🤔 Once',    cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/60' }
}

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
        renderWishlistCards(wishlistItems, reviewsGrid, emptyState, handleMarkVisited)
        return
    }
    let filtered = allReviews
    if (activeFilter !== 'all') filtered = filtered.filter(r => r.rating === activeFilter)
    if (activeTypeFilter) filtered = filtered.filter(r => r.type === activeTypeFilter)
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

    if (!title)          return showToast('Enter a title', 'error')
    if (!selectedRating) return showToast('Pick a rating', 'error')

    btn.textContent = 'Saving...'
    btn.disabled = true
    try {
        await insertScreenReview({ userId: currentUser.id, title, type, platform, note, rating: selectedRating })
        showToast('Review saved! 🎬')
        closeModal()
        document.getElementById('movie-title').value = ''
        document.getElementById('movie-platform').value = ''
        document.getElementById('movie-note').value = ''
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
        selectedRating = null
        allReviews = await fetchScreenReviews()
        renderFiltered()
    } catch (err) {
        showToast(err.message || 'Failed to save', 'error')
    } finally {
        btn.textContent = 'Save Review'
        btn.disabled = false
    }
})

function wireNavButtons() {
    const addBtn = document.getElementById('add-review-btn')
    if (addBtn) {
        const fresh = addBtn.cloneNode(true)
        addBtn.parentNode.replaceChild(fresh, addBtn)
        fresh.addEventListener('click', () => {
            if (!currentUser) { window.location.href = '/index.html'; return }
            openModal()
        })
    }
    const wlBtn = document.getElementById('wishlist-add-btn')
    if (wlBtn) {
        const fresh = wlBtn.cloneNode(true)
        wlBtn.parentNode.replaceChild(fresh, wlBtn)
        fresh.addEventListener('click', () => {
            if (!currentUser) { window.location.href = '/index.html'; return }
            openWishlistModal('movies', ({ name, notes }) =>
                insertWishlistItem({ userId: currentUser.id, category: 'movies', name, notes })
                    .then(() => { wishlistLoaded = false })
            )
        })
    }
}

async function init() {
    renderNav('movies', false)
    await loadFeed()

    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user
    if (user) {
        renderNav('movies', true)
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
        if (profile) {
            renderNavUser(profile.display_name, { onLogout: async () => { await supabase.auth.signOut(); location.reload() }, showAddReview: true })
        }
        document.getElementById('movies-wishlist-chip')?.classList.remove('hidden')
        renderFiltered()
    }
    wireNavButtons()
}

init().catch(err => {
    console.error('Init failed:', err)
})
