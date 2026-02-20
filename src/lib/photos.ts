import type { Photo, PhotoMetadataInput } from '../types/photo'
import { getSupabaseClient, PHOTOS_BUCKET } from './supabase'

type PhotoRow = {
  id: string
  title: string
  caption: string | null
  tags: string[] | null
  shot_date: string
  image_path: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const PHOTO_COLUMNS =
  'id,title,caption,tags,shot_date,image_path,created_at,updated_at,deleted_at'

function mapPhotoRow(row: PhotoRow): Photo {
  const client = getSupabaseClient()
  const { data } = client.storage.from(PHOTOS_BUCKET).getPublicUrl(row.image_path)

  return {
    ...row,
    tags: row.tags ?? [],
    image_url: data.publicUrl,
  }
}

function cleanMetadata(metadata: PhotoMetadataInput) {
  return {
    title: metadata.title.trim(),
    caption: metadata.caption.trim() ? metadata.caption.trim() : null,
    tags: metadata.tags.map((tag) => tag.trim()).filter(Boolean),
    shot_date: metadata.shot_date,
  }
}

function sanitizeFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-')
}

export async function fetchPublicPhotos(from: number, to: number): Promise<Photo[]> {
  const client = getSupabaseClient()

  const { data, error } = await client
    .from('photos')
    .select(PHOTO_COLUMNS)
    .is('deleted_at', null)
    .order('shot_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  return (data as PhotoRow[]).map(mapPhotoRow)
}

export async function fetchAdminPhotos(mode: 'active' | 'trash'): Promise<Photo[]> {
  const client = getSupabaseClient()

  let query = client
    .from('photos')
    .select(PHOTO_COLUMNS)
    .order('shot_date', { ascending: false })
    .order('created_at', { ascending: false })

  query = mode === 'active' ? query.is('deleted_at', null) : query.not('deleted_at', 'is', null)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return (data as PhotoRow[]).map(mapPhotoRow)
}

export async function uploadPhoto({
  file,
  metadata,
  userId,
}: {
  file: File
  metadata: PhotoMetadataInput
  userId: string
}): Promise<Photo> {
  const client = getSupabaseClient()
  const filePath = `${userId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.name)}`

  const { error: uploadError } = await client.storage.from(PHOTOS_BUCKET).upload(filePath, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: '3600',
  })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const payload = cleanMetadata(metadata)

  const { data, error } = await client
    .from('photos')
    .insert({
      ...payload,
      image_path: filePath,
    })
    .select(PHOTO_COLUMNS)
    .single()

  if (error) {
    await client.storage.from(PHOTOS_BUCKET).remove([filePath])
    throw new Error(error.message)
  }

  return mapPhotoRow(data as PhotoRow)
}

export async function updatePhotoMetadata(photoId: string, metadata: PhotoMetadataInput) {
  const client = getSupabaseClient()

  const payload = cleanMetadata(metadata)

  const { data, error } = await client
    .from('photos')
    .update(payload)
    .eq('id', photoId)
    .select(PHOTO_COLUMNS)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapPhotoRow(data as PhotoRow)
}

export async function softDeletePhoto(photoId: string) {
  const client = getSupabaseClient()

  const { error } = await client
    .from('photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', photoId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function restorePhoto(photoId: string) {
  const client = getSupabaseClient()

  const { error } = await client.from('photos').update({ deleted_at: null }).eq('id', photoId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function permanentlyDeletePhoto(photo: Photo) {
  const client = getSupabaseClient()

  const { error: storageError } = await client.storage.from(PHOTOS_BUCKET).remove([photo.image_path])

  if (storageError && !/not found/i.test(storageError.message)) {
    throw new Error(storageError.message)
  }

  const { error } = await client.from('photos').delete().eq('id', photo.id)

  if (error) {
    throw new Error(error.message)
  }
}
