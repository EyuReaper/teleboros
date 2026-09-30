import process from 'node:process'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // 1. Authenticate the webhook request
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
    const envSecretToken = process.env.TELEGRAM_WEBHOOK_SECRET

    if (!envSecretToken || secretToken !== envSecretToken) {
      console.warn('Unauthorized webhook request attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read the body to acknowledge the update
    const update = await req.json().catch(() => ({}))
    console.info('Received Telegram webhook update:', update?.update_id)

    // 2. Detect if update contains a new or edited message / channel post
    const msg = update?.message || update?.edited_message
    const hasMessage = Boolean(
      msg
      || update?.channel_post
      || update?.edited_channel_post,
    )

    if (!hasMessage) {
      console.info('Telegram update contains no new message/post, skipping deploy:', update?.update_id)
      return NextResponse.json({ success: true, message: 'No new message detected' })
    }

    // Capture forwarded thread root message in discussion supergroup for active SMA session
    if (msg?.forward_from_message_id || msg?.is_automatic_forward) {
      try {
        const { getActiveSession, saveSession } = await import('@/lib/sma/store')
        const activeSession = await getActiveSession()
        const forwardId = String(msg.forward_from_message_id || '')
        if (activeSession && activeSession.channelPostId && forwardId === String(activeSession.channelPostId)) {
          activeSession.discussionThreadMessageId = msg.message_id
          if (msg.chat?.id) {
            activeSession.linkedDiscussionChatId = msg.chat.id
          }
          await saveSession(activeSession)
          console.info(`[sma webhook] Captured discussion thread root message ${msg.message_id} for session ${activeSession.id}`)
        }
      }
      catch (smaErr) {
        console.warn('[sma webhook] Error checking forwarded SMA thread:', smaErr)
      }
    }

    // 3. Trigger Deploy Hook
    const deployHookUrl = process.env.DEPLOY_HOOK_URL
    if (deployHookUrl) {
      try {
        await fetch(deployHookUrl, { method: 'POST' })
        console.info('Successfully triggered Vercel deploy hook')
      }
      catch (e) {
        console.error('Failed to trigger deploy hook:', e)
      }
    }
    else {
      console.warn('DEPLOY_HOOK_URL is not configured. Skipping deployment.')
    }

    // Always return 200 OK to Telegram so it doesn't retry
    return NextResponse.json({ success: true, triggered: Boolean(deployHookUrl) })
  }
  catch (error: any) {
    console.error('Webhook API error:', error)
    // Even on error, return 200 OK so Telegram stops retrying the failing update
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 200 })
  }
}
