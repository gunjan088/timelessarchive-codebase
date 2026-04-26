import { supabase } from './config.js'
import { fetchItineraries, deleteItinerary } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'
import { escapeHtml, formatDate } from './utils.js'

let currentUser = null

function statusBadge(status) {
    return status === 'completed'
        ? '<span class="text-xs bg-green-900/40 border border-green-800 text-green-400 px-2 py-0.5 rounded-full">Completed</span>'
        : '<span class="text-xs bg-orange-900/40 border border-orange-800 text-orange-400 px-2 py-0.5 rounded-full">Planning</span>'
}

function renderItineraries(items) {
    const grid = document.getElementById('itineraries-grid')
    const empty = document.getElementById('empty-state')
    if (!items.length) { grid.innerHTML = ''; empty.classList.remove('hidden'); return }
    empty.classList.add('hidden')
    grid.innerHTML = items.map(it => `
        <a href="/travel/itinerary.html?id=${escapeHtml(it.id)}" class="block bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5 group">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">📍 ${escapeHtml(it.destination)}</span>
                        ${statusBadge(it.status)}
                        <span class="text-xs text-gray-600">${formatDate(it.created_at)}</span>
                    </div>
                    <h2 class="text-xl font-bold text-white group-hover:text-orange-400 transition-colors">${escapeHtml(it.title)}</h2>
                    ${it.start_date ? `<p class="text-gray-500 text-xs mt-1">${it.start_date}${it.end_date ? ' → ' + it.end_date : ''}</p>` : ''}
                </div>
            </div>
            ${currentUser?.id === it.user_id ? `
            <div class="flex gap-3 mt-4 pt-4 border-t border-gray-800" onclick="event.stopPropagation(); event.preventDefault()">
                <a href="/travel/itinerary-write.html?id=${escapeHtml(it.id)}" class="text-xs text-gray-500 hover:text-orange-400 transition-colors">Edit</a>
                <button class="delete-itinerary-btn text-xs text-gray-500 hover:text-red-400 transition-colors" data-id="${escapeHtml(it.id)}">Delete</button>
            </div>` : ''}
        </a>
    `).join('')
}

async function loadItineraries() {
    document.getElementById('itineraries-grid').innerHTML = '<div class="space-y-4">' + Array(3).fill('<div class="bg-gray-900 rounded-2xl border border-gray-800 p-6"><div class="skeleton h-4 w-1/4 mb-3"></div><div class="skeleton h-6 w-2/3"></div></div>').join('') + '</div>'
    try {
        const items = await fetchItineraries()
        renderItineraries(items)
    } catch (err) {
        document.getElementById('itineraries-grid').innerHTML = ''
        document.getElementById('empty-state').classList.remove('hidden')
        showToast('Failed to load itineraries', 'error')
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
        const btn = document.getElementById('new-itinerary-btn')
        if (btn) {
            btn.classList.remove('hidden')
            btn.addEventListener('click', () => { window.location.href = '/travel/itinerary-write.html' })
        }
    }

    await loadItineraries()

    document.getElementById('itineraries-grid').addEventListener('click', async e => {
        const btn = e.target.closest('.delete-itinerary-btn')
        if (!btn) return
        e.preventDefault()
        if (!confirm('Delete this itinerary?')) return
        try {
            await deleteItinerary(btn.dataset.id)
            showToast('Itinerary deleted')
            await loadItineraries()
        } catch (err) { showToast('Failed to delete', 'error') }
    })
}

init()
