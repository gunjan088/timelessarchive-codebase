import { supabase } from './config.js'
import { fetchTravelPosts, deleteTravelPost } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'

let currentUser = null

function escapeHtml(str) {
    if (!str) return ''
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function getExcerpt(content, maxLen = 160) {
    return content.length > maxLen ? content.slice(0, maxLen).trimEnd() + '…' : content
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function renderPosts(posts) {
    const grid = document.getElementById('posts-grid')
    const empty = document.getElementById('empty-state')
    if (!posts.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return }
    empty.classList.add('hidden')
    grid.innerHTML = posts.map(p => `
        <a href="/travel-post.html?id=${escapeHtml(p.id)}" class="block bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5 group">
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
                <a href="/travel-write.html?id=${escapeHtml(p.id)}" class="text-xs text-gray-500 hover:text-orange-400 transition-colors">Edit</a>
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
            newPostBtn.addEventListener('click', () => { window.location.href = '/travel-write.html' })
        }
    }

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
