import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const title = searchParams.get('title')?.trim() || 'Teleboros Microblog'
    const date = searchParams.get('date')?.trim() || ''
    const readingTime = searchParams.get('readingTime')?.trim() || ''
    const channel = searchParams.get('channel')?.trim() || 'Teleboros'
    const username = searchParams.get('username')?.trim() || ''
    const avatar = searchParams.get('avatar')?.trim() || ''
    const badge = searchParams.get('badge')?.trim() || 'Article'
    const siteUrl = searchParams.get('site')?.trim() || ''

    const channelInitial = (channel || 'T').charAt(0).toUpperCase()

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '50px 60px',
            backgroundColor: '#090d16',
            backgroundImage:
              'radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.15), transparent 45%), radial-gradient(circle at 90% 85%, rgba(99, 102, 241, 0.15), transparent 45%)',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#f8fafc',
          }}
        >
          {/* Card Border Frame */}
          <div
            style={{
              position: 'absolute',
              top: '24px',
              left: '24px',
              right: '24px',
              bottom: '24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              pointerEvents: 'none',
            }}
          />

          {/* Header Row: Avatar, Channel Name, Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Channel Avatar */}
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt={channel}
                  width="56"
                  height="56"
                  style={{
                    borderRadius: '50%',
                    border: '2px solid rgba(56, 189, 248, 0.5)',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    border: '2px solid rgba(56, 189, 248, 0.5)',
                    color: '#38bdf8',
                    fontSize: '26px',
                    fontWeight: 700,
                  }}
                >
                  {channelInitial}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {channel}
                </span>
                {username ? (
                  <span
                    style={{
                      fontSize: '15px',
                      color: '#94a3b8',
                      marginTop: '2px',
                    }}
                  >
                    @
                    {username.replace(/^@/, '')}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Type Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#38bdf8',
                  boxShadow: '0 0 10px #38bdf8',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#e2e8f0',
                }}
              >
                {badge}
              </span>
            </div>
          </div>

          {/* Center: Main Post Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              margin: '30px 0',
            }}
          >
            <h1
              style={{
                fontSize: title.length > 80 ? '42px' : title.length > 50 ? '50px' : '58px',
                fontWeight: 800,
                lineHeight: 1.18,
                color: '#ffffff',
                letterSpacing: '-0.03em',
                margin: 0,
                display: '-webkit-box',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>
          </div>

          {/* Footer: Date, Reading Time & Domain */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Meta badges: Date & Reading Time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              {date ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span style={{ fontSize: '16px', color: '#94a3b8', fontWeight: 500 }}>
                    {date}
                  </span>
                </div>
              ) : null}

              {date && readingTime ? (
                <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '18px' }}>•</span>
              ) : null}

              {readingTime ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: '16px', color: '#38bdf8', fontWeight: 600 }}>
                    {readingTime}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Brand / Domain */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#64748b',
                  letterSpacing: '0.02em',
                }}
              >
                {siteUrl ? siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '') : 'Teleboros'}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        },
      },
    )
  }
  catch (error: any) {
    console.error('[teleboros] Failed to generate OG image:', error)
    return new Response(`Failed to generate OG image: ${error?.message || error}`, {
      status: 500,
    })
  }
}
