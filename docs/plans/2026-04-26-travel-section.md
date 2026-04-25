# Travel Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public Travel section to timelessarchive.in where Gunjan can write long-form travel posts with a "places visited" list, accessible via a nav tab alongside BLR Bites.

**Architecture:** Static multi-page site (no framework). Three new HTML pages share a common nav component. Travel posts and places stored in Supabase. Anyone can read; only logged-in users can write. BLR Bites nav updated to include Travel link.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Tailwind CDN, Supabase JS, Vercel static hosting.

---

### Task 1: Supabase — create travel tables

**Files:**
- No code files — SQL only in Supabase dashboard

**Step 1: Run this SQL in Supabase SQL Editor**

```sql
CREATE TABLE travel_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT true
);

CREATE TABLE travel_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES travel_posts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Eat', 'Stay', 'Do', 'See')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE travel_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_places ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts and places
CREATE POLICY "travel_posts_select" ON travel_posts FOR SELECT USING (published = true);
CREATE POLICY "travel_places_select" ON travel_places FOR SELECT USING (true);

-- Only author can insert/update/delete their posts
CREATE POLICY "travel_posts_insert" ON travel_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "travel_posts_update" ON travel_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "travel_posts_delete" ON travel_posts FOR DELETE USING (auth.uid() = user_id);

-- Only post author can manage places (via post ownership check)
CREATE POLICY "travel_places_insert" ON travel_places FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM travel_posts WHERE id = post_id AND user_id = auth.uid())
);
CREATE POLICY "travel_places_delete" ON travel_places FOR DELETE USING (
  EXISTS (SELECT 1 FROM travel_posts WHERE id = post_id AND user_id = auth.uid())
);

GRANT SELECT ON travel_posts TO anon, authenticated;
GRANT SELECT ON travel_places TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON travel_posts TO authenticated;
GRANT INSERT, DELETE ON travel_places TO authenticated;
```

**Step 2: Verify**
- Go to Supabase → Table Editor → confirm `travel_posts` and `travel_places` exist

---

### Task 2: Shared nav component + update BLR Bites header

**Files:**
- Modify: `js/nav.js` (create new)
- Modify: `index.html` — replace existing header with shared nav
- Modify: `js/app.js` — import nav, call render after login

**Step 1: Create `js/nav.js`**

```js
export function renderNav(activePage, isLoggedIn = false) {
    const nav = document.getElementById('main-nav')
    if (!nav) return
    nav.innerHTML = `
        <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-6">
                <a href="/index.html" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span class="text-xl">🍽️</span>
                    <span class="font-bold text-lg tracking-tight">BLR Bites</span>
                </a>
                <nav class="flex items-center gap-1">
                    <a href="/index.html" class="nav-link ${activePage === 'food' ? 'nav-link-active' : ''}">Food</a>
                    <a href="/travel.html" class="nav-link ${activePage === 'travel' ? 'nav-link-active' : ''}">✈️ Travel</a>
                </nav>
            </div>
            <div id="nav-user-area" class="flex items-center gap-2 sm:gap-3"></div>
        </div>
    `
}

export function renderNavUser(name, onLogout) {
    const area = document.getElementById('nav-user-area')
    if (!area) return
    area.innerHTML = `
        <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                ${name.charAt(0).toUpperCase()}
            </div>
            <span class="text-sm text-gray-300 hidden sm:block">${name}</span>
        </div>
        <button id="add-review-btn" class="flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-3 py-2 rounded-xl text-sm transition-all transform hover:-translate-y-0.5 shadow-lg shadow-orange-500/20 whitespace-nowrap">
            <span class="text-base leading-none font-bold">+</span>
            <span class="hidden sm:inline">Add Review</span>
        </button>
        <button id="logout-btn" class="text-gray-600 hover:text-gray-400 text-xs transition-colors hidden sm:block">Logout</button>
    `
    document.getElementById('logout-btn')?.addEventListener('click', onLogout)
}
```

**Step 2: Update `index.html` header**

Replace the existing `<header>` block with:
```html
<header id="main-nav" class="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60"></header>
```

**Step 3: Add nav styles to `css/style.css`**

