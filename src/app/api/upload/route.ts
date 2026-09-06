import process from 'node:process'
import { type HandleUploadBody, handleUpload } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  // Resolve Blob token: check standard name, any vercel_blob_rw_ value, or any key with BLOB & TOKEN
  let blobToken = process.env.BLOB_READ_WRITE_TOKEN
  let matchedKey = 'BLOB_READ_WRITE_TOKEN'

  if (!blobToken) {
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string' && value.startsWith('vercel_blob_rw_')) {
        blobToken = value
        matchedKey = key
        break
      }
      if (key.toUpperCase().includes('BLOB') && key.toUpperCase().includes('TOKEN') && value) {
        blobToken = value
        matchedKey = key
        break
      }
    }
  }

  if (!blobToken) {
    const safeKeys = Object.keys(process.env)
      .filter(k => !k.toUpperCase().includes('SECRET') && !k.toUpperCase().includes('KEY') && !k.toUpperCase().includes('TOKEN'))
      .sort()
    return NextResponse.json(
      {
        error:
          `BLOB_READ_WRITE_TOKEN is not configured on Vercel. Available env keys: [${safeKeys.join(', ')}]. Please verify Project Settings -> Environment Variables in Vercel.`,
      },
      { status: 500 },
    )
  }

  try {
    const jsonResponse = await handleUpload({
      token: blobToken,
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // 1. Verify Admin Token
        const envAdminToken = process.env.ADMIN_TOKEN
        if (envAdminToken) {
          let providedToken = ''
          if (clientPayload) {
            try {
              const parsed = JSON.parse(clientPayload)
              providedToken = parsed.adminToken
            }
            catch {
              // Ignore parse failure
            }
          }
          if (!providedToken) {
            providedToken = request.headers.get('x-admin-token') || ''
          }
          if (providedToken !== envAdminToken) {
            throw new Error('Unauthorized: Invalid Admin Token')
          }
        }

        // 2. Configure allowed types and limits
        return {
          allowedContentTypes: [
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-matroska',
            'video/avi',
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/svg+xml',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // Up to 500 MB
          tokenPayload: JSON.stringify({ authorized: true }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('[teleboros blob] Upload completed successfully:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  }
  catch (error: any) {
    console.error('[teleboros blob] handleUpload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to authorize Blob upload' },
      { status: 400 },
    )
  }
}
