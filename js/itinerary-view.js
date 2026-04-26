import { supabase } from './config.js'
import { fetchItinerary, getProfile } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'
import { escapeHtml } from './utils.js'

let currentUser = null
let itineraryData = null
let groupByCityMode = false

const CATEGORY_LABELS = { stay: '🛏️ Stay', eat: '🍽️ Eat', visit: '🗺️ Visit', leisure: '🌅 Leisure' }

// ── Nearest-neighbor route optimization ───────────────────────────────────────
function haversineDistance(a, b) {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function nearestNeighbor(places) {
    if (places.length <= 1) return places
    const unvisited = [...places]
    const route = [unvisited.shift()]
    while (unvisited.length) {
        const last = route[route.length - 1]
        let bestIdx = 0, bestDist = Infinity
        unvisited.forEach((p, i) => {
            if (p.lat == null || last.lat == null) return
            const d = haversineDistance(last, p)
            if (d < bestDist) { bestDist = d; bestIdx = i }
        })
        route.push(unvisited.splice(bestIdx, 1)[0])
    }
    return route
}

// ── Render ─────────────────────────────────────────────────────────────────────
function renderHeader(itinerary) {
    const statusBadge = itinerary.status === 'completed'
        ? '<span class="text-xs bg-green-900/40 border border-green-800 text-green-400 px-2 py-0.5 rounded-full">Completed</span>'
        : '<span class="text-xs bg-orange-900/40 border border-orange-800 text-orange-400 px-2 py-0.5 rounded-full">Planning</span>'

    document.getElementById('itinerary-header').innerHTML = `
        <div class="flex items-start justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">📍 ${escapeHtml(itinerary.destination)}</span>
                    ${statusBadge}
                </div>
                <h1 class="text-3xl font-bold">${escapeHtml(itinerary.title)}</h1>
                ${itinerary.start_date ? `<p class="text-gray-500 text-sm mt-1">${escapeHtml(itinerary.start_date)}${itinerary.end_date ? ' → ' + escapeHtml(itinerary.end_date) : ''}</p>` : ''}
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
                <button id="group-by-city-btn" class="text-xs text-gray-500 hover:text-orange-400 border border-gray-700 hover:border-orange-500 px-3 py-1.5 rounded-lg transition-colors">Group by city</button>
                ${currentUser?.id === itinerary.user_id ? `
                <a href="/travel/itinerary-write.html?id=${escapeHtml(itinerary.id)}" class="text-sm text-gray-500 hover:text-orange-400 transition-colors">Edit</a>` : ''}
            </div>
        </div>
    `
    document.getElementById('group-by-city-btn')?.addEventListener('click', () => {
        groupByCityMode = !groupByCityMode
        const btn = document.getElementById('group-by-city-btn')
        btn.textContent = groupByCityMode ? 'Flat view' : 'Group by city'
        btn.classList.toggle('text-orange-400', groupByCityMode)
        btn.classList.toggle('border-orange-500', groupByCityMode)
        btn.classList.toggle('text-gray-500', !groupByCityMode)
        btn.classList.toggle('border-gray-700', !groupByCityMode)
        if (groupByCityMode) {
            renderBodyGrouped(itineraryData.places, itineraryData.budgets)
        } else {
            renderBody(itineraryData.places, itineraryData.budgets)
        }
    })
}

function renderPlacesList(places) {
    if (!places.length) return '<p class="text-gray-600 text-sm">No places added</p>'
    return places.map((p, i) => `
        <div class="flex items-center gap-3 bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <span class="text-xs text-gray-600 w-5 text-center font-mono">${i + 1}</span>
            <div class="flex-1">
                <p class="text-sm font-medium">${escapeHtml(p.name)}</p>
                <p class="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    ${p.city ? `<span>· ${escapeHtml(p.city)}</span>` : ''}
                    ${p.day_number ? `<span>Day ${p.day_number}</span>` : ''}
                    ${p.notes ? `<span>${escapeHtml(p.notes)}</span>` : ''}
                </p>
            </div>
            ${p.cost_estimate ? `<span class="text-xs text-orange-400">₹${Number(p.cost_estimate).toLocaleString()}</span>` : ''}
        </div>
    `).join('')
}

function renderBody(places, budgets) {
    const budgetMap = {}
    budgets.forEach(b => { budgetMap[b.category] = b.budget })

    const cats = ['stay', 'eat', 'visit', 'leisure']
    document.getElementById('itinerary-body').innerHTML = cats.map(cat => {
        const catPlaces = places
            .filter(p => p.category === cat)
            .sort((a, b) => (a.day_number ?? Infinity) - (b.day_number ?? Infinity))
        const budget = budgetMap[cat]
        const spent = catPlaces.reduce((sum, p) => sum + (p.cost_estimate || 0), 0)
        const canOptimize = (cat === 'visit' || cat === 'leisure') && catPlaces.some(p => p.lat != null)

        return `
        <div class="cat-section" data-cat="${cat}">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-bold">${CATEGORY_LABELS[cat]}</h2>
                <div class="flex items-center gap-3">
                    ${budget ? `<span class="text-xs text-gray-500">₹${spent.toLocaleString()} / ₹${Number(budget).toLocaleString()}</span>` : (spent ? `<span class="text-xs text-gray-500">₹${spent.toLocaleString()}</span>` : '')}
                    ${canOptimize ? `<button class="optimize-btn text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 hover:border-orange-500 px-2 py-1 rounded-lg transition-colors" data-cat="${cat}">Optimize Route</button>` : ''}
                </div>
            </div>
            <div class="places-list space-y-2" data-cat="${cat}">
                ${catPlaces.length ? renderPlacesList(catPlaces) : '<p class="text-gray-600 text-sm">No places added</p>'}
            </div>
        </div>`
    }).join('')

    // Budget total
    const total = places.reduce((sum, p) => sum + (p.cost_estimate || 0), 0)
    if (total > 0) {
        document.getElementById('itinerary-body').insertAdjacentHTML('beforeend', `
            <div class="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                <div class="flex justify-between font-semibold">
                    <span class="text-gray-300">Total estimated cost</span>
                    <span class="text-orange-400">₹${total.toLocaleString()}</span>
                </div>
            </div>
        `)
    }

    // Optimize route buttons
    document.querySelectorAll('.optimize-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat
            const catPlaces = itineraryData.places.filter(p => p.category === cat)
            const optimized = nearestNeighbor(catPlaces)
            const listEl = document.querySelector(`.places-list[data-cat="${cat}"]`)
            listEl.innerHTML = renderPlacesList(optimized)
            showToast('Route optimized 📍')
        })
    })
}