```css
.nav-link {
    color: #6b7280;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 8px;
    transition: color 0.15s, background 0.15s;
    text-decoration: none;
    font-family: 'Poppins', sans-serif;
}
.nav-link:hover { color: white; background: #1f2937; }
.nav-link-active { color: white; background: #1f2937; }
```

**Step 4: Update `js/app.js`**

- Import `renderNav`, `renderNavUser` from `./nav.js`
- In `showScreen('app')` call: `renderNav('food', true)` then `renderNavUser(name, logoutFn)`
- Move logout and add-review button event wiring into `renderNavUser` callback
- Remove the old inline header user badge functions

**Step 5: Verify**
- Open BLR Bites, log in → nav shows Food (active) | ✈️ Travel
- Click Travel → navigates to travel.html (404 for now, that's fine)

**Step 6: Commit**
```bash
git add index.html css/style.css js/nav.js js/app.js
git commit -m "Add shared nav with Food and Travel tabs"
```

---

### Task 3: Travel DB functions

**Files:**
- Modify: `js/db.js` — add travel query functions

**Step 1: Add to `js/db.js`**

```js
// ── Travel ─────────────────────────────────────────────────────────────────

export async function fetchTravelPosts() {
    const { data, error } = await supabase
        .from('travel_posts')
        .select('id, title, destination, content, created_at, user_id')
        .eq('published', true)
        .order('created_at', { ascending: false })
    if (error) throw error
    return data
}

export async function fetchTravelPost(id) {
    const [postRes, placesRes] = await Promise.all([
        supabase.from('travel_posts').select('*').eq('id', id).single(),
        supabase.from('travel_places').select('*').eq('post_id', id).order('created_at')
    ])
    if (postRes.error) throw postRes.error
    return { post: postRes.data, places: placesRes.data || [] }
}

export async function insertTravelPost({ userId, title, destination, content }) {
    const { data, error } = await supabase
        .from('travel_posts')
        .insert([{ user_id: userId, title, destination, content }])
        .select('id')
    if (error) throw error
    return data[0].id
}

export async function insertTravelPlace({ postId, name, type, notes }) {
    const { error } = await supabase
        .from('travel_places')
        .insert([{ post_id: postId, name, type, notes: notes || null }])
    if (error) throw error
}

export async function deleteTravelPost(id) {
    const { error } = await supabase.from('travel_posts').delete().eq('id', id)
    if (error) throw error
}
```

**Step 2: Commit**
```bash
git add js/db.js
git commit -m "Add travel DB functions"
```

---

### Task 4: Travel listing page (`travel.html`)

**Files:**
- Create: `travel.html`
- Create: `js/travel.js`

**Step 1: Create `travel.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Travel — Timeless Archive</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./css/style.css">
</head>
<body class="bg-gray-950 min-h-screen text-white">

    <header id="main-nav" class="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60"></header>

    <main class="max-w-4xl mx-auto px-4 py-10">
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-3xl font-bold">✈️ Travel</h1>
                <p class="text-gray-400 text-sm mt-1">Places I've been, things I've seen</p>
            </div>
            <button id="new-post-btn" class="hidden bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all transform hover:-translate-y-0.5 shadow-lg shadow-orange-500/20">
                + New Post
            </button>
        </div>

        <div id="posts-grid" class="space-y-4"></div>

        <div id="empty-state" class="hidden text-center py-20">
            <div class="text-6xl mb-4">🗺️</div>
            <p class="text-gray-400 text-lg font-medium">No travel posts yet</p>
            <p class="text-gray-600 text-sm mt-1">Adventures incoming...</p>
        </div>
    </main>

    <script type="module" src="./js/travel.js"></script>
</body>
</html>
```

**Step 2: Create `js/travel.js`**

```js
import { supabase } from './config.js'
import { fetchTravelPosts, deleteTravelPost } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'

let currentUser = null

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
        <a href="/travel-post.html?id=${p.id}" class="block bg-gray-900 hover:bg-gray-800/70 rounded-2xl border border-gray-800 hover:border-gray-700 p-6 transition-all duration-200 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5 group">
            <div class="flex items-start justify-between gap-4">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">📍 ${p.destination}</span>
                        <span class="text-xs text-gray-600">${formatDate(p.created_at)}</span>
                    </div>
                    <h2 class="text-xl font-bold text-white group-hover:text-orange-400 transition-colors mb-2">${p.title}</h2>
                    <p class="text-gray-400 text-sm leading-relaxed">${getExcerpt(p.content)}</p>
                </div>
            </div>
            ${currentUser?.id === p.user_id ? `
            <div class="flex gap-2 mt-4 pt-4 border-t border-gray-800">
                <a href="/travel-write.html?id=${p.id}" class="text-xs text-gray-500 hover:text-orange-400 transition-colors" onclick="event.stopPropagation()">Edit</a>
                <button class="delete-post-btn text-xs text-gray-500 hover:text-red-400 transition-colors" data-id="${p.id}" onclick="event.stopPropagation(); event.preventDefault()">Delete</button>
            </div>` : ''}
        </a>
    `).join('')

    grid.addEventListener('click', async e => {
        const btn = e.target.closest('.delete-post-btn')
        if (!btn) return
        e.preventDefault()
        if (!confirm('Delete this post?')) return
        try {
            await deleteTravelPost(btn.dataset.id)
            showToast('Post deleted')
            loadPosts()
        } catch (err) { showToast('Failed to delete', 'error') }
    }, { once: true })
}

