// ── Shared utilities ───────────────────────────────────────────────────────

export function escapeHtml(str) {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function getTimeAgo(dateString) {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return new Date(dateString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function typeStyle(type) {
    if (type === 'Eat')  return 'bg-orange-900/40 text-orange-400 border-orange-800/60'
    if (type === 'Stay') return 'bg-blue-900/40 text-blue-400 border-blue-800/60'
    if (type === 'Do')   return 'bg-green-900/40 text-green-400 border-green-800/60'
    return 'bg-purple-900/40 text-purple-400 border-purple-800/60'
}
