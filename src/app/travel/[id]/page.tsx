import { fetchTravelPost } from '@/lib/db/travel'
import TravelPost from '@/components/travel/TravelPost'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function TravelPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const { post, places } = await fetchTravelPost(id)
        return <TravelPost post={post} places={places} />
    } catch {
        notFound()
    }
}