async function loadPosts() {
    document.getElementById('posts-grid').innerHTML = '<p class="text-gray-600 text-sm">Loading...</p>'
    const posts = await fetchTravelPosts()
    renderPosts(posts)
}

async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    currentUser = user
    renderNav('travel', !!user)
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
        if (profile) {
            renderNavUser(profile.display_name, async () => {
                await supabase.auth.signOut()
                window.location.href = '/index.html'
            })
        }
        document.getElementById('new-post-btn').classList.remove('hidden')
        document.getElementById('new-post-btn').addEventListener('click', () => {
            window.location.href = '/travel-write.html'
        })
    }
    await loadPosts()
}

init()
```

**Step 3: Verify**
- Open `/travel.html` — nav shows Travel as active, posts load (empty state)
- If logged in, "+ New Post" button appears

**Step 4: Commit**
```bash
git add travel.html js/travel.js
git commit -m "Add travel listing page"
```

---

### Task 5: Travel write/edit page (`travel-write.html`)

**Files:**
- Create: `travel-write.html`
- Create: `js/travel-write.js`

**Step 1: Create `travel-write.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Post — Travel</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./css/style.css">
</head>
<body class="bg-gray-950 min-h-screen text-white">

    <header id="main-nav" class="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60"></header>

    <main class="max-w-2xl mx-auto px-4 py-10">
        <h1 id="page-title" class="text-2xl font-bold mb-8">New Travel Post</h1>

        <div class="space-y-5">
            <div>
                <label class="block text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">Title</label>
                <input id="post-title" type="text" placeholder="e.g. Three Days in Hampi" class="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm">
            </div>

            <div>
                <label class="block text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">Destination</label>
                <input id="post-destination" type="text" placeholder="e.g. Hampi, Karnataka" class="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm">
            </div>

            <div>
                <label class="block text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">Your Story</label>
                <textarea id="post-content" placeholder="Write about your trip..." rows="12" class="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-sm resize-none leading-relaxed"></textarea>
            </div>

            <!-- Places visited -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <label class="text-xs text-gray-400 font-semibold uppercase tracking-wider">Places Visited</label>
                    <button id="add-place-btn" class="text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium">+ Add place</button>
                </div>
                <div id="places-list" class="space-y-2"></div>
            </div>

            <div class="flex gap-3 pt-2">
                <button id="publish-btn" class="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold p-3 rounded-xl transition-all shadow-lg shadow-orange-500/20 text-sm">
                    Publish Post
                </button>
                <a href="/travel.html" class="px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-sm transition-colors text-center">
                    Cancel
                </a>
            </div>

            <p id="write-msg" class="text-red-400 text-sm text-center hidden"></p>
        </div>
    </main>

    <script type="module" src="./js/travel-write.js"></script>
