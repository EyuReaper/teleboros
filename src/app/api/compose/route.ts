import process from 'node:process'
import { NextResponse } from 'next/server'
import { SITE_CONSTANTS } from '@/lib/constant'
import { saveLongFormPost } from '@/lib/long-form'
import { broadcastPushNotification } from '@/lib/push'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const action = (formData.get('action') as string) || 'publish'
    const title = formData.get('title') as string | null
    const text = (formData.get('text') as string) || ''
    const customCondensedText = formData.get('condensedText') as string | null
    const adminToken = formData.get('adminToken') as string
    const mediaUrl = (formData.get('mediaUrl') as string) || null
    const mediaTypeParam = (formData.get('mediaType') as 'video' | 'image' | null) || null
    const image = formData.get('image') as File | null
    const video = formData.get('video') as File | null
    const media = formData.get('media') as File | null

    const videoFile = video || (media && (media.type.startsWith('video/') || /\.(?:mp4|mov|webm|mkv|avi|m4v)$/i.test(media.name)) ? media : null)
    const imageFile = image || (media && !videoFile ? media : null)
    const effectiveMediaType: 'video' | 'image' | null = (videoFile || mediaTypeParam === 'video') ? 'video' : (imageFile || mediaTypeParam === 'image') ? 'image' : null
    const hasMedia = Boolean(videoFile || imageFile || mediaUrl) || formData.get('hasMedia') === 'true'

    // 1. Verify Admin Token
    const envAdminToken = process.env.ADMIN_TOKEN
    if (!envAdminToken || adminToken !== envAdminToken) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Admin Token' }, { status: 401 })
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY

    // Helper to run Gemini condensation with graceful degradation
    const condenseWithGemini = async (input: string) => {
      if (!geminiApiKey) {
        console.warn('[teleboros compose] GEMINI_API_KEY not configured, falling back to manual excerpt')
        return input.slice(0, 800)
      }

      const condensationPrompt = hasMedia
        ? `Condense the following text into an engaging summary teaser for a Telegram video/photo post (strictly UNDER 800 characters so there is room for formatting and links). Use Telegram HTML formatting (like <b>bold</b>, <i>italic</i>, <code>code</code>) if appropriate:\n\n${input}`
        : `Condense the following text for a Telegram post while keeping the main points and making it engaging (strictly UNDER 800 characters). Use Telegram HTML formatting (like <b>bold</b>, <i>italic</i>, <code>code</code>) if appropriate:\n\n${input}`

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: condensationPrompt },
              ],
            },
          ],
        }),
      })

      if (!geminiRes.ok) {
        const errorData = await geminiRes.text()
        console.error('Gemini error:', errorData)
        throw new Error('Failed to condense text with Gemini')
      }

      const geminiData = await geminiRes.json()
      return geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || input.slice(0, 800)
    }

    // Action: Condense only
    if (action === 'condense') {
      const condensedText = await condenseWithGemini(text)
      return NextResponse.json({ success: true, condensedText })
    }

    // Helper to generate canonical post ID / slug
    const generateCanonicalPostId = (postTitle?: string | null): string => {
      if (postTitle?.trim()) {
        const slug = postTitle
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48)
        if (slug) {
          const suffix = Math.random().toString(36).slice(2, 6)
          return `${slug}-${suffix}`
        }
      }
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).slice(2, 6)
      return `p-${timestamp}-${random}`
    }

    // Action: Publish
    const isLongForm = Boolean(
      (customCondensedText && customCondensedText.trim() !== text.trim())
      || text.trim().length > 800,
    )

    let condensedText = customCondensedText?.trim() || ''
    if (isLongForm && !condensedText) {
      // Condense for long-form post teaser
      condensedText = await condenseWithGemini(text)
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || SITE_CONSTANTS.siteUrl || 'https://example.com').replace(/\/+$/, '')
    const canonicalPostId = generateCanonicalPostId(title)
    const postUrl = `${siteUrl}/posts/${canonicalPostId}`

    // 1. STEP 1: Persist the full-length Long-Form Article to Teleboros FIRST
    try {
      await saveLongFormPost(
        canonicalPostId,
        text,
        condensedText,
        title || undefined,
        mediaUrl || undefined,
        effectiveMediaType || undefined,
      )
    }
    catch (teleborosSaveErr: any) {
      console.error('[teleboros] Failed to persist post to Teleboros storage:', teleborosSaveErr)
      return NextResponse.json({
        success: false,
        step: 'teleboros',
        error: `Failed to save article to Teleboros storage: ${teleborosSaveErr?.message || teleborosSaveErr}`,
      }, { status: 500 })
    }

    // 2. STEP 2: Broadcast Short-Form Teaser to Telegram with Inline Keyboard Button
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    if (!telegramBotToken || !telegramChatId) {
      return NextResponse.json({
        success: false,
        step: 'telegram',
        postId: canonicalPostId,
        postUrl,
        error: 'Article saved to Teleboros, but Telegram credentials are not configured.',
      }, { status: 500 })
    }

    // Prepare Telegram text: if short post, send full text; if long-form, send teaser
    const telegramTextToSend = isLongForm ? (condensedText || text.slice(0, 800)) : text.trim()

    // Inline button attached directly to Telegram message (only for long-form posts)
    const replyMarkupObj = isLongForm
      ? {
          inline_keyboard: [
            [
              {
                text: 'Read the full article on Teleboros',
                url: postUrl,
              },
            ],
          ],
        }
      : undefined
    const replyMarkupJson = replyMarkupObj ? JSON.stringify(replyMarkupObj) : undefined

    let telegramRes: Response

    if (videoFile) {
      // sendVideo with direct file upload
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', telegramTextToSend)
      tgFormData.append('parse_mode', 'HTML')
      tgFormData.append('supports_streaming', 'true')
      tgFormData.append('video', videoFile)
      if (replyMarkupJson) {
        tgFormData.append('reply_markup', replyMarkupJson)
      }

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, {
        method: 'POST',
        body: tgFormData,
      })
    }
    else if (imageFile) {
      // sendPhoto with direct file upload
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', telegramTextToSend)
      tgFormData.append('parse_mode', 'HTML')
      tgFormData.append('photo', imageFile)
      if (replyMarkupJson) {
        tgFormData.append('reply_markup', replyMarkupJson)
      }

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
        method: 'POST',
        body: tgFormData,
      })
    }
    else if (mediaUrl) {
      if (effectiveMediaType === 'video') {
        // Attempt sendVideo by URL
        const tgFormData = new FormData()
        tgFormData.append('chat_id', telegramChatId)
        tgFormData.append('caption', telegramTextToSend)
        tgFormData.append('parse_mode', 'HTML')
        tgFormData.append('supports_streaming', 'true')
        tgFormData.append('video', mediaUrl)
        if (replyMarkupJson) {
          tgFormData.append('reply_markup', replyMarkupJson)
        }

        const videoAttempt = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, {
          method: 'POST',
          body: tgFormData,
        })

        if (videoAttempt.ok) {
          telegramRes = videoAttempt
        }
        else {
          // Telegram Bot API rejects files > 50MB via URL; fallback cleanly to sendMessage
          console.warn('[teleboros] Telegram sendVideo by URL failed (likely > 50MB). Falling back to text announcement.')
          const payload: any = {
            chat_id: telegramChatId,
            text: telegramTextToSend,
            parse_mode: 'HTML',
          }
          if (replyMarkupObj) {
            payload.reply_markup = replyMarkupObj
          }

          telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      }
      else {
        // Image by URL
        const tgFormData = new FormData()
        tgFormData.append('chat_id', telegramChatId)
        tgFormData.append('caption', telegramTextToSend)
        tgFormData.append('parse_mode', 'HTML')
        tgFormData.append('photo', mediaUrl)
        if (replyMarkupJson) {
          tgFormData.append('reply_markup', replyMarkupJson)
        }

        telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
          method: 'POST',
          body: tgFormData,
        })
      }
    }
    else {
      // sendMessage
      const payload: any = {
        chat_id: telegramChatId,
        text: telegramTextToSend,
        parse_mode: 'HTML',
      }
      if (replyMarkupObj) {
        payload.reply_markup = replyMarkupObj
      }

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    }

    if (!telegramRes.ok) {
      const errorData = await telegramRes.text()
      console.error('Telegram broadcast error:', errorData)
      return NextResponse.json({
        success: false,
        step: 'telegram',
        postId: canonicalPostId,
        postUrl,
        error: `Article is saved on Teleboros, but Telegram broadcast failed: ${errorData}`,
      }, { status: 502 })
    }

    const telegramData = await telegramRes.json()
    const messageId = String(telegramData?.result?.message_id || '')

    // Create secondary alias under Telegram messageId if distinct from canonicalPostId
    if (messageId && messageId !== canonicalPostId) {
      try {
        await saveLongFormPost(
          messageId,
          text,
          condensedText,
          title || undefined,
          mediaUrl || undefined,
          effectiveMediaType || undefined,
        )
      }
      catch (aliasErr) {
        console.warn('[teleboros] Non-fatal error saving messageId alias:', aliasErr)
      }
    }

    // 3. Trigger Deploy Hook (optional site rebuild)
    const deployHookUrl = process.env.DEPLOY_HOOK_URL
    if (deployHookUrl) {
      try {
        await fetch(deployHookUrl, { method: 'POST' })
      }
      catch (e) {
        console.error('Failed to trigger deploy hook:', e)
      }
    }

    // 4. Optional Web Push Notification Broadcast
    try {
      await broadcastPushNotification({
        title: title || 'New Post Published',
        body: (condensedText || text).slice(0, 140),
        url: postUrl,
      })
    }
    catch (pushErr) {
      console.warn('[teleboros compose] Web Push broadcast warning:', pushErr)
    }

    const channelUsername = (telegramChatId || '').replace(/^@/, '')
    const telegramPostUrl = messageId && channelUsername ? `https://t.me/${channelUsername}/${messageId}` : undefined

    return NextResponse.json({
      success: true,
      postId: canonicalPostId,
      postUrl,
      isLongForm,
      telegramMessageId: messageId,
      telegramPostUrl,
    })
  }
  catch (error: any) {
    console.error('Compose API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
