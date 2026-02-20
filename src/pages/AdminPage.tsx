import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import {
  fetchAdminPhotos,
  permanentlyDeletePhoto,
  restorePhoto,
  softDeletePhoto,
  updatePhotoMetadata,
  uploadPhoto,
} from '../lib/photos'
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase'
import type { Photo, PhotoMetadataInput } from '../types/photo'

type PhotoFormState = {
  title: string
  caption: string
  tags: string
  shotDate: string
}

function createEmptyPhotoForm(): PhotoFormState {
  return {
    title: '',
    caption: '',
    tags: '',
    shotDate: new Date().toISOString().slice(0, 10),
  }
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function formatShotDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
}

function formatDeletedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  )
}

function toMetadataInput(formState: PhotoFormState): PhotoMetadataInput {
  return {
    title: formState.title,
    caption: formState.caption,
    tags: parseTags(formState.tags),
    shot_date: formState.shotDate,
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong. Please try again.'
}

export function AdminPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [uploadForm, setUploadForm] = useState<PhotoFormState>(createEmptyPhotoForm)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [activePhotos, setActivePhotos] = useState<Photo[]>([])
  const [trashPhotos, setTrashPhotos] = useState<Photo[]>([])
  const [photosBusy, setPhotosBusy] = useState(false)
  const [photosError, setPhotosError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<PhotoFormState>(createEmptyPhotoForm)
  const [actionPhotoId, setActionPhotoId] = useState<string | null>(null)

  const isAuthenticated = useMemo(() => Boolean(session?.user), [session])

  const loadPhotos = useCallback(async () => {
    if (!session) {
      return
    }

    setPhotosBusy(true)
    setPhotosError(null)

    try {
      const [active, trash] = await Promise.all([fetchAdminPhotos('active'), fetchAdminPhotos('trash')])
      setActivePhotos(active)
      setTrashPhotos(trash)
    } catch (error) {
      setPhotosError(getErrorMessage(error))
    } finally {
      setPhotosBusy(false)
    }
  }, [session])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }

    const client = getSupabaseClient()
    void client.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setSessionReady(true)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      void loadPhotos()
      return
    }

    setActivePhotos([])
    setTrashPhotos([])
  }, [isAuthenticated, loadPhotos])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isSupabaseConfigured) {
      return
    }

    setAuthLoading(true)
    setAuthError(null)

    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      setPassword('')
    } catch (error) {
      setAuthError(getErrorMessage(error))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!isSupabaseConfigured) {
      return
    }

    const client = getSupabaseClient()
    await client.auth.signOut()
  }

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!session?.user) {
      setUploadError('Log in before uploading photos.')
      return
    }

    if (!uploadFile) {
      setUploadError('Choose an image file first.')
      return
    }

    setUploadBusy(true)
    setUploadError(null)

    try {
      await uploadPhoto({
        file: uploadFile,
        metadata: toMetadataInput(uploadForm),
        userId: session.user.id,
      })

      setUploadForm(createEmptyPhotoForm())
      setUploadFile(null)
      await loadPhotos()
    } catch (error) {
      setUploadError(getErrorMessage(error))
    } finally {
      setUploadBusy(false)
    }
  }

  const beginEdit = (photo: Photo) => {
    setEditingId(photo.id)
    setEditForm({
      title: photo.title,
      caption: photo.caption ?? '',
      tags: photo.tags.join(', '),
      shotDate: photo.shot_date,
    })
  }

  const saveEdit = async () => {
    if (!editingId) {
      return
    }

    setActionPhotoId(editingId)

    try {
      await updatePhotoMetadata(editingId, toMetadataInput(editForm))
      setEditingId(null)
      await loadPhotos()
    } catch (error) {
      setPhotosError(getErrorMessage(error))
    } finally {
      setActionPhotoId(null)
    }
  }

  const handleSoftDelete = async (photoId: string) => {
    setActionPhotoId(photoId)

    try {
      await softDeletePhoto(photoId)
      if (editingId === photoId) {
        setEditingId(null)
      }
      await loadPhotos()
    } catch (error) {
      setPhotosError(getErrorMessage(error))
    } finally {
      setActionPhotoId(null)
    }
  }

  const handleRestore = async (photoId: string) => {
    setActionPhotoId(photoId)

    try {
      await restorePhoto(photoId)
      await loadPhotos()
    } catch (error) {
      setPhotosError(getErrorMessage(error))
    } finally {
      setActionPhotoId(null)
    }
  }

  const handlePermanentDelete = async (photo: Photo) => {
    const shouldDelete = window.confirm(
      'Permanently delete this photo from storage and database? This cannot be undone.',
    )

    if (!shouldDelete) {
      return
    }

    setActionPhotoId(photo.id)

    try {
      await permanentlyDeletePhoto(photo)
      await loadPhotos()
    } catch (error) {
      setPhotosError(getErrorMessage(error))
    } finally {
      setActionPhotoId(null)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="site-shell">
        <div className="message error">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to use admin.
        </div>
        <footer className="site-footer">
          <Link className="admin-link" to="/">
            Back to gallery
          </Link>
        </footer>
      </main>
    )
  }

  if (!sessionReady) {
    return (
      <main className="site-shell">
        <div className="message info">Checking session...</div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-panel panel">
        <h1 className="admin-title">Admin Login</h1>
        <p className="admin-subtitle">Sign in to upload, edit, and manage the live photo journal.</p>

        {authError ? <div className="message error">{authError}</div> : null}

        <form className="form-grid spacer-top" onSubmit={handleLogin}>
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <div className="btn-row">
            <button className="btn primary" disabled={authLoading} type="submit">
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
            <Link className="btn ghost" to="/">
              Back
            </Link>
          </div>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-shell">
      <header className="admin-bar">
        <div>
          <h1 className="admin-title">Jesse Fischer Photos</h1>
          <p className="admin-subtitle">Admin Dashboard</p>
        </div>
        <div className="btn-row">
          <Link className="btn ghost" to="/">
            View Site
          </Link>
          <button className="btn secondary" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      {photosError ? <div className="message error">{photosError}</div> : null}

      <section className="admin-grid">
        <div className="admin-stack">
          <section className="panel">
            <h2>Upload New Photo</h2>
            <p className="admin-subtitle">Add a new image and metadata to the journal.</p>

            {uploadError ? <div className="message error">{uploadError}</div> : null}

            <form className="form-grid spacer-top" onSubmit={handleUpload}>
              <label>
                Photo File
                <input
                  accept="image/*"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  required
                  type="file"
                />
              </label>

              <div className="form-grid two">
                <label>
                  Title
                  <input
                    onChange={(event) =>
                      setUploadForm((existing) => ({ ...existing, title: event.target.value }))
                    }
                    required
                    type="text"
                    value={uploadForm.title}
                  />
                </label>

                <label>
                  Shot Date
                  <input
                    onChange={(event) =>
                      setUploadForm((existing) => ({ ...existing, shotDate: event.target.value }))
                    }
                    required
                    type="date"
                    value={uploadForm.shotDate}
                  />
                </label>
              </div>

              <label>
                Caption
                <textarea
                  onChange={(event) =>
                    setUploadForm((existing) => ({ ...existing, caption: event.target.value }))
                  }
                  value={uploadForm.caption}
                />
              </label>

              <label>
                Tags (comma separated)
                <input
                  onChange={(event) =>
                    setUploadForm((existing) => ({ ...existing, tags: event.target.value }))
                  }
                  placeholder="portrait, monochrome, studio"
                  type="text"
                  value={uploadForm.tags}
                />
              </label>

              <div className="btn-row">
                <button className="btn primary" disabled={uploadBusy} type="submit">
                  {uploadBusy ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="admin-stack">
          <section className="panel">
            <h2>Active Photos</h2>
            <p className="admin-subtitle">Visible on the public gallery.</p>

            {photosBusy ? <div className="message info">Loading photos...</div> : null}

            {!photosBusy && !activePhotos.length ? (
              <div className="empty-state">No active photos yet.</div>
            ) : (
              <div className="photo-admin-list">
                {activePhotos.map((photo) => (
                  <article className="admin-item" key={photo.id}>
                    <div className="admin-item-card">
                      <img alt={photo.title} loading="lazy" src={photo.image_url} />
                      <div className="admin-item-body">
                        <small>{formatShotDate(photo.shot_date)}</small>
                        <h4>{photo.title}</h4>
                        {photo.caption ? <p>{photo.caption}</p> : null}
                        {photo.tags.length ? (
                          <div className="tag-list">
                            {photo.tags.map((tag) => (
                              <span className="tag" key={`${photo.id}-${tag}`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="btn-row spacer-top">
                          {editingId === photo.id ? (
                            <>
                              <button
                                className="btn primary"
                                disabled={actionPhotoId === photo.id}
                                onClick={saveEdit}
                                type="button"
                              >
                                {actionPhotoId === photo.id ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                className="btn ghost"
                                onClick={() => setEditingId(null)}
                                type="button"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button className="btn secondary" onClick={() => beginEdit(photo)} type="button">
                              Edit
                            </button>
                          )}

                          <button
                            className="btn danger"
                            disabled={actionPhotoId === photo.id}
                            onClick={() => void handleSoftDelete(photo.id)}
                            type="button"
                          >
                            {actionPhotoId === photo.id ? 'Moving...' : 'Move to trash'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {editingId === photo.id ? (
                      <div className="panel">
                        <div className="form-grid">
                          <div className="form-grid two">
                            <label>
                              Title
                              <input
                                onChange={(event) =>
                                  setEditForm((existing) => ({ ...existing, title: event.target.value }))
                                }
                                type="text"
                                value={editForm.title}
                              />
                            </label>

                            <label>
                              Shot date
                              <input
                                onChange={(event) =>
                                  setEditForm((existing) => ({ ...existing, shotDate: event.target.value }))
                                }
                                type="date"
                                value={editForm.shotDate}
                              />
                            </label>
                          </div>

                          <label>
                            Caption
                            <textarea
                              onChange={(event) =>
                                setEditForm((existing) => ({ ...existing, caption: event.target.value }))
                              }
                              value={editForm.caption}
                            />
                          </label>

                          <label>
                            Tags (comma separated)
                            <input
                              onChange={(event) =>
                                setEditForm((existing) => ({ ...existing, tags: event.target.value }))
                              }
                              type="text"
                              value={editForm.tags}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h3>Trash</h3>
            <p className="admin-subtitle">Soft-deleted photos can be restored or permanently removed.</p>

            {!trashPhotos.length ? (
              <div className="empty-state">Trash is empty.</div>
            ) : (
              <div className="photo-admin-list">
                {trashPhotos.map((photo) => (
                  <article className="admin-item" key={photo.id}>
                    <div className="admin-item-card">
                      <img alt={photo.title} loading="lazy" src={photo.image_url} />
                      <div className="admin-item-body">
                        <small>
                          Deleted {photo.deleted_at ? formatDeletedDate(photo.deleted_at) : 'recently'}
                        </small>
                        <h4>{photo.title}</h4>
                        {photo.caption ? <p>{photo.caption}</p> : null}

                        <div className="btn-row spacer-top">
                          <button
                            className="btn secondary"
                            disabled={actionPhotoId === photo.id}
                            onClick={() => void handleRestore(photo.id)}
                            type="button"
                          >
                            {actionPhotoId === photo.id ? 'Restoring...' : 'Restore'}
                          </button>
                          <button
                            className="btn danger"
                            disabled={actionPhotoId === photo.id}
                            onClick={() => void handlePermanentDelete(photo)}
                            type="button"
                          >
                            {actionPhotoId === photo.id ? 'Deleting...' : 'Delete forever'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
