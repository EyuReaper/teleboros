import JSZip from 'jszip'
import { extractLocalMediaReferences, parseMarkdownFrontmatter, rewriteMarkdownMediaUrls } from './markdown'

export interface BundleImportResult {
  title?: string
  text: string
  tags?: string[]
  coverUrl?: string
  uploadedAssetsCount: number
  warnings: string[]
}

export type ProgressCallback = (stage: string, percent: number) => void

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_MAP[ext] || 'application/octet-stream'
}

function normalizeZipPath(baseDir: string, relativePath: string): string {
  const cleanRelative = decodeURIComponent(relativePath.replace(/^[./]+/, ''))
  if (!baseDir)
    return cleanRelative

  const parts = baseDir.split('/').filter(Boolean)
  for (const seg of cleanRelative.split('/')) {
    if (seg === '..') {
      parts.pop()
    }
    else if (seg && seg !== '.') {
      parts.push(seg)
    }
  }
  return parts.join('/')
}

/**
 * Import a standalone Markdown file (.md) or a zipped Markdown bundle (.zip).
 * Automatically extracts frontmatter, uploads local media to configured storage,
 * and rewrites relative links to public CDN URLs.
 */
export async function importMarkdownBundle(
  file: File,
  uploadFn: (fileToUpload: File) => Promise<string>,
  onProgress?: ProgressCallback,
): Promise<BundleImportResult> {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip')
  const warnings: string[] = []

  // 1. Process Standalone Markdown File
  if (!isZip) {
    onProgress?.('Reading Markdown file...', 20)
    const rawText = await file.text()
    const { frontmatter, body } = parseMarkdownFrontmatter(rawText)

    const title = frontmatter.title || file.name.replace(/\.(?:md|markdown)$/i, '').replace(/[-_]/g, ' ')
    const localRefs = extractLocalMediaReferences(body)
    if (localRefs.length > 0) {
      warnings.push(`Found ${localRefs.length} local media link(s) without companion files. You can drag and drop or paste (Ctrl+V) images directly into the editor.`)
    }

    onProgress?.('Import complete', 100)
    return {
      title,
      text: body,
      tags: frontmatter.tags,
      uploadedAssetsCount: 0,
      warnings,
    }
  }

  // 2. Process Zip Archive
  onProgress?.('Reading .zip archive...', 10)
  const zip = await JSZip.loadAsync(file)

  // Find all markdown files (ignore MacOS metadata folders)
  const mdEntries = Object.keys(zip.files).filter((path) => {
    const entry = zip.files[path]
    return !entry.dir && /\.(?:md|markdown)$/i.test(path) && !path.startsWith('__MACOSX/')
  })

  if (mdEntries.length === 0) {
    throw new Error('No Markdown (.md or .markdown) file found in the zip archive.')
  }

  // Select primary markdown file (prefer index.md, README.md, or top-level/first)
  let primaryMdKey = mdEntries.find(p => /(?:^|\/)index\.md$/i.test(p))
  if (!primaryMdKey) {
    primaryMdKey = mdEntries.find(p => /(?:^|\/)README\.md$/i.test(p))
  }
  if (!primaryMdKey) {
    primaryMdKey = mdEntries.find(p => !p.includes('/')) || mdEntries[0]
  }

  onProgress?.(`Parsing ${primaryMdKey}...`, 25)
  const rawContent = await zip.files[primaryMdKey].async('string')
  const { frontmatter, body } = parseMarkdownFrontmatter(rawContent)

  const mdDir = primaryMdKey.includes('/') ? primaryMdKey.slice(0, primaryMdKey.lastIndexOf('/')) : ''

  // Locate local media references in the markdown body
  const localRefs = extractLocalMediaReferences(body)
  const urlMap: Record<string, string> = {}
  let uploadedCount = 0

  const totalAssets = localRefs.length + (frontmatter.cover ? 1 : 0)
  let processedAssets = 0

  // Helper to find a file in the zip
  const findZipEntry = (refPath: string) => {
    const normalized = normalizeZipPath(mdDir, refPath)
    if (zip.files[normalized] && !zip.files[normalized].dir) {
      return { key: normalized, entry: zip.files[normalized] }
    }
    // Search case-insensitive or by basename
    const lower = normalized.toLowerCase()
    for (const [key, entry] of Object.entries(zip.files)) {
      if (!entry.dir && key.toLowerCase() === lower) {
        return { key, entry }
      }
    }
    const basename = normalized.split('/').pop()?.toLowerCase()
    if (basename) {
      for (const [key, entry] of Object.entries(zip.files)) {
        if (!entry.dir && key.split('/').pop()?.toLowerCase() === basename) {
          return { key, entry }
        }
      }
    }
    return null
  }

  // Upload local media referenced in markdown
  for (const ref of localRefs) {
    const match = findZipEntry(ref)
    if (!match) {
      warnings.push(`Referenced asset not found in archive: ${ref}`)
      continue
    }

    try {
      processedAssets++
      const pct = Math.round(25 + (processedAssets / Math.max(1, totalAssets)) * 70)
      const filename = match.key.split('/').pop() || 'media'
      onProgress?.(`Uploading ${filename} (${processedAssets}/${totalAssets})...`, pct)

      const blob = await match.entry.async('blob')
      const mimeType = getMimeType(filename)
      const assetFile = new File([blob], filename, { type: mimeType })

      const cdnUrl = await uploadFn(assetFile)
      urlMap[ref] = cdnUrl
      uploadedCount++
    }
    catch (uploadErr: any) {
      warnings.push(`Failed to upload ${ref}: ${uploadErr.message || uploadErr}`)
    }
  }

  // Process cover image from frontmatter if present
  let uploadedCoverUrl: string | undefined
  if (frontmatter.cover) {
    const coverRef = String(frontmatter.cover)
    if (urlMap[coverRef]) {
      uploadedCoverUrl = urlMap[coverRef]
    }
    else if (!coverRef.startsWith('http://') && !coverRef.startsWith('https://')) {
      const coverMatch = findZipEntry(coverRef)
      if (coverMatch) {
        try {
          processedAssets++
          const filename = coverMatch.key.split('/').pop() || 'cover'
          onProgress?.(`Uploading cover ${filename}...`, 95)
          const blob = await coverMatch.entry.async('blob')
          const mimeType = getMimeType(filename)
          const assetFile = new File([blob], filename, { type: mimeType })
          uploadedCoverUrl = await uploadFn(assetFile)
          urlMap[coverRef] = uploadedCoverUrl
          uploadedCount++
        }
        catch (err: any) {
          warnings.push(`Failed to upload cover: ${err.message || err}`)
        }
      }
    }
    else {
      uploadedCoverUrl = coverRef
    }
  }

  onProgress?.('Rewriting media links in Markdown...', 98)
  const rewrittenBody = rewriteMarkdownMediaUrls(body, urlMap)

  const derivedTitle = frontmatter.title || primaryMdKey.split('/').pop()?.replace(/\.(?:md|markdown)$/i, '').replace(/[-_]/g, ' ')

  onProgress?.('Bundle imported successfully!', 100)

  return {
    title: derivedTitle,
    text: rewrittenBody,
    tags: frontmatter.tags,
    coverUrl: uploadedCoverUrl,
    uploadedAssetsCount: uploadedCount,
    warnings,
  }
}
