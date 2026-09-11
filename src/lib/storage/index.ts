import type { LongFormPost, PresignedUploadUrl, StorageAdapter, StorageUploadResult } from './types'
import { LocalStorageAdapter } from './adapters/local'
import { CloudflareR2Adapter } from './adapters/r2'
import { VercelBlobStorageAdapter } from './adapters/vercel-blob'

export * from './types'

let r2AdapterInstance: CloudflareR2Adapter | null = null
let blobAdapterInstance: VercelBlobStorageAdapter | null = null
let localAdapterInstance: LocalStorageAdapter | null = null

function getR2Adapter(): CloudflareR2Adapter {
  if (!r2AdapterInstance) {
    r2AdapterInstance = new CloudflareR2Adapter()
  }
  return r2AdapterInstance
}

function getBlobAdapter(): VercelBlobStorageAdapter {
  if (!blobAdapterInstance) {
    blobAdapterInstance = new VercelBlobStorageAdapter()
  }
  return blobAdapterInstance
}

function getLocalAdapter(): LocalStorageAdapter {
  if (!localAdapterInstance) {
    localAdapterInstance = new LocalStorageAdapter()
  }
  return localAdapterInstance
}

/**
 * Resolve the primary storage adapter based on environment configuration:
 * 1. Cloudflare R2 (Recommended primary production adapter: zero egress fees, 10GB free tier)
 * 2. Vercel Blob (Turnkey 1-click Vercel deployments)
 * 3. Local Filesystem (Docker, self-hosted VPS, or local development)
 */
export function getStorageAdapter(): StorageAdapter {
  const r2 = getR2Adapter()
  if (r2.isConfigured()) {
    return r2
  }

  const blob = getBlobAdapter()
  if (blob.isConfigured()) {
    return blob
  }

  return getLocalAdapter()
}

/**
 * Returns all configured adapters in priority order.
 */
export function getAllActiveAdapters(): StorageAdapter[] {
  const adapters: StorageAdapter[] = []
  const r2 = getR2Adapter()
  if (r2.isConfigured()) {
    adapters.push(r2)
  }
  const blob = getBlobAdapter()
  if (blob.isConfigured()) {
    adapters.push(blob)
  }
  adapters.push(getLocalAdapter())
  return adapters
}

export function getPrimaryStorageName(): 'r2' | 'blob' | 'local' {
  return getStorageAdapter().name
}

const postLookupCache = new Map<string, { post: LongFormPost | null, timestamp: number }>()
const LOOKUP_CACHE_TTL_MS = 60_000

/**
 * Save post across storage with graceful degradation:
 * Writes to primary adapter, and replicates locally when possible for zero-latency lookups.
 */
export async function savePost(id: string, post: LongFormPost): Promise<void> {
  const primary = getStorageAdapter()
  const local = getLocalAdapter()

  let primarySaved = false

  if (primary.name !== 'local') {
    try {
      await primary.savePost(id, post)
      primarySaved = true
    }
    catch (err) {
      console.warn(`[teleboros storage] Primary adapter (${primary.name}) failed to save post ${id}:`, err)
    }
  }

  // Dual-write or graceful degradation to local filesystem
  try {
    await local.savePost(id, post)
  }
  catch (fsErr) {
    if (!primarySaved) {
      throw fsErr
    }
  }

  postLookupCache.set(id, { post, timestamp: Date.now() })
}

/**
 * Load post with fallback resolution:
 * Checks memory cache and local filesystem first for instant response, then queries cloud storage if missing.
 */
export async function loadPost(id: string): Promise<LongFormPost | null> {
  const cached = postLookupCache.get(id)
  if (cached && Date.now() - cached.timestamp < LOOKUP_CACHE_TTL_MS) {
    return cached.post
  }

  // 1. Try local filesystem first (instant disk hit)
  const local = getLocalAdapter()
  try {
    const localPost = await local.loadPost(id)
    if (localPost) {
      postLookupCache.set(id, { post: localPost, timestamp: Date.now() })
      return localPost
    }
  }
  catch {
    // Continue to cloud adapters
  }

  // 2. Query configured cloud adapters
  const r2 = getR2Adapter()
  if (r2.isConfigured()) {
    try {
      const r2Post = await r2.loadPost(id)
      if (r2Post) {
        postLookupCache.set(id, { post: r2Post, timestamp: Date.now() })
        return r2Post
      }
    }
    catch {
      // Continue to next adapter
    }
  }

  const blob = getBlobAdapter()
  if (blob.isConfigured()) {
    try {
      const blobPost = await blob.loadPost(id)
      if (blobPost) {
        postLookupCache.set(id, { post: blobPost, timestamp: Date.now() })
        return blobPost
      }
    }
    catch {
      // Ignore
    }
  }

  postLookupCache.set(id, { post: null, timestamp: Date.now() })
  return null
}

/**
 * Upload media using the best available storage adapter.
 */
export async function uploadMedia(
  file: Buffer | Uint8Array | ArrayBuffer | Blob,
  filename: string,
  contentType: string,
): Promise<StorageUploadResult> {
  const primary = getStorageAdapter()
  try {
    return await primary.uploadMedia(file, filename, contentType)
  }
  catch (primaryErr) {
    console.warn(`[teleboros storage] Primary adapter (${primary.name}) media upload failed, falling back to local:`, primaryErr)
    const local = getLocalAdapter()
    return await local.uploadMedia(file, filename, contentType)
  }
}

/**
 * Get presigned URL for direct-to-cloud client-side uploads (e.g. Cloudflare R2).
 */
export async function getPresignedUploadUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUploadUrl | null> {
  const r2 = getR2Adapter()
  if (r2.isConfigured() && r2.getPresignedUploadUrl) {
    return await r2.getPresignedUploadUrl(filename, contentType)
  }
  return null
}
