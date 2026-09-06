import process from 'node:process'
import { NextResponse } from 'next/server'
import { SITE_CONSTANTS } from '@/lib/constant'
import { saveLongFormPost } from '@/lib/long-form'

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

    // Helper to run Gemini condensation
    const condenseWithGemini = async (input: string) => {
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not configured')
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

    // Action: Publish
    let condensedText = customCondensedText?.trim() || ''
    if (!condensedText) {
      // Fallback: Condense if not already provided
      condensedText = await condenseWithGemini(text)
    }

    // 2. Post to Telegram
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN
    const telegramChatId = process.env.TELEGRAM_CHAT_ID

    if (!telegramBotToken || !telegramChatId) {
      return NextResponse.json({ error: 'Telegram credentials are not configured' }, { status: 500 })
    }

    let telegramRes: Response
    let isMessageWithCaption = false

    if (videoFile) {
      // sendVideo with direct file upload
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', condensedText)
      tgFormData.append('parse_mode', 'HTML')
      tgFormData.append('supports_streaming', 'true')
      tgFormData.append('video', videoFile)

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, {
        method: 'POST',
        body: tgFormData,
      })
      isMessageWithCaption = telegramRes.ok
    }
    else if (imageFile) {
      // sendPhoto with direct file upload
      const tgFormData = new FormData()
      tgFormData.append('chat_id', telegramChatId)
      tgFormData.append('caption', condensedText)
      tgFormData.append('parse_mode', 'HTML')
      tgFormData.append('photo', imageFile)

      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
        method: 'POST',
        body: tgFormData,
      })
      isMessageWithCaption = telegramRes.ok
    }
    else if (mediaUrl) {
      if (effectiveMediaType === 'video') {
        // Attempt sendVideo by URL
        const tgFormData = new FormData()
        tgFormData.append('chat_id', telegramChatId)
        tgFormData.append('caption', condensedText)
        tgFormData.append('parse_mode', 'HTML')
        tgFormData.append('supports_streaming', 'true')
        tgFormData.append('video', mediaUrl)

        const videoAttempt = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendVideo`, {
          method: 'POST',
          body: tgFormData,
        })

        if (videoAttempt.ok) {
          telegramRes = videoAttempt
          isMessageWithCaption = true
        }
        else {
          // Telegram Bot API rejects files > 50MB via URL; fallback cleanly to sendMessage
          console.warn('[teleboros] Telegram sendVideo by URL failed (likely > 50MB). Falling back to text announcement.')
          telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: condensedText,
              parse_mode: 'HTML',
            }),
          })
          isMessageWithCaption = false
        }
      }
      else {
        // Image by URL
        const tgFormData = new FormData()
        tgFormData.append('chat_id', telegramChatId)
        tgFormData.append('caption', condensedText)
        tgFormData.append('parse_mode', 'HTML')
        tgFormData.append('photo', mediaUrl)

        telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
          method: 'POST',
          body: tgFormData,
        })
        isMessageWithCaption = telegramRes.ok
      }
    }
    else {
      // sendMessage
      telegramRes = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: condensedText,
          parse_mode: 'HTML',
        }),
      })
      isMessageWithCaption = false
    }

    if (!telegramRes.ok) {
      const errorData = await telegramRes.text()
      console.error('Telegram error:', errorData)
      return NextResponse.json({ error: `Failed to post to Telegram: ${errorData}` }, { status: 500 })
    }

    const telegramData = await telegramRes.json()
    const messageId = String(telegramData?.result?.message_id || '')

    // 3. Correlate and store the full-length long-form post, then append backlink to Telegram
    let postUrl = ''
    if (messageId) {
      await saveLongFormPost(
        messageId,
        text,
        condensedText,
        title || undefined,
        mediaUrl || undefined,
        effectiveMediaType || undefined,
      )

      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || SITE_CONSTANTS.siteUrl || 'https://example.com').replace(/\/+$/, '')
      postUrl = `${siteUrl}/posts/${messageId}`
      const actionLabel = effectiveMediaType === 'video' ? '🎬 Watch full video & read article on Teleboros' : '📖 Read full article on Teleboros'
      const backlinkHtml = `\n\n<a href="${postUrl}">${actionLabel}</a>`
      const textWithBacklink = `${condensedText}${backlinkHtml}`

      // Edit the Telegram message to append the backlink
      try {
        if (isMessageWithCaption) {
          await fetch(`https://api.telegram.org/bot${telegramBotToken}/editMessageCaption`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              message_id: messageId,
              caption: textWithBacklink,
              parse_mode: 'HTML',
            }),
          })
        }
        else {
          await fetch(`https://api.telegram.org/bot${telegramBotToken}/editMessageText`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              message_id: messageId,
              text: textWithBacklink,
              parse_mode: 'HTML',
            }),
          })
        }
      }
      catch (editError) {
        console.warn('Failed to edit Telegram message with backlink:', editError)
      }
    }

    // 4. Trigger Deploy Hook
    const deployHookUrl = process.env.DEPLOY_HOOK_URL
    if (deployHookUrl) {
      try {
        await fetch(deployHookUrl, { method: 'POST' })
      }
      catch (e) {
        console.error('Failed to trigger deploy hook:', e)
      }
    }

    return NextResponse.json({ success: true, messageId, postUrl, condensedText })
  }
  catch (error: any) {
    console.error('Compose API error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
