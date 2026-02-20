export type Photo = {
  id: string
  title: string
  caption: string | null
  tags: string[]
  shot_date: string
  image_path: string
  image_url: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PhotoMetadataInput = {
  title: string
  caption: string
  tags: string[]
  shot_date: string
}
