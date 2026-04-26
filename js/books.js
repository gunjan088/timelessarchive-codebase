import { supabase } from './config.js'
import { fetchBookReviews, insertBookReview, deleteBookReview } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { renderSkeletons, showToast, openModal, closeModal } from './ui.js'
import { escapeHtml, getTimeAgo } from './utils.js'

const GENRES = ['Fiction', 'Non-fiction', 'Sci-Fi', 'Fantasy', 'Biography', 'History', 'Self-help', 'Other']

let currentUser    = null
let allBooks       = []
let activeFilter   = 'all'
let activeGenreFilter = ''
let searchQuery    = ''
let selectedRating = null
let selectedGenre  = null
let activeModalTab = 'review'

const reviewsGrid = document.getElementById('reviews-grid')
const emptyState  = document.getElementById('empty-state')

// ── Badge helpers ─────────────────────────────────────────────────────────────
function getRatingBadge(rating) {
    if (rating === 'Like')         return { badge: '🔥 Loved',  cls: 'bg-green-900/40 text-green-400 border-green-800/60' }
    if (rating === 'Dislike')      return { badge: '🚫 Skip',   cls: 'bg-red-900/40 text-red-400 border-red-800/60' }
    if (rating === 'One-Time Try') return { badge: '🤔 Once',   cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/60' }
    return null
}

function getStatusBadge(status) {
    if (status === 'read')     return { badge: '📖 Read',         cls: 'bg-blue-900/40 text-blue-400 border-blue-800/60' }
    if (status === 'wishlist') return { badge: '🔖 Want to read', cls: 'bg-purple-900/40 text-purple-400 border-purple-800/60' }
    return null
}

// ── Cards ─────────────────────────────────────────────────────────────────────
function renderCards(books) {
    if (!books.length) { reviewsGrid.innerHTML = ''; emptyState.classList.remove('hidden'); return }
    emptyState.classList.add('hidden')
    reviewsGrid.innerHTML = books.map(r => {
        const ratingBadge = r.rating ? getRatingBadge(r.rating) : null
        const statusBadge = !ratingBadge ? getStatusBadge(r.status) : null
        const badge = ratingBadge || statusBadge
        const name = r.profiles?.display_name || 'Someone'
        return `
            <div class="group bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-4 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="font-bold text-white text-sm flex-1 leading-tight">${escapeHtml(r.title)}</span>
                    ${badge ? `<span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.cls} whitespace-nowrap flex-shrink-0">${badge.badge}</span>` : ''}
                </div>
                <div class="flex items-center gap-1.5 flex-wrap mb-3">
                    ${r.author ? `<span class="text-xs text-gray-400 italic">${escapeHtml(r.author)}</span>` : ''}
                    ${r.genre ? `<span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">${escapeHtml(r.genre)}</span>` : ''}
                    ${r.goodreads_rating ? `<span class="text-xs text-green-400">★ ${escapeHtml(r.goodreads_rating)}</span>` : ''}
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

// ── Genre pills ───────────────────────────────────────────────────────────────
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

// ── Filter ────────────────────────────────────────────────────────────────────
function renderFiltered() {
    let filtered = allBooks
    const thisYear = new Date().getFullYear()

    if (activeFilter === 'this-year') {
        filtered = filtered.filter(r =>
            (r.status === 'read' || r.status === 'review') &&
            new Date(r.created_at).getFullYear() === thisYear
        )
        // read is private — only show current user's
        filtered = filtered.filter(r => r.status === 'review' || r.user_id === currentUser?.id)
    } else if (activeFilter === 'all') {
        // review = public, read/wishlist = private (current user only)
        filtered = filtered.filter(r => r.status === 'review' || r.user_id === currentUser?.id)
    } else if (activeFilter === 'read' || activeFilter === 'wishlist') {
        filtered = filtered.filter(r => r.status === activeFilter && r.user_id === currentUser?.id)
    } else {
        filtered = filtered.filter(r => r.status === activeFilter)
    }

    if (activeGenreFilter) filtered = filtered.filter(r => r.genre === activeGenreFilter)
    if (searchQuery) {
        const q = searchQuery.toLowerCase()
        filtered = filtered.filter(r =>
            (r.title || '').toLowerCase().includes(q) ||
            (r.author || '').toLowerCase().includes(q)
        )
    }
    renderCards(filtered)
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function loadFeed() {
    renderSkeletons(reviewsGrid, 6)
    try {
        allBooks = await fetchBookReviews()
        renderFiltered()
    } catch (err) {
        showToast('Failed to load', 'error')
        reviewsGrid.innerHTML = ''
        emptyState.classList.remove('hidden')
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────
reviewsGrid.addEventListener('click', async e => {
    const btn = e.target.closest('.delete-btn')
    if (!btn) return
    btn.textContent = '...'
    btn.disabled = true
    try {
        await deleteBookReview(btn.dataset.id)
        allBooks = allBooks.filter(r => r.id !== btn.dataset.id)
        renderFiltered()
        showToast('Deleted')
    } catch (err) {
        showToast('Failed to delete', 'error')
        btn.textContent = '✕'
        btn.disabled = false
    }
})

// ── Filters ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        activeFilter = btn.dataset.filter
        renderFiltered()
    })
})

document.getElementById('genre-filter').addEventListener('change', e => { activeGenreFilter = e.target.value; renderFiltered() })
document.getElementById('search-filter').addEventListener('input', e => { searchQuery = e.target.value; renderFiltered() })

// ── Modal tab switching ───────────────────────────────────────────────────────
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
    document.getElementById('tab-read').classList.toggle('hidden', tab !== 'read')
    document.getElementById('tab-wishlist').classList.toggle('hidden', tab !== 'wishlist')
}

// ── Modal ─────────────────────────────────────────────────────────────────────
document.getElementById('modal-close').addEventListener('click', closeModal)
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-overlay')) closeModal() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => switchModalTab(btn.dataset.tab))
})

