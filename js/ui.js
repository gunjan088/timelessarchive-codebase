import { escapeHtml, getTimeAgo } from './utils.js'

const CUISINES = [
    'South Indian', 'North Indian', 'Cafe', 'Brewery',
    'Chinese', 'Italian', 'Seafood', 'Street Food', 'Other'
]

// ── Skeletons ──────────────────────────────────────────────────────────────
export function renderSkeletons(container, n = 6) {
    container.innerHTML = Array.from({ length: n }, () => `
        <div class="bg-gray-900 rounded-2xl border border-gray-800 p-4 space-y-3">
            <div class="flex justify-between items-start gap-2">
                <div class="skeleton h-4 w-2/3"></div>
                <div class="skeleton h-6 w-16 rounded-full"></div>
            </div>
            <div class="skeleton h-3 w-full mt-1"></div>
            <div class="skeleton h-10 w-full rounded-xl mt-2"></div>
            <div class="flex justify-between items-center mt-3 pt-3 border-t border-gray-800">
                <div class="flex gap-2 items-center">
                    <div class="skeleton h-6 w-6 rounded-full"></div>
                    <div class="skeleton h-3 w-16"></div>
                </div>
                <div class="skeleton h-3 w-10"></div>
            </div>
        </div>
    `).join('')
}

// ── Cards ──────────────────────────────────────────────────────────────────
export function renderCards(reviews, container, emptyState, currentUserId) {
    if (!reviews.length) {
        container.innerHTML = ''
        emptyState.classList.remove('hidden')
        return
    }
    emptyState.classList.add('hidden')
    container.innerHTML = reviews.map((r, i) => buildCard(r, i, currentUserId)).join('')
}

export function prependCard(review, container, emptyState) {
    emptyState.classList.add('hidden')
    const div = document.createElement('div')
    div.innerHTML = buildCard(review, 0)
    const card = div.firstElementChild
    card.classList.remove('review-card')
    card.classList.add('card-new-enter')
    container.prepend(card)
}

function buildCard(r, i, currentUserId) {
    const { badge, badgeClass } = getRatingBadge(r.rating)
    const timeAgo = getTimeAgo(r.created_at)
    const name = r.profiles?.display_name || 'Someone'
    const initial = name.charAt(0).toUpperCase()

    const notesHtml = r.notes
        ? `<p class="text-xs text-gray-400 mt-2 italic line-clamp-2">"${escapeHtml(r.notes)}"</p>`
        : ''

    const cuisineHtml = r.cuisine_type
        ? `<span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">${escapeHtml(r.cuisine_type)}</span>`
        : ''

    const shortAddr = r.restaurants.address.split(',').slice(1, 3).join(',').trim()

    return `
        <div class="review-card group bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-4 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5">
            <div class="flex items-start justify-between gap-2 mb-2">
                <a href="${escapeHtml(r.restaurants.google_maps_url)}" target="_blank" rel="noopener"
                    class="font-bold text-white hover:text-orange-400 transition-colors leading-tight line-clamp-2 flex-1 text-sm">
                    ${escapeHtml(r.restaurants.name)}
                </a>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeClass} whitespace-nowrap flex-shrink-0">
                    ${badge}
                </span>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap mb-2">
                ${cuisineHtml}
                ${shortAddr ? `<span class="text-xs text-gray-600 truncate">${escapeHtml(shortAddr)}</span>` : ''}
            </div>

            <div class="bg-gray-800/60 rounded-xl px-3 py-2.5 border border-gray-700/40">
                <p class="text-sm text-gray-200">🍴 <span class="font-medium">${escapeHtml(r.dish_name)}</span></p>
            </div>

            ${notesHtml}

            <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/80">
                <div class="flex items-center gap-1.5">
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        ${escapeHtml(initial)}
                    </div>
                    <span class="text-xs text-gray-400">${escapeHtml(name)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-600">${timeAgo}</span>
                    ${r.user_id === currentUserId ? `<button class="delete-btn opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-sm leading-none p-1 rounded hover:bg-red-400/10" data-id="${r.id}" title="Delete">✕</button>` : ''}
                </div>
            </div>
        </div>
    `
}

function getRatingBadge(rating) {
    if (rating === 'Like')    return { badge: '🔥 Loved', badgeClass: 'bg-green-900/40 text-green-400 border-green-800/60' }
    if (rating === 'Dislike') return { badge: '🚫 Skip',  badgeClass: 'bg-red-900/40 text-red-400 border-red-800/60' }
    return                           { badge: '🤔 Once',  badgeClass: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/60' }
}

// ── Cuisine pills (modal) ──────────────────────────────────────────────────
export function renderCuisinePills(container) {
    container.innerHTML = CUISINES.map(c => `
        <button class="cuisine-pill" data-cuisine="${c}">${c}</button>
    `).join('')
}

// ── Cuisine filter dropdown ────────────────────────────────────────────────
export function renderCuisineFilter(select, cuisines) {
    const current = select.value
    select.innerHTML = '<option value="">All Cuisines</option>' +
        cuisines.map(c => `<option value="${escapeHtml(c)}" ${current === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast')
    const inner = document.getElementById('toast-inner')
    clearTimeout(toastTimer)
    inner.className = type === 'success'
        ? 'flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium bg-green-900 border border-green-700 text-green-200'
        : 'flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium bg-red-900 border border-red-700 text-red-200'
    inner.textContent = message
    toast.classList.remove('hidden')
    toast.classList.add('flex')
    toastTimer = setTimeout(() => {
        toast.classList.add('hidden')
        toast.classList.remove('flex')
    }, 3000)
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function openModal() {
    const overlay = document.getElementById('modal-overlay')
    overlay.classList.remove('hidden')
    overlay.classList.add('flex')
    // Re-trigger entrance animation
    const card = document.getElementById('modal-card')
    card.style.animation = 'none'
    void card.offsetWidth
    card.style.animation = ''
}

export function closeModal() {
    const overlay = document.getElementById('modal-overlay')
    overlay.classList.add('hidden')
    overlay.classList.remove('flex')
}
