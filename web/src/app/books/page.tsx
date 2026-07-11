import { fetchBookReviews } from '@/lib/db/books'
import BookFeed from '@/components/books/BookFeed'

export default async function BooksPage() {
    const reviews = await fetchBookReviews()
    return <BookFeed initialReviews={reviews} />
}
