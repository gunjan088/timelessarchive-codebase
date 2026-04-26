import { supabase } from './config.js'
import { insertTravelPost, insertTravelPlace, fetchTravelPost, updateTravelPost, getProfile } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'
import { escapeHtml, typeStyle } from './utils.js'

let currentUser = null
let places = []
let editPostId = null

function renderPlaces() {
    const list = document.getElementById('places-list')
    if (!places.length) { list.innerHTML = ''; return }
    list.innerHTML = places.map((p, i) => `
        <div class="flex items-center gap-2 bg-gray-900 rounded-xl p-3 border border-gray-800">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${typeStyle(p.type)}">${escapeHtml(p.type)}</span>
            <span class="text-sm font-medium flex-1">${escapeHtml(p.name)}</span>
            ${p.notes ? `<span class="text-xs text-gray-500 truncate max-w-[120px]">${escapeHtml(p.notes)}</span>` : ''}
            <button class="remove-place text-gray-600 hover:text-red-400 transition-colors text-xs px-1" data-i="${i}">✕</button>
        </div>
    `).join('')
    list.querySelectorAll('.remove-place').forEach(btn => {
        btn.addEventListener('click', () => { places.splice(+btn.dataset.i, 1); renderPlaces() })
    })
}

function addPlaceRow() {
    const div = document.createElement('div')
    div.className = 'flex gap-2 items-start bg-gray-900 rounded-xl p-3 border border-gray-700'
    div.innerHTML = `
        <select class="place-type bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white outline-none" style="font-family:'Poppins',sans-serif">
            <option>Eat</option><option>Stay</option><option>Do</option><option>See</option>
        </select>
        <input class="place-name flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" placeholder="Place name">
        <input class="place-notes flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" placeholder="Notes (optional)">
        <button class="confirm-place text-orange-400 hover:text-orange-300 text-lg px-2 font-bold leading-none">✓</button>
        <button class="cancel-place text-gray-600 hover:text-red-400 text-sm px-1 leading-none">✕</button>
    `
    div.querySelector('.confirm-place').addEventListener('click', () => {
        const name = div.querySelector('.place-name').value.trim()
        if (!name) { div.querySelector('.place-name').focus(); return }
        places.push({
            name,
            type: div.querySelector('.place-type').value,
            notes: div.querySelector('.place-notes').value.trim()
        })
        div.remove()
        renderPlaces()
    })
    div.querySelector('.cancel-place').addEventListener('click', () => div.remove())
    document.getElementById('places-list').appendChild(div)
    div.querySelector('.place-name').focus()
}

document.getElementById('add-place-btn').addEventListener('click', addPlaceRow)

document.getElementById('publish-btn').addEventListener('click', async () => {
    const title       = document.getElementById('post-title').value.trim()
    const destination = document.getElementById('post-destination').value.trim()
    const content     = document.getElementById('post-content').value.trim()
    const msg         = document.getElementById('write-msg')
    const btn         = document.getElementById('publish-btn')

    msg.classList.add('hidden')
    if (!title)       { msg.textContent = 'Add a title'; msg.classList.remove('hidden'); return }
    if (!destination) { msg.textContent = 'Add a destination'; msg.classList.remove('hidden'); return }
    if (!content)     { msg.textContent = 'Write something!'; msg.classList.remove('hidden'); return }

    btn.textContent = editPostId ? 'Updating...' : 'Publishing...'
    btn.disabled = true

    try {
        if (editPostId) {
            await updateTravelPost(editPostId, { title, destination, content })
            // Delete existing places and re-insert
            const { error: delErr } = await supabase.from('travel_places').delete().eq('post_id', editPostId)
            if (delErr) throw delErr
            for (const place of places) {
                await insertTravelPlace({ postId: editPostId, ...place })
            }
            showToast('Post updated! ✏️')
            window.location.href = `/travel/post.html?id=${editPostId}`
        } else {
            const postId = await insertTravelPost({ userId: currentUser.id, title, destination, content })
            if (!postId) throw new Error('Failed to get post ID')
            for (const place of places) {
                await insertTravelPlace({ postId, ...place })
            }
            showToast('Post published! ✈️')
            window.location.href = `/travel/post.html?id=${postId}`
        }
    } catch (err) {
        msg.textContent = err.message || 'Failed to publish'
        msg.classList.remove('hidden')
        btn.textContent = editPostId ? 'Update Post' : 'Publish Post'
        btn.disabled = false
    }
})

async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/index.html'; return }
    currentUser = user

    renderNav('travel', true)
    const profile = await getProfile(user.id)
    if (profile) {
        renderNavUser(profile.display_name, {
            onLogout: async () => { await supabase.auth.signOut(); window.location.href = '/index.html' }
        })
    }

    const params = new URLSearchParams(window.location.search)
    editPostId = params.get('id')
    if (editPostId) {
        document.querySelector('h1') && (document.querySelector('h1').textContent = '✏️ Edit Post')
        document.getElementById('publish-btn').textContent = 'Update Post'
        try {
            const { post, places: existingPlaces } = await fetchTravelPost(editPostId)
            document.getElementById('post-title').value = post.title
            document.getElementById('post-destination').value = post.destination
            document.getElementById('post-content').value = post.content
            // Pre-fill places
            existingPlaces.forEach(p => {
                places.push({ name: p.name, type: p.type, notes: p.notes || '' })
            })
            renderPlaces()
        } catch (err) {
            showToast('Failed to load post', 'error')
        }
    }
}

init()
