'use client'

import { Bell, BellRing, Check, Loader2 } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushNotificationButton({ className }: { className?: string }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [loading, setLoading] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission)

    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(Boolean(sub))
      })
    }).catch(() => {})
  }, [])

  if (permission === 'unsupported' || permission === 'denied') {
    return null
  }

  const handleSubscribe = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        setLoading(false)
        return
      }

      const registration = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      const subOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      }

      if (vapidKey) {
        subOptions.applicationServerKey = urlBase64ToUint8Array(vapidKey)
      }

      const subscription = await registration.pushManager.subscribe(subOptions)

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })

      setIsSubscribed(true)
    }
    catch (err) {
      console.warn('Web Push subscription failed:', err)
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className || 'h-8 text-xs gap-1.5'}
      onClick={handleSubscribe}
      disabled={loading || (permission === 'granted' && isSubscribed)}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isSubscribed ? (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          <span>Notifications Active</span>
        </>
      ) : (
        <>
          <Bell className="h-3.5 w-3.5" />
          <span>Enable Push Alerts</span>
        </>
      )}
    </Button>
  )
}
