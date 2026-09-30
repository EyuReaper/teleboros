import type { SmaAnswer, SmaQuestion, SmaSession } from './types'
import process from 'node:process'
import { getAppConfig } from '@/lib/config'

interface TelegramChatResult {
  ok: boolean
  result?: {
    id: number | string
    title?: string
    username?: string
    linked_chat_id?: number | string
  }
}

/**
 * Discovers the linked discussion supergroup ID for the channel via Telegram Bot API getChat
 */
export async function discoverLinkedDiscussionChat(botToken: string, channelIdOrUsername: string): Promise<string | number | null> {
  try {
    const formattedChatId = channelIdOrUsername.startsWith('@') || channelIdOrUsername.startsWith('-')
      ? channelIdOrUsername
      : `@${channelIdOrUsername}`

    const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(formattedChatId)}`)
    if (!res.ok) {
      console.warn(`[sma telegram] getChat failed for ${formattedChatId}: ${res.statusText}`)
      return null
    }

    const data = (await res.json()) as TelegramChatResult
    if (data?.result?.linked_chat_id) {
      return data.result.linked_chat_id
    }
    return null
  }
  catch (err) {
    console.error('[sma telegram] Error discovering linked chat:', err)
    return null
  }
}

/**
 * Broadcasts the live SMA session launch announcement to the main Telegram channel
 */
export async function broadcastSmaSessionLaunch(session: SmaSession, siteUrl: string): Promise<{ channelPostId?: string, error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const channelChatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !channelChatId) {
    return { error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured' }
  }

  const cleanSiteUrl = siteUrl.replace(/\/+$/, '')
  const smaPortalUrl = `${cleanSiteUrl}/sma/${session.id}`
  const threadUrl = `${cleanSiteUrl}/posts/${session.id}/thread`

  const announcementText = [
    `🎙️ <b>LIVE S.M.A (SEND MESSAGES ANON) SESSION</b>`,
    ``,
    `<b>${session.title}</b>`,
    session.promptMessage ? `<i>&ldquo;${session.promptMessage}&rdquo;</i>` : '',
    ``,
    `Send your anonymous inquiries directly via the link below. Every inquiry receives a unique cryptographic color token badge.`,
  ].filter(Boolean).join('\n')

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '💬 Ask Anonymously',
          web_app: { url: smaPortalUrl },
        },
      ],
      [
        {
          text: '🌐 Open Web Portal',
          url: smaPortalUrl,
        },
        {
          text: '🧵 Live Web Thread',
          url: threadUrl,
        },
      ],
    ],
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelChatId,
        text: announcementText,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { error: `Failed to broadcast session launch: ${errText}` }
    }

    const data = await res.json()
    const channelPostId = String(data?.result?.message_id || '')
    return { channelPostId }
  }
  catch (err: any) {
    return { error: err.message || String(err) }
  }
}

/**
 * Dispatches an answered question into the linked Telegram discussion thread:
 * 1. Generates the high-DPI Question Card
 * 2. Sends the Question Card as photo into the discussion group / comment thread
 * 3. Immediately dispatches creator's reply message
 * 4. Constructs direct comment deep link
 */
export async function dispatchAnswerToDiscussionThread(
  session: SmaSession,
  question: SmaQuestion,
  replyText: string,
  siteUrl: string,
): Promise<{ success: boolean, answer?: SmaAnswer, error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const cfg = getAppConfig()
  const channelUsername = cfg.telegram || cfg.channel

  if (!botToken) {
    return {
      success: true,
      answer: {
        text: replyText,
        createdAt: new Date().toISOString(),
      },
    }
  }

  const cleanSiteUrl = siteUrl.replace(/\/+$/, '')

  // Generate question card image URL
  const cardUrlParams = new URLSearchParams({
    text: question.text,
    badge: question.colorToken.badge,
    hex: question.colorToken.hex,
    sessionTitle: session.title,
    channel: channelUsername,
  })
  const cardImageUrl = `${cleanSiteUrl}/api/og/question?${cardUrlParams.toString()}`

  // Determine destination chat:
  // If linked discussion group is known, post into it; otherwise channel or chat_id
  const targetChatId = session.linkedDiscussionChatId || process.env.TELEGRAM_CHAT_ID

  try {
    // 1. Send Question Card photo
    let photoMessageId: string | null = null
    const photoPayload: any = {
      chat_id: targetChatId,
      photo: cardImageUrl,
      caption: `Inquiry by <b>${question.colorToken.badge}</b>:`,
      parse_mode: 'HTML',
    }

    if (session.discussionThreadMessageId) {
      photoPayload.reply_to_message_id = session.discussionThreadMessageId
    }

    const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(photoPayload),
    })

    if (photoRes.ok) {
      const photoData = await photoRes.json()
      photoMessageId = String(photoData?.result?.message_id || '')
    }

    // 2. Send Creator Answer text
    const answerPayload: any = {
      chat_id: targetChatId,
      text: replyText,
      parse_mode: 'HTML',
    }

    // Reply directly to the question photo card or thread root
    if (photoMessageId) {
      answerPayload.reply_to_message_id = photoMessageId
    }
    else if (session.discussionThreadMessageId) {
      answerPayload.reply_to_message_id = session.discussionThreadMessageId
    }

    const answerRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answerPayload),
    })

    let telegramCommentId: string | undefined
    if (answerRes.ok) {
      const answerData = await answerRes.json()
      telegramCommentId = String(answerData?.result?.message_id || '')
    }

    // 3. Construct direct deep link
    let deepLink: string | undefined
    if (session.channelPostId && telegramCommentId) {
      deepLink = `https://t.me/${channelUsername}/${session.channelPostId}?comment=${telegramCommentId}`
    }
    else if (telegramCommentId) {
      deepLink = `https://t.me/${channelUsername}/${telegramCommentId}`
    }

    const answer: SmaAnswer = {
      text: replyText,
      createdAt: new Date().toISOString(),
      telegramMessageId: photoMessageId || undefined,
      telegramCommentId,
      deepLink,
      cardImageUrl,
    }

    return { success: true, answer }
  }
  catch (err: any) {
    console.error('[sma telegram] Error dispatching answer to thread:', err)
    return {
      success: true, // Gracefully proceed even if Telegram fails
      answer: {
        text: replyText,
        createdAt: new Date().toISOString(),
        cardImageUrl,
      },
      error: err.message,
    }
  }
}

