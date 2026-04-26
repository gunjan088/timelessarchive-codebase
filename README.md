# Somewhere Good

A personal site for tracking the things worth going back to — food, travel, movies.

**Live:** [timelessarchive.in](https://timelessarchive.in)

---

## What's here

| Section | What it does |
|---|---|
| 🍽️ Food | Restaurant + dish reviews for Bangalore. Rate as Loved / Once / Skip. Filter by cuisine, search by name. |
| ✈️ Travel | Long-form travel posts with a places-visited list (Eat / Stay / Do / See). |
| 🎬 Movies | Movie and show reviews. Filter by type (Movie / Series / Documentary). |
| 🔖 Wishlist | Per-section personal wishlist — visible only when logged in. Mark as visited to convert to a review. |

---

## Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript (ES modules, no build step)
- **Styling:** Tailwind CSS via CDN + custom animations in `css/style.css`
- **Backend:** [Supabase](https://supabase.com) — Postgres + Auth + Realtime
- **Hosting:** [Vercel](https://vercel.com) — static site, auto-deploy from main

---

## Project structure

```
├── index.html          # Food reviews page
├── travel.html         # Travel posts listing
├── travel-write.html   # Write a new travel post
├── travel-post.html    # View a single travel post
├── movies.html         # Movies & shows page
├── css/
│   └── style.css       # Animations, filter chips, cards, modal, toast
└── js/
    ├── config.js       # Supabase client
    ├── utils.js        # Shared: escapeHtml, getTimeAgo, formatDate, typeStyle
    ├── db.js           # All Supabase queries
    ├── nav.js          # Shared nav bar (renderNav, renderNavUser)
    ├── ui.js           # Shared UI: cards, skeletons, toast, modal, cuisine pills
    ├── wishlist.js     # Shared wishlist cards + add-to-wishlist modal
    ├── app.js          # Food page logic
    ├── travel.js       # Travel listing logic
    ├── travel-write.js # Write post logic
    ├── travel-post.js  # View post logic
    └── movies.js       # Movies page logic
```

---

## Database (Supabase)

Tables: `restaurants`, `reviews`, `profiles`, `travel_posts`, `travel_places`, `wishlists`, `screen_reviews`

Row Level Security is enabled on all tables. Public read on reviews, travel posts, and screen reviews. Write operations require auth.

---

## Running locally

No build step needed — just serve the files:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080`.

---

## Deploying

Push to `main` → Vercel auto-deploys. The Supabase URL and public key are in `js/config.js`.
