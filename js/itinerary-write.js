import { supabase } from './config.js'
import { insertItinerary, insertItineraryPlace, upsertItineraryBudget } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'
import { escapeHtml } from './utils.js'

let currentUser = null
let selectedStatus = 'planning'
let activeCategory = 'stay'

// places[category] = [{name, notes, costEstimate, lat, lng}]
const places = { stay: [], eat: [], visit: [], leisure: [] }
// budgets[category] = number | null
const budgets = { stay: null, eat: null, visit: null, leisure: null }

// ── Nominatim geocoding ───────────────────────────────────────────────────────
async function geocode(name) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`, {
            headers: { 'Accept-Language': 'en' }
        })
        const data = await res.json()
        if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    } catch (_) {}
    return { lat: null, lng: null }
}

// ── Category tabs ─────────────────────────────────────────────────────────────
function switchCategory(cat) {
    // Save current budget input before switching
    const budgetInput = document.getElementById('cat-budget')
    budgets[activeCategory] = budgetInput.value ? parseFloat(budgetInput.value) : null

    activeCategory = cat
    document.querySelectorAll('.cat-tab').forEach(btn => {
        const isActive = btn.dataset.cat === cat
        btn.classList.toggle('text-orange-400', isActive)
        btn.classList.toggle('border-b-2', isActive)
        btn.classList.toggle('border-orange-400', isActive)
        btn.classList.toggle('-mb-px', isActive)
        btn.classList.toggle('text-gray-500', !isActive)
    })

    // Restore budget input for new category
    budgetInput.value = budgets[cat] ?? ''
    renderPlaces()
    updateBudgetSummary()
}

// ── Places list ───────────────────────────────────────────────────────────────
function renderPlaces() {
    const list = document.getElementById('places-list')
    const catPlaces = places[activeCategory]
    if (!catPlaces.length) { list.innerHTML = ''; return }
    list.innerHTML = catPlaces.map((p, i) => `
        <div class="flex items-center gap-2 bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <span class="flex-1 text-sm font-medium">${escapeHtml(p.name)}</span>
            ${p.notes ? `<span class="text-xs text-gray-500 truncate max-w-[120px]">${escapeHtml(p.notes)}</span>` : ''}
            ${p.costEstimate ? `<span class="text-xs text-orange-400">₹${p.costEstimate.toLocaleString()}</span>` : ''}
            ${p.lat ? '<span class="text-xs text-green-600" title="Geocoded">📍</span>' : ''}
            <button class="remove-place text-gray-600 hover:text-red-400 transition-colors text-xs px-1" data-i="${i}">✕</button>
        </div>
    `).join('')
    list.querySelectorAll('.remove-place').forEach(btn => {
        btn.addEventListener('click', () => {
            places[activeCategory].splice(+btn.dataset.i, 1)
            renderPlaces()
            updateBudgetSummary()
        })
    })
}

function addPlaceRow() {
    const div = document.createElement('div')
    div.className = 'flex gap-2 items-start bg-gray-900 rounded-xl p-3 border border-gray-700'
    div.innerHTML = `
        <input class="place-name flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" placeholder="Place name">
        <input class="place-cost w-24 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" type="number" placeholder="₹ cost">
        <input class="place-notes flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" placeholder="Notes (optional)">
        <button class="confirm-place text-orange-400 hover:text-orange-300 text-lg px-2 font-bold leading-none">✓</button>
        <button class="cancel-place text-gray-600 hover:text-red-400 text-sm px-1 leading-none">✕</button>
    `
    div.querySelector('.confirm-place').addEventListener('click', async () => {
        const name = div.querySelector('.place-name').value.trim()
        if (!name) { div.querySelector('.place-name').focus(); return }
        const costVal = div.querySelector('.place-cost').value
        const costEstimate = costVal ? parseFloat(costVal) : null
        const notes = div.querySelector('.place-notes').value.trim()

        // Geocode in background
        div.querySelector('.confirm-place').textContent = '...'
        const { lat, lng } = await geocode(name)

        places[activeCategory].push({ name, notes, costEstimate, lat, lng })
        div.remove()
        renderPlaces()
        updateBudgetSummary()
    })
    div.querySelector('.cancel-place').addEventListener('click', () => div.remove())
    document.getElementById('places-list').appendChild(div)
    div.querySelector('.place-name').focus()
}

// ── Budget summary ────────────────────────────────────────────────────────────
function updateBudgetSummary() {
    const cats = ['stay', 'eat', 'visit', 'leisure']
    const labels = { stay: 'Stay', eat: 'Eat', visit: 'Visit', leisure: 'Leisure' }
    let total = 0
    let hasData = false

    const rows = cats.map(cat => {
        const spent = places[cat].reduce((sum, p) => sum + (p.costEstimate || 0), 0)
        const budget = cat === activeCategory
            ? (parseFloat(document.getElementById('cat-budget').value) || null)
            : budgets[cat]
        if (!spent && !budget) return null
        hasData = true
        total += spent
        const over = budget && spent > budget
        return `<div class="flex justify-between text-xs">
            <span class="text-gray-400">${labels[cat]}</span>
            <span class="${over ? 'text-red-400' : 'text-gray-300'}">
                ₹${spent.toLocaleString()}${budget ? ' / ₹' + budget.toLocaleString() : ''}
                ${over ? ' ⚠️' : ''}
            </span>
        </div>`
    }).filter(Boolean)

    const summary = document.getElementById('budget-summary')
    if (!hasData) { summary.classList.add('hidden'); return }
    summary.classList.remove('hidden')
    document.getElementById('budget-rows').innerHTML = rows.join('')
    document.getElementById('budget-total').textContent = `₹${total.toLocaleString()}`
}

// ── Status toggle ─────────────────────────────────────────────────────────────
function setStatus(status) {
    selectedStatus = status
    document.querySelectorAll('[data-status]').forEach(btn => {
        const active = btn.dataset.status === status
        btn.classList.toggle('border-orange-500', active)
        btn.classList.toggle('text-orange-400', active)
        btn.classList.toggle('bg-orange-500/10', active)
        btn.classList.toggle('border-gray-700', !active)
        btn.classList.toggle('text-gray-500', !active)
    })
}

// ── Save ──────────────────────────────────────────────────────────────────────
document.getElementById('publish-btn').addEventListener('click', async () => {
    // Save current budget before submitting
    const budgetInput = document.getElementById('cat-budget')
    budgets[activeCategory] = budgetInput.value ? parseFloat(budgetInput.value) : null

    const title = document.getElementById('itin-title').value.trim()
    const destination = document.getElementById('itin-destination').value.trim()
    const startDate = document.getElementById('itin-start').value || null
    const endDate = document.getElementById('itin-end').value || null
    const msg = document.getElementById('write-msg')
    const btn = document.getElementById('publish-btn')

    msg.classList.add('hidden')
    if (!title) { msg.textContent = 'Add a title'; msg.classList.remove('hidden'); return }
    if (!destination) { msg.textContent = 'Add a destination'; msg.classList.remove('hidden'); return }

    btn.textContent = 'Saving...'
    btn.disabled = true

    try {
        const itineraryId = await insertItinerary({
            userId: currentUser.id, title, destination, startDate, endDate, status: selectedStatus
        })

        // Save budgets
        for (const [category, budget] of Object.entries(budgets)) {
            if (budget != null) await upsertItineraryBudget({ itineraryId, category, budget })
        }

        // Save places with display_order
        for (const category of ['stay', 'eat', 'visit', 'leisure']) {
            for (let i = 0; i < places[category].length; i++) {
                const p = places[category][i]
                await insertItineraryPlace({
                    itineraryId, name: p.name, category,
                    notes: p.notes, costEstimate: p.costEstimate,
                    lat: p.lat, lng: p.lng, displayOrder: i
                })
            }
        }

        showToast('Itinerary saved! 🗺️')
        window.location.href = `/travel/itinerary.html?id=${itineraryId}`
    } catch (err) {
        msg.textContent = err.message || 'Failed to save'
        msg.classList.remove('hidden')
        btn.textContent = 'Save Itinerary'
        btn.disabled = false
    }
})

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/index.html'; return }
    currentUser = user

    renderNav('travel', true)
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    if (profile) {
        renderNavUser(profile.display_name, {
            onLogout: async () => { await supabase.auth.signOut(); window.location.href = '/index.html' }
        })
    }

    document.querySelectorAll('.cat-tab').forEach(btn => {
        btn.addEventListener('click', () => switchCategory(btn.dataset.cat))
    })
    document.querySelectorAll('[data-status]').forEach(btn => {
        btn.addEventListener('click', () => setStatus(btn.dataset.status))
    })
    document.getElementById('add-place-btn').addEventListener('click', addPlaceRow)
    document.getElementById('cat-budget').addEventListener('input', updateBudgetSummary)
}

init()
