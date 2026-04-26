import { supabase } from './config.js'
import { fetchTravelPost } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { escapeHtml, formatDate, typeStyle } from './utils.js'

function renderPost(post, places, isAuthor) {
    document.title = `${post.title} — Somewhere Good`
    const area = document.getElementById('post-content-area')

    const placesHtml = places.length ? `
        <div class="mt-10 pt-8 border-t border-gray-800">
            <h2 class="text-lg font-bold mb-4 text-gray-200">📍 Places Visited</h2>
            <div class="space-y-2">
                ${places.map(p => `
                    <div class="flex items-center gap-3 bg-gray-900 rounded-xl p-3 border border-gray-800">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${typeStyle(p.type)}">${escapeHtml(p.type)}</span>
                        <span class="font-medium text-sm flex-1">${escapeHtml(p.name)}</span>
                        ${p.notes ? `<span class="text-xs text-gray-400">${escapeHtml(p.notes)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : ''

    area.innerHTML = `
        <div class="flex items-center gap-2 mb-3 flex-wrap">
            <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">📍 ${escapeHtml(post.destination)}</span>
            <span class="text-xs text-gray-600">${formatDate(post.created_at)}</span>
            ${isAuthor ? `<a href="/travel/write.html?id=${escapeHtml(post.id)}" class="text-xs text-orange-400 hover:text-orange-300 ml-auto transition-colors">Edit</a>` : ''}
        </div>
        <h1 class="text-3xl font-bold mb-8 leading-tight">${escapeHtml(post.title)}</h1>
        <div class="text-gray-300 leading-8 text-[15px] whitespace-pre-wrap">${escapeHtml(post.content)}</div>
        ${placesHtml}
    `
}

async function init() {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    if (!id) { window.location.href = '/travel/'; return }

    const { data: { user } } = await supabase.auth.getUser()
    renderNav('travel', !!user)

    if (user) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
        if (profile) {
            renderNavUser(profile.display_name, {
                onLogout: async () => { await supabase.auth.signOut(); window.location.href = '/index.html' }
            })
        }
    }

    try {
        const { post, places } = await fetchTravelPost(id)
        renderPost(post, places, user?.id === post.user_id)
    } catch (err) {
        document.getElementById('post-content-area').innerHTML = `
            <div class="text-center py-20">
                <p class="text-gray-400">Post not found.</p>
                <a href="/travel/" class="text-orange-400 hover:text-orange-300 text-sm mt-2 inline-block">← Back to Travel</a>
            </div>
        `
    }
}

init()
