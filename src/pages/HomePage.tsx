import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PhotoCard } from '../components/PhotoCard'
import { fetchPublicPhotos } from '../lib/photos'
import { isSupabaseConfigured } from '../lib/supabase'
import type { Photo } from '../types/photo'

const PAGE_SIZE = 9

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong while loading photos.'
}

export function HomePage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !hasMore) {
      return
    }

    const rangeStart = page * PAGE_SIZE
    const rangeEnd = rangeStart + PAGE_SIZE - 1
    let cancelled = false

    setIsLoading(true)
    setErrorMessage(null)

    const run = async () => {
      try {
        const nextBatch = await fetchPublicPhotos(rangeStart, rangeEnd)

        if (cancelled) {
          return
        }

        setPhotos((existing) => [...existing, ...nextBatch])
        if (nextBatch.length < PAGE_SIZE) {
          setHasMore(false)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [hasMore, page])

  useEffect(() => {
    if (!hasMore || isLoading || photos.length === 0 || errorMessage) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect()
          setPage((current) => current + 1)
        }
      },
      { rootMargin: '260px 0px' },
    )

    const sentinel = sentinelRef.current
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => observer.disconnect()
  }, [errorMessage, hasMore, isLoading, photos.length])

  return (
    <main className="site-shell">
      <header className="hero">
        <span className="hero-eyebrow">Fine Art and Documentary Work</span>
        <h1>Jesse Fischer Photography</h1>
        <p>
          A journal of stillness, contrast, and moments that are gone before most people notice them.
        </p>
      </header>

      {!isSupabaseConfigured ? (
        <div className="message error">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to load photos.
        </div>
      ) : null}

      {errorMessage ? <div className="message error">{errorMessage}</div> : null}

      <section className="journal-grid" aria-label="Photo journal">
        {photos.map((photo) => (
          <PhotoCard photo={photo} key={photo.id} />
        ))}
      </section>

      {isSupabaseConfigured && !photos.length && !isLoading && !errorMessage ? (
        <div className="message info">No photos yet. Jesse can upload the first set in admin.</div>
      ) : null}

      {isLoading ? <div className="message info">Loading more photos...</div> : null}

      <div className="sentinel" ref={sentinelRef} />

      <footer className="site-footer">
        <Link className="admin-link" to="/admin">
          Admin
        </Link>
      </footer>
    </main>
  )
}