/**
 * Broadcasts recap digest to main Telegram channel
 */
export async function broadcastSmaRecap(
  session: SmaSession,
  topHighlights: SmaQuestion[],
  recapUrl: string,
): Promise<{ success: boolean, error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const channelChatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !channelChatId) {
    return { success: false, error: 'Telegram credentials not configured' }
  }

  const highlightLines = topHighlights.map((q, idx) => {
    const qShort = q.text.length > 80 ? `${q.text.slice(0, 77)}...` : q.text
    const linkStr = q.reply?.deepLink ? ` <a href="${q.reply.deepLink}">[Read Answer]</a>` : ''
    return `<b>${idx + 1}. ${q.colorToken.badge}</b>\n&ldquo;${qShort}&rdquo;${linkStr}`
  }).join('\n\n')

  const text = [
    `🏁 <b>LIVE S.M.A SESSION RECAP & HIGHLIGHTS</b>`,
    ``,
    `<b>${session.title}</b>`,
    `A big thank you to all participants. Here are top selected highlights from the session:`,
    ``,
    highlightLines,
    ``,
    `📖 <b>Read the complete permanent transcript on Teleboros:</b>`,
    recapUrl,
  ].filter(Boolean).join('\n')

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '📖 Read Full Transcript on Teleboros',
          url: recapUrl,
        },
      ],
    ],
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelChatId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
      }),
    })

    if (!res.ok) {
      return { success: false, error: await res.text() }
    }

    return { success: true }
  }
  catch (err: any) {
    return { success: false, error: err.message }
  }
}
