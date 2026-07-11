import { fetchTravelPosts } from '@/lib/db/travel'
import TravelList from '@/components/travel/TravelList'

export const dynamic = 'force-dynamic'

export default async function TravelPage() {
    const posts = await fetchTravelPosts()
    return <TravelList posts={posts} />
}
