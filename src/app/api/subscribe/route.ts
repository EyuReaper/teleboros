import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { NextResponse } from 'next/server'

interface SubscriberRecord {
  email: string
  createdAt: string
  source?: string
  provider?: string
}

const SUBSCRIBERS_FILE = path.resolve(process.cwd(), 'data/subscribers.json')

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)
}

async function saveLocalSubscriber(subscriber: SubscriberRecord): Promise<void> {
  try {
    await mkdir(path.dirname(SUBSCRIBERS_FILE), { recursive: true })
    let list: SubscriberRecord[] = []
    try {
      const content = await readFile(SUBSCRIBERS_FILE, 'utf8')
      list = JSON.parse(content)
    }
    catch {
      list = []
    }

    if (!list.some(item => item.email.toLowerCase() === subscriber.email.toLowerCase())) {
      list.push(subscriber)
      await writeFile(SUBSCRIBERS_FILE, JSON.stringify(list, null, 2), 'utf8')
    }
  }
  catch (err) {
    console.warn('[teleboros newsletter] Local write warning:', err)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = (body.email || '').trim().toLowerCase()
    const source = body.source || 'teleboros-website'

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
    }

    const resendKey = process.env.RESEND_API_KEY?.trim()
    const resendAudienceId = process.env.RESEND_AUDIENCE_ID?.trim()
    const buttondownKey = process.env.BUTTONDOWN_API_KEY?.trim()
    const mailchimpKey = process.env.MAILCHIMP_API_KEY?.trim()
    const mailchimpServer = process.env.MAILCHIMP_SERVER_PREFIX?.trim()
    const mailchimpListId = process.env.MAILCHIMP_LIST_ID?.trim()
    const webhookUrl = process.env.NEWSLETTER_WEBHOOK_URL?.trim()

    let activeProvider = 'local'

    // 1. Resend Audiences
    if (resendKey) {
      activeProvider = 'resend'
      try {
        const endpoint = resendAudienceId
          ? `https://api.resend.com/audiences/${resendAudienceId}/contacts`
          : 'https://api.resend.com/contacts'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, unsubscribed: false }),
        })
        if (!res.ok) {
          const errText = await res.text()
          console.warn('[teleboros newsletter] Resend error:', errText)
        }
      }
      catch (e) {
        console.warn('[teleboros newsletter] Resend exception:', e)
      }
    }
    // 2. Buttondown API
    else if (buttondownKey) {
      activeProvider = 'buttondown'
      try {
        const res = await fetch('https://api.buttondown.email/v2/subscribers', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${buttondownKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, tags: ['teleboros'] }),
        })
        if (!res.ok) {
          const errText = await res.text()
          console.warn('[teleboros newsletter] Buttondown error:', errText)
        }
      }
      catch (e) {
        console.warn('[teleboros newsletter] Buttondown exception:', e)
      }
    }
    // 3. Mailchimp API
    else if (mailchimpKey && mailchimpServer && mailchimpListId) {
      activeProvider = 'mailchimp'
      try {
        const res = await fetch(`https://${mailchimpServer}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`any:${mailchimpKey}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: email,
            status: 'subscribed',
          }),
        })
        if (!res.ok) {
          const errText = await res.text()
          console.warn('[teleboros newsletter] Mailchimp error:', errText)
        }
      }
      catch (e) {
        console.warn('[teleboros newsletter] Mailchimp exception:', e)
      }
    }
    // 4. Generic Webhook (Zapier, Make, n8n)
    else if (webhookUrl) {
      activeProvider = 'webhook'
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            source,
            timestamp: new Date().toISOString(),
          }),
        })
      }
      catch (e) {
        console.warn('[teleboros newsletter] Generic webhook error:', e)
      }
    }

    // Always record locally as backup and for zero-config self-hosting
    await saveLocalSubscriber({
      email,
      createdAt: new Date().toISOString(),
      source,
      provider: activeProvider,
    })

    return NextResponse.json({
      success: true,
      provider: activeProvider,
      message: 'Successfully subscribed to updates!',
    })
  }
  catch (error: any) {
    console.error('[teleboros newsletter] subscribe error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
