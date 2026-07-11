import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// SECURITY NOTE: Supabase anon keys
// ---------------------------------------------------------------------------
// The anon (publishable) key below is INTENTIONALLY public. Supabase designs
// these keys to be used client-side; they are not secrets. Real access control
// is enforced server-side via Row Level Security (RLS) policies configured in
// the Supabase dashboard.
//
// ACTION REQUIRED — KEY ROTATION:
// This key was committed to a public GitHub repo and should be rotated:
//   1. Go to https://app.supabase.com → project settings → API
//   2. Rotate / regenerate the anon key
//   3. Replace the value below with the new key
//
// FUTURE (Phase 2 — Next.js migration):
// This will be replaced by a NEXT_PUBLIC_SUPABASE_ANON_KEY environment
// variable so the key is never hardcoded in source. For now the hardcoded
// value is left in place so the site continues to work until rotation.
// ---------------------------------------------------------------------------

export const supabase = createClient(
    'https://eyhcwmccjkvcpfbkbpea.supabase.co',
    'sb_publishable_bBAzEQACxjmRwd7IqCLEvQ_eLzlOGAM'
)