</body>
</html>
```

**Step 2: Create `js/travel-write.js`**

```js
import { supabase } from './config.js'
import { insertTravelPost, insertTravelPlace, fetchTravelPost } from './db.js'
import { renderNav, renderNavUser } from './nav.js'
import { showToast } from './ui.js'

let currentUser = null
let places = []   // { name, type, notes }
let editPostId = null

function renderPlaces() {
    const list = document.getElementById('places-list')
    if (!places.length) { list.innerHTML = ''; return }
    list.innerHTML = places.map((p, i) => `
        <div class="flex items-center gap-2 bg-gray-900 rounded-xl p-3 border border-gray-800">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${typeStyle(p.type)}">${p.type}</span>
            <span class="text-sm font-medium flex-1">${p.name}</span>
            ${p.notes ? `<span class="text-xs text-gray-500 truncate max-w-[120px]">${p.notes}</span>` : ''}
            <button class="remove-place text-gray-600 hover:text-red-400 transition-colors text-xs" data-i="${i}">✕</button>
        </div>
    `).join('')
    list.querySelectorAll('.remove-place').forEach(btn => {
        btn.addEventListener('click', () => { places.splice(+btn.dataset.i, 1); renderPlaces() })
    })
}

function typeStyle(type) {
    if (type === 'Eat')  return 'bg-orange-900/40 text-orange-400 border-orange-800/60'
    if (type === 'Stay') return 'bg-blue-900/40 text-blue-400 border-blue-800/60'
    if (type === 'Do')   return 'bg-green-900/40 text-green-400 border-green-800/60'
    return 'bg-purple-900/40 text-purple-400 border-purple-800/60'
}

function addPlaceRow() {
    const div = document.createElement('div')
    div.className = 'flex gap-2 items-start bg-gray-900 rounded-xl p-3 border border-gray-700'
    div.innerHTML = `
        <select class="place-type bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white outline-none font-family-poppins">
            <option>Eat</option><option>Stay</option><option>Do</option><option>See</option>
        </select>
        <input class="place-name flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" placeholder="Place name">
        <input class="place-notes flex-1 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500" placeholder="Notes (optional)">
        <button class="confirm-place text-orange-400 hover:text-orange-300 text-sm px-2 font-bold">✓</button>
        <button class="cancel-place text-gray-600 hover:text-red-400 text-sm px-1">✕</button>
    `
    div.querySelector('.confirm-place').addEventListener('click', () => {
        const name = div.querySelector('.place-name').value.trim()
        if (!name) return
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

    if (!title)       { msg.textContent = 'Add a title'; msg.classList.remove('hidden'); return }
    if (!destination) { msg.textContent = 'Add a destination'; msg.classList.remove('hidden'); return }
    if (!content)     { msg.textContent = 'Write something!'; msg.classList.remove('hidden'); return }

    msg.classList.add('hidden')
    btn.textContent = 'Publishing...'
    btn.disabled = true

    try {
        const postId = await insertTravelPost({ userId: currentUser.id, title, destination, content })
        for (const place of places) {
            await insertTravelPlace({ postId, ...place })
        }
        showToast('Post published! ✈️')
        window.location.href = `/travel-post.html?id=${postId}`
    } catch (err) {
        msg.textContent = err.message || 'Failed to publish'
        msg.classList.remove('hidden')
        btn.textContent = 'Publish Post'
        btn.disabled = false
    }
})

async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/index.html'; return }
    currentUser = user

    renderNav('travel', true)
    const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
    if (profile) renderNavUser(profile.display_name, async () => { await supabase.auth.signOut(); window.location.href = '/index.html' })
}

init()
```

**Step 3: Verify**
- Navigate to `/travel-write.html` while logged out → redirects to home
- While logged in → form loads, can add places, publish creates a post

**Step 4: Commit**
```bash
git add travel-write.html js/travel-write.js
git commit -m "Add travel write page"
```

---

### Task 6: Travel post detail page (`travel-post.html`)

**Files:**
- Create: `travel-post.html`
- Create: `js/travel-post.js`

**Step 1: Create `travel-post.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Travel Post</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./css/style.css">
</head>
<body class="bg-gray-950 min-h-screen text-white">

    <header id="main-nav" class="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/60"></header>

    <main class="max-w-2xl mx-auto px-4 py-10">
        <a href="/travel.html" class="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors">
            ← Back to Travel
        </a>

        <div id="post-content-area">
            <!-- Skeleton -->
            <div class="space-y-4">
                <div class="skeleton h-8 w-3/4"></div>
                <div class="skeleton h-4 w-1/3"></div>
                <div class="skeleton h-32 w-full mt-6"></div>
            </div>
        </div>
    </main>

    <script type="module" src="./js/travel-post.js"></script>
