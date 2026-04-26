import { escapeHtml } from './utils.js'

export function renderNav(activePage, isLoggedIn = false) {
    const nav = document.getElementById('main-nav')
    if (!nav) return
    nav.innerHTML = `
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 sm:gap-6">
                <a href="/index.html" class="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
                    <span class="font-bold text-base sm:text-lg tracking-tight"><span class="hidden sm:inline">Somewhere Good</span><span class="sm:hidden">SG</span></span>
                </a>
                <nav class="flex items-center gap-0.5 sm:gap-1">
                    <a href="/index.html" class="nav-link ${activePage === 'food' ? 'nav-link-active' : ''}">🍽️<span class="hidden sm:inline"> Food</span></a>
                    <a href="/travel/" class="nav-link ${activePage === 'travel' ? 'nav-link-active' : ''}">✈️<span class="hidden sm:inline"> Travel</span></a>
                    <a href="/movies/" class="nav-link ${activePage === 'movies' ? 'nav-link-active' : ''}">🎬<span class="hidden sm:inline"> Movies</span></a>
                    <a href="/books/" class="nav-link ${activePage === 'books' ? 'nav-link-active' : ''}">📚<span class="hidden sm:inline"> Books</span></a>
                </nav>
            </div>
            <div id="nav-user-area" class="flex items-center gap-2 sm:gap-3">
                ${!isLoggedIn ? `
                <a href="/?return=${encodeURIComponent(window.location.pathname)}" class="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-3 py-2 rounded-xl text-sm transition-all transform hover:-translate-y-0.5 shadow-lg shadow-orange-500/20 whitespace-nowrap">
                    Sign In
                </a>` : ''}
            </div>
        </div>
    `
}

export function renderNavUser(name, { onLogout }) {
    const area = document.getElementById('nav-user-area')
    if (!area) return
    area.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                ${escapeHtml((name || '?').charAt(0).toUpperCase())}
            </div>
            <span class="text-sm text-gray-300 hidden sm:block">${escapeHtml(name || '')}</span>
        </div>
        <button id="logout-btn" class="text-gray-600 hover:text-gray-400 text-xs transition-colors hidden sm:block">Logout</button>
    `
    document.getElementById('logout-btn')?.addEventListener('click', onLogout)
}
