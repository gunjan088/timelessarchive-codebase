import { supabase } from './config.js'
import { fetchPackingLists, fetchPackingItems, insertPackingList, deletePackingList,
         insertPackingItem, togglePackingItem, deletePackingItem, fetchItineraries, getProfile } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'
import { escapeHtml } from './utils.js'

let currentUser = null
let lists = []
let itineraryMap = {}  // id -> title
const itemCache = {}   // listId -> items[]
const expanded = new Set()

const container  = document.getElementById('lists-container')
const emptyState = document.getElementById('empty-state')

// ── Render ─────────────────────────────────────────────────────────────────

function progress(items) {
    if (!items) return ''
    const total = items.length
    const done  = items.filter(i => i.is_checked).length
    if (!total) return '<span class="text-xs text-gray-600">empty</span>'
    const pct = Math.round(done / total * 100)
    return `<span class="text-xs text-gray-500">${done}/${total}</span>
            <div class="w-16 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-orange-500 rounded-full transition-all" style="width:${pct}%"></div>
            </div>`
}

function renderItemsHtml(listId, items) {
    const isOwner = lists.find(l => l.id === listId)?.user_id === currentUser?.id
    return `
        <div class="mt-3 pt-3 border-t border-gray-800 space-y-1" id="items-${listId}">
            ${items.map(item => `
                <div class="flex items-center gap-2 group/item" data-item-id="${escapeHtml(item.id)}">
                    ${isOwner
                        ? `<input type="checkbox" class="item-check w-4 h-4 rounded accent-orange-500 cursor-pointer flex-shrink-0" ${item.is_checked ? 'checked' : ''}>`
                        : `<span class="w-4 h-4 flex-shrink-0 text-center text-xs">${item.is_checked ? '✓' : '○'}</span>`
                    }
                    <span class="text-sm flex-1 ${item.is_checked ? 'line-through text-gray-600' : 'text-gray-200'}">${escapeHtml(item.name)}</span>
                    ${isOwner ? `<button class="delete-item-btn opacity-0 group-hover/item:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs px-1">✕</button>` : ''}
                </div>
            `).join('')}
            ${isOwner ? `
            <div class="flex gap-2 mt-2" id="add-item-row-${listId}">
                <input type="text" class="add-item-input flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors" placeholder="Add item...">
                <button class="add-item-btn text-orange-400 hover:text-orange-300 text-sm px-2 transition-colors">Add</button>
            </div>` : ''}
        </div>
    `
}

function renderLists() {
    if (!lists.length) { container.innerHTML = ''; emptyState.classList.remove('hidden'); return }
    emptyState.classList.add('hidden')
    container.innerHTML = lists.map(l => {
        const items = itemCache[l.id]
        const isExpanded = expanded.has(l.id)
        const isOwner = l.user_id === currentUser?.id
        const itinTitle = l.itinerary_id ? itineraryMap[l.itinerary_id] : null
        const tripLabel = itinTitle
            ? `<span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">✈️ ${escapeHtml(itinTitle)}</span>`
            : '<span class="text-xs text-gray-600">General</span>'
        return `
            <div class="bg-gray-900 rounded-2xl border border-gray-800 p-4" id="list-card-${escapeHtml(l.id)}">
                <div class="flex items-center gap-3 cursor-pointer toggle-list" data-id="${escapeHtml(l.id)}">
                    <span class="text-gray-500 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}">▶</span>
                    <span class="font-semibold text-white flex-1 text-sm">${escapeHtml(l.name)}</span>
                    ${tripLabel}
                    <div class="flex items-center gap-2">${progress(items)}</div>
                    ${isOwner ? `<button class="delete-list-btn text-gray-600 hover:text-red-400 transition-colors text-xs px-1 ml-1" data-id="${escapeHtml(l.id)}">✕</button>` : ''}
                </div>
                ${isExpanded && items ? renderItemsHtml(l.id, items) : ''}
                ${isExpanded && !items ? '<div class="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-600">Loading...</div>' : ''}
            </div>
        `
    }).join('')
    wireListEvents()
}

