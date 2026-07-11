import { fetchBookReviews } from '@/lib/db/books'
import BookFeed from '@/components/books/BookFeed'

export const dynamic = 'force-dynamic'

export default async function BooksPage() {
    const reviews = await fetchBookReviews()
    return <BookFeed initialReviews={reviews} />
}
