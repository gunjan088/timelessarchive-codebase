import { supabase } from './config.js'
import { fetchTravelPosts, deleteTravelPost, fetchWishlist, insertWishlistItem, deleteWishlistItem } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'
import { renderWishlistCards, openWishlistModal } from './wishlist.js'
import { escapeHtml, formatDate } from './utils.js'

let currentUser = null
let wishlistItems = []
let wishlistLoaded = false
let activeFilter = 'all'

function getExcerpt(content, maxLen = 160) {
    return content.length > maxLen ? content.slice(0, maxLen).trimEnd() + '…' : content
}

function renderPosts(posts) {
    const grid = document.getElementById('posts-grid')
    const empty = document.getElementById('empty-state')
    if (!posts.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return }
    empty.classList.add('hidden')
    grid.innerHTML = posts.map(p => `
        <a href="/travel/post.html?id=${escapeHtml(p.id)}" class="block bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5 group">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">📍 ${escapeHtml(p.destination)}</span>
                        <span class="text-xs text-gray-600">${formatDate(p.created_at)}</span>
                    </div>
                    <h2 class="text-xl font-bold text-white group-hover:text-orange-400 transition-colors mb-2">${escapeHtml(p.title)}</h2>
                    <p class="text-gray-400 text-sm leading-relaxed">${escapeHtml(getExcerpt(p.content))}</p>
                </div>
            </div>
            ${currentUser?.id === p.user_id ? `
            <div class="flex gap-3 mt-4 pt-4 border-t border-gray-800" onclick="event.stopPropagation(); event.preventDefault()">
                <a href="/travel/write.html?id=${escapeHtml(p.id)}" class="text-xs text-gray-500 hover:text-orange-400 transition-colors">Edit</a>
                <button class="delete-post-btn text-xs text-gray-500 hover:text-red-400 transition-colors" data-id="${escapeHtml(p.id)}">Delete</button>
            </div>` : ''}
        </a>
    `).join('')
}

async function loadPosts() {
    document.getElementById('posts-grid').innerHTML = '<div class="space-y-4">' + Array(3).fill('<div class="bg-gray-900 rounded-2xl border border-gray-800 p-6"><div class="skeleton h-4 w-1/4 mb-3"></div><div class="skeleton h-6 w-2/3 mb-2"></div><div class="skeleton h-4 w-full"></div></div>').join('') + '</div>'
    try {
        const posts = await fetchTravelPosts()
        renderPosts(posts)
    } catch (err) {
        document.getElementById('posts-grid').innerHTML = ''
        document.getElementById('empty-state').classList.remove('hidden')
        showToast('Failed to load posts', 'error')
    }
}

async function loadTravelWishlist() {
    const postsGrid = document.getElementById('posts-grid')
    postsGrid.innerHTML = '<p class="text-gray-600 text-sm col-span-full text-center py-8">Loading...</p>'
    try {
        wishlistItems = await fetchWishlist('travel')
        wishlistLoaded = true
        renderWishlistCards(wishlistItems, postsGrid, document.getElementById('empty-state'), handleMarkVisited)
    } catch (err) {
        showToast('Failed to load wishlist', 'error')
    }
}

function handleMarkVisited(wishlistId) {
    deleteWishlistItem(wishlistId).catch(() => showToast('Failed to remove', 'error'))
    wishlistItems = wishlistItems.filter(i => i.id !== wishlistId)
    wishlistLoaded = false
    showToast('Removed from wishlist')
}

async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user
    renderNav('travel', !!user)

    if (user) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
        if (profile) {
            renderNavUser(profile.display_name, {
                onLogout: async () => { await supabase.auth.signOut(); window.location.href = '/index.html' }
            })
        }
        const newPostBtn = document.getElementById('new-post-btn')
        if (newPostBtn) {
            newPostBtn.classList.remove('hidden')
            newPostBtn.addEventListener('click', () => { window.location.href = '/travel/write.html' })
        }

        document.getElementById('travel-wishlist-chip')?.classList.remove('hidden')

        // Add wishlist button
        const wlBtn = document.createElement('button')
        wlBtn.className = 'text-gray-500 hover:text-orange-400 transition-colors text-sm px-3 py-2 rounded-xl hover:bg-gray-800'
        wlBtn.textContent = '🔖 Add to Wishlist'
        wlBtn.addEventListener('click', () => {
            openWishlistModal('travel', ({ name, notes }) =>
                insertWishlistItem({ userId: currentUser.id, category: 'travel', name, notes })
                    .then(() => { wishlistLoaded = false; showToast('Added to wishlist 🔖') })
            )
        })
        // Append to the actions area (the flex div that has the "+ New Post" button)
        const actionsDiv = document.querySelector('#new-post-btn')?.parentElement
        if (actionsDiv) actionsDiv.appendChild(wlBtn)
    }

    document.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            activeFilter = btn.dataset.filter
            if (activeFilter === 'wishlist') {
                if (!wishlistLoaded) loadTravelWishlist()
                else renderWishlistCards(wishlistItems, document.getElementById('posts-grid'), document.getElementById('empty-state'), handleMarkVisited)
            } else {
                loadPosts()
            }
        })
    })

    await loadPosts()

    document.getElementById('posts-grid').addEventListener('click', async e => {
        const btn = e.target.closest('.delete-post-btn')
        if (!btn) return
        e.preventDefault()
        if (!confirm('Delete this post?')) return
        try {
            await deleteTravelPost(btn.dataset.id)
            showToast('Post deleted')
            await loadPosts()
        } catch (err) { showToast('Failed to delete', 'error') }
    })
}

init()