function wireListEvents() {
    // Toggle expand
    container.querySelectorAll('.toggle-list').forEach(el => {
        el.addEventListener('click', async e => {
            if (e.target.closest('.delete-list-btn')) return
            const id = el.dataset.id
            if (expanded.has(id)) {
                expanded.delete(id)
            } else {
                expanded.add(id)
                if (!itemCache[id]) {
                    itemCache[id] = await fetchPackingItems(id)
                }
            }
            renderLists()
        })
    })

    // Delete list
    container.querySelectorAll('.delete-list-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation()
            if (!confirm('Delete this list and all its items?')) return
            try {
                await deletePackingList(btn.dataset.id)
                lists = lists.filter(l => l.id !== btn.dataset.id)
                delete itemCache[btn.dataset.id]
                expanded.delete(btn.dataset.id)
                renderLists()
                showToast('List deleted')
            } catch (err) { showToast('Failed to delete', 'error') }
        })
    })

    // Checkbox toggle
    container.querySelectorAll('.item-check').forEach(cb => {
        cb.addEventListener('change', async () => {
            const itemEl = cb.closest('[data-item-id]')
            const itemId = itemEl.dataset.itemId
            const listCard = cb.closest('[id^="list-card-"]')
            const listId = listCard.id.replace('list-card-', '')
            try {
                await togglePackingItem(itemId, cb.checked)
                const item = itemCache[listId]?.find(i => i.id === itemId)
                if (item) item.is_checked = cb.checked
                renderLists()
            } catch (err) { showToast('Failed to update', 'error') }
        })
    })

    // Delete item
    container.querySelectorAll('.delete-item-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const itemEl = btn.closest('[data-item-id]')
            const itemId = itemEl.dataset.itemId
            const listCard = btn.closest('[id^="list-card-"]')
            const listId = listCard.id.replace('list-card-', '')
            try {
                await deletePackingItem(itemId)
                itemCache[listId] = itemCache[listId].filter(i => i.id !== itemId)
                renderLists()
            } catch (err) { showToast('Failed to delete item', 'error') }
        })
    })

    // Add item
    container.querySelectorAll('.add-item-btn').forEach(btn => {
        const row = btn.closest('[id^="add-item-row-"]')
        const listId = row.id.replace('add-item-row-', '')
        const input = row.querySelector('.add-item-input')

        const doAdd = async () => {
            const name = input.value.trim()
            if (!name) return
            input.value = ''
            try {
                const displayOrder = (itemCache[listId]?.length) ?? 0
                const newItem = await insertPackingItem({ listId, name, displayOrder })
                if (!itemCache[listId]) itemCache[listId] = []
                itemCache[listId].push(newItem)
                renderLists()
            } catch (err) { showToast('Failed to add item', 'error') }
        }

        btn.addEventListener('click', doAdd)
        input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd() })
    })
}

// ── New list form ──────────────────────────────────────────────────────────

document.getElementById('new-list-btn').addEventListener('click', () => {
    document.getElementById('new-list-form').classList.remove('hidden')
    document.getElementById('new-list-name').focus()
})

document.getElementById('cancel-list-btn').addEventListener('click', () => {
    document.getElementById('new-list-form').classList.add('hidden')
    document.getElementById('new-list-name').value = ''
})

document.getElementById('save-list-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-list-name').value.trim()
    if (!name) { document.getElementById('new-list-name').focus(); return }
    const itineraryId = document.getElementById('new-list-itinerary').value || null
    const btn = document.getElementById('save-list-btn')
    btn.textContent = 'Creating...'
    btn.disabled = true
    try {
        const newList = await insertPackingList({ userId: currentUser.id, name, itineraryId })
        lists.unshift(newList)
        itemCache[newList.id] = []
        expanded.add(newList.id)
        document.getElementById('new-list-form').classList.add('hidden')
        document.getElementById('new-list-name').value = ''
        document.getElementById('new-list-itinerary').value = ''
        renderLists()
        showToast('List created')
    } catch (err) {
        showToast('Failed to create list', 'error')
    } finally {
        btn.textContent = 'Create'
        btn.disabled = false
    }
})

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user
    renderNav('travel', !!user)

    if (user) {
        const profile = await getProfile(user.id)
        if (profile) {
            renderNavUser(profile.display_name, {
                onLogout: async () => { await supabase.auth.signOut(); window.location.href = '/index.html' }
            })
        }
        document.getElementById('new-list-btn').classList.remove('hidden')

        // Populate itinerary dropdown and build map
        try {
            const itins = await fetchItineraries()
            itins.forEach(it => { itineraryMap[it.id] = it.title })
            const sel = document.getElementById('new-list-itinerary')
            itins.forEach(it => {
                const opt = document.createElement('option')
                opt.value = it.id
                opt.textContent = it.title
                sel.appendChild(opt)
            })
        } catch (_) {}
    }

    try {
        lists = await fetchPackingLists()
        renderLists()
    } catch (err) {
        showToast('Failed to load', 'error')
    }
}

init()
