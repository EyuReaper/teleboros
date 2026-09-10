import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import webpush from 'web-push'

export interface StoredPushSubscription {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
  createdAt: string
}

const SUBSCRIPTIONS_FILE = path.resolve(process.cwd(), 'data/push-subscriptions.json')

function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:hello@example.com'

  if (publicKey && privateKey) {
    return { publicKey, privateKey, subject }
  }
  return null
}

export async function getStoredSubscriptions(): Promise<StoredPushSubscription[]> {
  try {
    const content = await readFile(SUBSCRIPTIONS_FILE, 'utf8')
    return JSON.parse(content) as StoredPushSubscription[]
  }
  catch {
    return []
  }
}

export async function savePushSubscription(sub: any): Promise<boolean> {
  if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return false
  }

  try {
    await mkdir(path.dirname(SUBSCRIPTIONS_FILE), { recursive: true })
    const list = await getStoredSubscriptions()

    const exists = list.some(item => item.endpoint === sub.endpoint)
    if (!exists) {
      list.push({
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
        createdAt: new Date().toISOString(),
      })
      await writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(list, null, 2), 'utf8')
    }
    return true
  }
  catch (err) {
    console.warn('[teleboros push] Failed to save subscription:', err)
    return false
  }
}

export async function broadcastPushNotification(payload: {
  title: string
  body: string
  url?: string
  icon?: string
}): Promise<{ sent: number, failed: number }> {
  const vapid = getVapidKeys()
  if (!vapid) {
    console.info('[teleboros push] VAPID keys not configured, skipping web push broadcast.')
    return { sent: 0, failed: 0 }
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey)

  const subs = await getStoredSubscriptions()
  if (subs.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const validSubs: StoredPushSubscription[] = []

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    icon: payload.icon || '/favicon.svg',
  })

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys,
        },
        payloadString,
      )
      sent++
      validSubs.push(sub)
    }
    catch (err: any) {
      failed++
      // 404 or 410 indicates the subscription is expired or unsubscribed
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        console.info(`[teleboros push] Pruning expired subscription: ${sub.endpoint.slice(0, 30)}...`)
      }
      else {
        validSubs.push(sub)
      }
    }
  }

  // Prune expired
  if (validSubs.length !== subs.length) {
    try {
      await writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(validSubs, null, 2), 'utf8')
    }
    catch {
      // Ignore write errors
    }
  }

  return { sent, failed }
}
