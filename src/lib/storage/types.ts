export interface LongFormPost {
  id: string
  title?: string
  text: string
  html: string
  condensedText?: string
  mediaUrl?: string
  mediaType?: 'video' | 'image' | 'audio'
  createdAt: string
}

export interface StorageUploadResult {
  url: string
  key?: string
  size?: number
  contentType?: string
}

export interface PresignedUploadUrl {
  uploadUrl: string
  publicUrl: string
  method: 'PUT' | 'POST'
  headers?: Record<string, string>
  fields?: Record<string, string>
}

export interface StorageAdapter {
  readonly name: 'r2' | 'blob' | 'local'
  isConfigured: () => boolean
  uploadMedia: (
    file: Buffer | Uint8Array | ArrayBuffer | Blob,
    filename: string,
    contentType: string,
  ) => Promise<StorageUploadResult>
  savePost: (id: string, post: LongFormPost) => Promise<void>
  loadPost: (id: string) => Promise<LongFormPost | null>
  getPresignedUploadUrl?: (
    filename: string,
    contentType: string,
  ) => Promise<PresignedUploadUrl>
}
