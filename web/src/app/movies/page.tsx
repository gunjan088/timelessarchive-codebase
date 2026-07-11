import { fetchScreenReviews } from '@/lib/db/movies'
import MovieFeed from '@/components/movies/MovieFeed'

export default async function MoviesPage() {
    const reviews = await fetchScreenReviews()
    return <MovieFeed initialReviews={reviews} />
}
