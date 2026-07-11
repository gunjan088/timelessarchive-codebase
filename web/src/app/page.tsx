import { fetchReviews, getUniqueCuisines } from '@/lib/db/food'
import ReviewFeed from '@/components/food/ReviewFeed'

export default async function FoodPage() {
    const [reviews, cuisines] = await Promise.all([
        fetchReviews(),
        getUniqueCuisines(),
    ])
    return <ReviewFeed initialReviews={reviews} cuisines={cuisines} />
}
