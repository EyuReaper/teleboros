import type { NextRequest } from 'next/server'
import { render as renderPele, supports as peleSupports } from 'pele'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawCode = searchParams.get('diagram') || searchParams.get('code') || ''
    const title = searchParams.get('title')?.trim() || 'Architecture Diagram'
    const format = searchParams.get('format')?.toLowerCase() || 'svg'

    if (!rawCode.trim()) {
      return new Response('Missing required ?diagram= parameter', { status: 400 })
    }

    let decoded = rawCode
    try {
      if (rawCode.startsWith('base64:')) {
        decoded = Buffer.from(rawCode.slice(7), 'base64').toString('utf-8')
      }
    }
    catch {
      // Use rawCode as-is
    }

    if (!peleSupports(decoded.trim())) {
      return new Response('Diagram type not supported by Pele', { status: 422 })
    }

    const result = renderPele(decoded.trim())
    if (!result || !result.svg) {
      return new Response('Failed to compile diagram to SVG', { status: 500 })
    }

    // Return pure vector SVG with generous edge caching
    return new Response(result.svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    })
  }
  catch (error: any) {
    console.error('[teleboros] OG Diagram generation failed:', error)
    return new Response(`Error generating diagram: ${error?.message || error}`, { status: 500 })
  }
}