</body>
</html>
```

**Step 2: Create `js/travel-post.js`**

```js
import { supabase } from './config.js'
import { fetchTravelPost } from './db.js'
import { renderNav, renderNavUser } from './nav.js'

function typeStyle(type) {
    if (type === 'Eat')  return 'bg-orange-900/40 text-orange-400 border-orange-800/60'
    if (type === 'Stay') return 'bg-blue-900/40 text-blue-400 border-blue-800/60'
    if (type === 'Do')   return 'bg-green-900/40 text-green-400 border-green-800/60'
    return 'bg-purple-900/40 text-purple-400 border-purple-800/60'
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

function escapeHtml(str) {
    if (!str) return ''
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderPost(post, places, isAuthor) {
    document.title = `${post.title} — Travel`
    const area = document.getElementById('post-content-area')

    const placesHtml = places.length ? `
        <div class="mt-10">
            <h2 class="text-lg font-bold mb-4 text-gray-200">📍 Places Visited</h2>
            <div class="space-y-2">
                ${places.map(p => `
                    <div class="flex items-center gap-3 bg-gray-900 rounded-xl p-3 border border-gray-800">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${typeStyle(p.type)}">${p.type}</span>
                        <span class="font-medium text-sm">${escapeHtml(p.name)}</span>
                        ${p.notes ? `<span class="text-xs text-gray-400 ml-auto">${escapeHtml(p.notes)}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : ''

    area.innerHTML = `
        <div class="flex items-center gap-2 mb-3">
            <span class="text-xs bg-gray-800 border border-gray-700 text-gray-400 px-2 py-0.5 rounded-full">📍 ${escapeHtml(post.destination)}</span>
            <span class="text-xs text-gray-600">${formatDate(post.created_at)}</span>
            ${isAuthor ? `<a href="/travel-write.html?id=${post.id}" class="text-xs text-orange-400 hover:text-orange-300 ml-auto">Edit</a>` : ''}
        </div>
        <h1 class="text-3xl font-bold mb-8 leading-tight">${escapeHtml(post.title)}</h1>
        <div class="text-gray-300 leading-8 text-[15px] whitespace-pre-wrap">${escapeHtml(post.content)}</div>
        ${placesHtml}
    `
}

async function init() {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('id')
    if (!id) { window.location.href = '/travel.html'; return }

    const { data: { user } } = await supabase.auth.getUser()
    renderNav('travel', !!user)

    if (user) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
        if (profile) renderNavUser(profile.display_name, async () => { await supabase.auth.signOut(); window.location.href = '/index.html' })
    }

    const { post, places } = await fetchTravelPost(id)
    renderPost(post, places, user?.id === post.user_id)
}

init()
```

**Step 3: Verify**
- Open `/travel.html`, click a post → `/travel-post.html?id=...` loads with full content
- Places visited section shows if any places were added
- Edit link appears only if you're the author

**Step 4: Commit**
```bash
git add travel-post.html js/travel-post.js
git commit -m "Add travel post detail page"
```

---

### Task 7: Push and verify on Vercel

**Step 1: Copy all files and push**
```bash
cp -r ~/blr-bites/* ~/timelessarchive-codebase/
cd ~/timelessarchive-codebase
git add .
git commit -m "Travel section: listing, write, post pages with shared nav"
git push
```

**Step 2: Verify on timelessarchive.in**
- [ ] BLR Bites loads, nav shows Food | ✈️ Travel
- [ ] Click Travel → listing page loads
- [ ] Logged in → "+ New Post" visible, write a post, publish → redirects to post page
- [ ] Post detail page shows content + places visited
- [ ] Logged out user can read all travel posts
