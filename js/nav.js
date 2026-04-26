function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function renderNav(activePage, isLoggedIn = false) {
    const nav = document.getElementById('main-nav')
    if (!nav) return
    nav.innerHTML = `
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-6">
                <a href="/index.html" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span class="font-bold text-lg tracking-tight">Somewhere Good</span>
                </a>
                <nav class="flex items-center gap-1">
                    <a href="/index.html" class="nav-link ${activePage === 'food' ? 'nav-link-active' : ''}">🍽️ Food</a>
                    <a href="/travel.html" class="nav-link ${activePage === 'travel' ? 'nav-link-active' : ''}">✈️ Travel</a>
                    <a href="/movies.html" class="nav-link ${activePage === 'movies' ? 'nav-link-active' : ''}">🎬 Movies</a>
                </nav>
            </div>
            <div id="nav-user-area" class="flex items-center gap-2 sm:gap-3">
                ${!isLoggedIn ? `
                <button id="add-review-btn" class="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-3 py-2 rounded-xl text-sm transition-all transform hover:-translate-y-0.5 shadow-lg shadow-orange-500/20 whitespace-nowrap">
                    <span class="text-base leading-none font-bold">+</span>
                    <span class="hidden sm:inline">Add Review</span>
                </button>` : ''}
            </div>
        </div>
    `
}

export function renderNavUser(name, { onLogout, showAddReview = false }) {
    const area = document.getElementById('nav-user-area')
    if (!area) return
    area.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                ${esc(name.charAt(0).toUpperCase())}
            </div>
            <span class="text-sm text-gray-300 hidden sm:block">${esc(name)}</span>
        </div>
        ${showAddReview ? `<button id="add-review-btn" class="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-3 py-2 rounded-xl text-sm transition-all transform hover:-translate-y-0.5 shadow-lg shadow-orange-500/20 whitespace-nowrap">
            <span class="text-base leading-none font-bold">+</span>
            <span class="hidden sm:inline">Add Review</span>
        </button>` : ''}
        <button id="wishlist-add-btn" class="text-gray-500 hover:text-orange-400 transition-colors text-sm px-2" title="Add to wishlist">🔖</button>
        <button id="logout-btn" class="text-gray-600 hover:text-gray-400 text-xs transition-colors hidden sm:block">Logout</button>
    `
    document.getElementById('logout-btn')?.addEventListener('click', onLogout)
}