function renderBodyGrouped(places, budgets) {
    const cityOrder = []
    places.forEach(p => {
        const c = p.city || 'Other'
        if (!cityOrder.includes(c)) cityOrder.push(c)
    })

    const cats = ['stay', 'eat', 'visit', 'leisure']
    const body = document.getElementById('itinerary-body')

    body.innerHTML = cityOrder.map(city => {
        const cityPlaces = places.filter(p => (p.city || 'Other') === city)
            .sort((a, b) => (a.day_number ?? Infinity) - (b.day_number ?? Infinity))

        const catSections = cats.map(cat => {
            const catPlaces = cityPlaces.filter(p => p.category === cat)
            if (!catPlaces.length) return ''
            return `
                <div class="mb-3">
                    <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">${CATEGORY_LABELS[cat]}</p>
                    <div class="space-y-2">${renderPlacesList(catPlaces)}</div>
                </div>`
        }).join('')

        return `
        <div class="bg-gray-900/40 rounded-2xl border border-gray-800 p-5">
            <h2 class="text-base font-bold text-orange-400 mb-4">📍 ${escapeHtml(city)}</h2>
            ${catSections}
        </div>`
    }).join('')

    const total = places.reduce((sum, p) => sum + (p.cost_estimate || 0), 0)
    if (total > 0) {
        body.insertAdjacentHTML('beforeend', `
            <div class="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                <div class="flex justify-between font-semibold">
                    <span class="text-gray-300">Total estimated cost</span>
                    <span class="text-orange-400">₹${total.toLocaleString()}</span>
                </div>
            </div>
        `)
    }
}

async function init() {
    const id = new URLSearchParams(window.location.search).get('id')
    if (!id) { window.location.href = '/travel/itineraries.html'; return }

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
    }

    try {
        itineraryData = await fetchItinerary(id)
        document.title = `${itineraryData.itinerary.title} — Somewhere Good`
        renderHeader(itineraryData.itinerary)
        renderBody(itineraryData.places, itineraryData.budgets)
    } catch (err) {
        showToast('Failed to load itinerary', 'error')
    }
}

init()