document.querySelectorAll('.rating-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
        btn.classList.add('selected')
        selectedRating = btn.dataset.value
    })
})

// Review submit
document.getElementById('submit-btn').addEventListener('click', async () => {
    const title  = document.getElementById('book-title').value.trim()
    const author = document.getElementById('book-author').value.trim()
    const note   = document.getElementById('book-note').value.trim()
    const btn    = document.getElementById('submit-btn')
    if (!currentUser) { showToast('Sign in to add', 'error'); return }

    if (!title)          return showToast('Enter a title', 'error')
    if (!selectedRating) return showToast('Pick a rating', 'error')

    btn.textContent = 'Saving...'
    btn.disabled = true
    try {
        await insertBookReview({ userId: currentUser.id, title, author, genre: selectedGenre, note, rating: selectedRating, status: 'review' })
        showToast('Review saved! 📚')
        closeModal()
        document.getElementById('book-title').value = ''
        document.getElementById('book-author').value = ''
        document.getElementById('book-note').value = ''
        document.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'))
        selectedRating = null
        selectedGenre = null
        allBooks = await fetchBookReviews()
        renderFiltered()
    } catch (err) {
        showToast(err.message || 'Failed to save', 'error')
    } finally {
        btn.textContent = 'Save Review'
        btn.disabled = false
    }
})

// Read submit
document.getElementById('read-submit-btn').addEventListener('click', async () => {
    const title          = document.getElementById('read-title').value.trim()
    const author         = document.getElementById('read-author').value.trim()
    const note           = document.getElementById('read-note').value.trim()
    const genre          = document.getElementById('read-genre').value || null
    const goodreadsRating = document.getElementById('read-goodreads').value.trim() || null
    const btn            = document.getElementById('read-submit-btn')
    if (!currentUser) { showToast('Sign in to add', 'error'); return }

    if (!title) return showToast('Enter a title', 'error')

    btn.textContent = 'Saving...'
    btn.disabled = true
    try {
        await insertBookReview({ userId: currentUser.id, title, author, genre, note, status: 'read', goodreadsRating })
        showToast('Marked as read! 📖')
        closeModal()
        document.getElementById('read-title').value = ''
        document.getElementById('read-author').value = ''
        document.getElementById('read-genre').value = ''
        document.getElementById('read-goodreads').value = ''
        document.getElementById('read-note').value = ''
        allBooks = await fetchBookReviews()
        renderFiltered()
    } catch (err) {
        showToast(err.message || 'Failed to save', 'error')
    } finally {
        btn.textContent = 'Mark as Read'
        btn.disabled = false
    }
})

// Wishlist submit
document.getElementById('wl-submit-btn').addEventListener('click', async () => {
    const title  = document.getElementById('wl-title').value.trim()
    const author = document.getElementById('wl-author').value.trim()
    const btn    = document.getElementById('wl-submit-btn')
    if (!currentUser) { showToast('Sign in to add', 'error'); return }

    if (!title) return showToast('Enter a title', 'error')

    btn.textContent = 'Saving...'
    btn.disabled = true
    try {
        await insertBookReview({ userId: currentUser.id, title, author, status: 'wishlist' })
        showToast('Added to wishlist 🔖')
        closeModal()
        document.getElementById('wl-title').value = ''
        document.getElementById('wl-author').value = ''
        allBooks = await fetchBookReviews()
        renderFiltered()
    } catch (err) {
        showToast(err.message || 'Failed to save', 'error')
    } finally {
        btn.textContent = 'Add to Wishlist'
        btn.disabled = false
    }
})

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user

    if (user) {
        renderNav('books', true)
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
        if (profile) {
            renderNavUser(profile.display_name, { onLogout: async () => { await supabase.auth.signOut(); location.reload() } })
        }
    } else {
        renderNav('books', false)
        // Wire sign-in button to redirect to home
        const signInBtn = document.getElementById('sign-in-btn')
        if (signInBtn) signInBtn.addEventListener('click', () => { window.location.href = '/' })
    }

    // Wire + Add button
    const addBtn = document.getElementById('add-btn')
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (!currentUser) { showToast('Sign in to add', 'error'); return }
            switchModalTab('review')
            selectedGenre = null
            selectedRating = null
            renderGenrePills()
            openModal()
        })
    }

    await loadFeed()
}

init().catch(err => { console.error('Init failed:', err) })
