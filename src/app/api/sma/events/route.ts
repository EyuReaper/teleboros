import { subscribeSmaEvents } from '@/lib/sma/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetSessionId = searchParams.get('sessionId')

  const encoder = new TextEncoder()

  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial heartbeat connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`))

      unsubscribe = subscribeSmaEvents((event) => {
        // If client specified sessionId, only filter relevant events
        if (targetSessionId && event.sessionId !== targetSessionId) {
          return
        }

        try {
          const payload = `event: message\ndata: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(payload))
        }
        catch (err) {
          console.error('[sma sse] Failed to enqueue event:', err)
        }
      })

      // Send periodic heartbeat every 20 seconds to prevent proxy disconnect
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        }
        catch {
          clearInterval(heartbeatInterval)
        }
      }, 20_000)

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        if (unsubscribe) {
          unsubscribe()
        }
        try {
          controller.close()
        }
        catch {
          // Stream already closed
        }
      })
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
