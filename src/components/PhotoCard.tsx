import type { Photo } from '../types/photo'

function formatShotDate(dateValue: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(dateValue))
}

export function PhotoCard({ photo }: { photo: Photo }) {
  return (
    <article className="photo-card">
      <figure>
        <img src={photo.image_url} alt={photo.title} loading="lazy" />
      </figure>
      <div className="photo-meta">
        <span className="photo-date">{formatShotDate(photo.shot_date)}</span>
        <h2 className="photo-title">{photo.title}</h2>
        {photo.caption ? <p className="photo-caption">{photo.caption}</p> : null}
        {photo.tags.length ? (
          <div className="tag-list">
            {photo.tags.map((tag) => (
              <span className="tag" key={`${photo.id}-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
