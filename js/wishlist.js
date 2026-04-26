import { deleteWishlistItem } from './db.js'
import { showToast } from './ui.js'
import { escapeHtml, getTimeAgo } from './utils.js'

export function renderWishlistCards(items, container, emptyState, onMarkVisited) {
    if (!items.length) {
        container.innerHTML = ''
        emptyState.classList.remove('hidden')
        return
    }
    emptyState.classList.add('hidden')
    container.innerHTML = items.map(item => `
        <div class="wishlist-card group bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-orange-800/40 p-4 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40">
            <div class="flex items-start justify-between gap-2 mb-2">
                <span class="font-bold text-white text-sm flex-1">${escapeHtml(item.name)}</span>
                <span class="text-xs bg-orange-900/30 text-orange-400 border border-orange-800/40 px-2 py-0.5 rounded-full flex-shrink-0">🔖 Wishlist</span>
            </div>
            ${item.notes ? `<p class="text-xs text-gray-400 italic mb-3">"${escapeHtml(item.notes)}"</p>` : ''}
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/80">
                <button class="mark-visited-btn text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}">
                    ✓ Mark as visited
                </button>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-600">${getTimeAgo(item.created_at)}</span>
                    <button class="delete-wishlist-btn opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-sm" data-id="${escapeHtml(item.id)}">✕</button>
                </div>
            </div>
        </div>
    `).join('')

    container.querySelectorAll('.mark-visited-btn').forEach(btn => {
        btn.addEventListener('click', () => onMarkVisited(btn.dataset.id, btn.dataset.name))
    })

    container.querySelectorAll('.delete-wishlist-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await deleteWishlistItem(btn.dataset.id)
                showToast('Removed from wishlist')
                btn.closest('.wishlist-card').remove()
            } catch (err) { showToast('Failed to remove', 'error') }
        })
    })
}

export function openWishlistModal(category, onSave) {
    const existing = document.getElementById('wishlist-modal-overlay')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'wishlist-modal-overlay'
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'
    overlay.innerHTML = `
        <div class="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-sm shadow-2xl p-5 space-y-3">
            <div class="flex items-center justify-between">
                <h3 class="font-bold text-base">Add to Wishlist</h3>
                <button id="wl-close" class="text-gray-500 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800">&times;</button>
            </div>
            <input id="wl-name" type="text" placeholder="Name (e.g. Toit Brewpub)" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm">
            <textarea id="wl-notes" placeholder="Notes (optional)" rows="2" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm resize-none"></textarea>
            <button id="wl-save" class="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold p-3 rounded-xl transition-all text-sm">Save to Wishlist 🔖</button>
            <p id="wl-msg" class="text-red-400 text-xs text-center hidden"></p>
        </div>
    `
    document.body.appendChild(overlay)

    const close = () => overlay.remove()
    document.getElementById('wl-close').addEventListener('click', close)
    overlay.addEventListener('click', e => { if (e.target === overlay) close() })

    document.getElementById('wl-save').addEventListener('click', async () => {
        const name = document.getElementById('wl-name').value.trim()
        const notes = document.getElementById('wl-notes').value.trim()
        const msg = document.getElementById('wl-msg')
        if (!name) { msg.textContent = 'Enter a name'; msg.classList.remove('hidden'); return }
        msg.classList.add('hidden')
        const btn = document.getElementById('wl-save')
        btn.textContent = 'Saving...'
        btn.disabled = true
        try {
            await onSave({ name, notes, category })
            showToast('Added to wishlist 🔖')
            close()
        } catch (err) {
            msg.textContent = err.message || 'Failed to save'
            msg.classList.remove('hidden')
            btn.textContent = 'Save to Wishlist 🔖'
            btn.disabled = false
        }
    })

    setTimeout(() => document.getElementById('wl-name')?.focus(), 50)
}
