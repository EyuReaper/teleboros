import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'
import { deriveColorToken } from '@/lib/sma/tokens'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const text = searchParams.get('text')?.trim() || 'No inquiry content provided.'
    const seed = searchParams.get('seed')?.trim() || ''
    const tokenBadgeParam = searchParams.get('badge')?.trim()
    const tokenHexParam = searchParams.get('hex')?.trim()
    const sessionTitle = searchParams.get('sessionTitle')?.trim() || 'Live S.M.A Session'
    const channel = searchParams.get('channel')?.trim() || 'Teleboros'

    // Derive or use provided token
    const derived = seed ? deriveColorToken(seed) : null
    const tokenBadge = tokenBadgeParam || derived?.badge || '● Anonymous Inquirer'
    const tokenHex = tokenHexParam || derived?.hex || '#a855f7'
    const tokenBgHex = derived?.bgHex || 'rgba(168, 85, 247, 0.15)'
    const tokenBorderHex = derived?.borderHex || 'rgba(168, 85, 247, 0.4)'

    // Truncate text cleanly if exceedingly long for 1200x675 canvas
    const displayQuestion = text.length > 280 ? `${text.slice(0, 277)}...` : text

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '54px 64px',
            backgroundColor: '#090d16',
            backgroundImage: `radial-gradient(circle at 12% 18%, ${tokenHex}28, transparent 50%), radial-gradient(circle at 88% 82%, rgba(30, 41, 59, 0.6), transparent 50%)`,
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#f8fafc',
            position: 'relative',
          }}
        >
          {/* Outer Border Frame with Adaptive Color Glow */}
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              right: '24px',
              bottom: '24px',
              border: `2px solid ${tokenBorderHex}`,
              borderRadius: '24px',
              boxShadow: `0 0 50px ${tokenHex}22, inset 0 0 30px ${tokenHex}0f`,
              pointerEvents: 'none',
            }}
          />

          {/* Header Row: Token Badge and AMA Session Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            {/* Cryptographic Color Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: tokenBgHex,
                border: `1.5px solid ${tokenBorderHex}`,
                color: tokenHex,
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                boxShadow: `0 0 16px ${tokenHex}33`,
              }}
            >
              <span>{tokenBadge}</span>
            </div>

            {/* AMA Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontSize: '15px',
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 8px #22c55e',
                }}
              />
              <span>LIVE S.M.A</span>
            </div>
          </div>

          {/* Main Question Body */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              padding: '24px 0',
            }}
          >
            <div
              style={{
                color: '#94a3b8',
                fontSize: '20px',
                fontWeight: 500,
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Anonymous Inquiry
            </div>
            <div
              style={{
                color: '#ffffff',
                fontSize: displayQuestion.length > 150 ? '32px' : '40px',
                fontWeight: 700,
                lineHeight: 1.35,
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              &ldquo;{displayQuestion}&rdquo;
            </div>
          </div>

          {/* Footer Row: Channel Branding & Session Subtitle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: tokenHex,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '18px',
                  color: '#090d16',
                }}
              >
                {channel.charAt(0).toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#e2e8f0',
                }}
              >
                {channel}
              </span>
            </div>

            <div
              style={{
                fontSize: '15px',
                color: '#64748b',
                fontWeight: 500,
              }}
            >
              {sessionTitle}
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 675,
      },
    )
  }
  catch (error: any) {
    console.error('Failed to generate Question Card OG:', error)
    return new Response(`Failed to generate question card: ${error.message}`, { status: 500 })
  }
}
