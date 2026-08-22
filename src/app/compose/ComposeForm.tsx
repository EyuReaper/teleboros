'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ComposeForm() {
  const [text, setText] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append('text', text)
      formData.append('adminToken', adminToken)
      if (image) {
        formData.append('image', image)
      }

      const res = await fetch('/api/compose', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setStatus({ type: 'success', message: 'Post successfully condensed and sent to Telegram!' })
      setText('')
      setImage(null)
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div>
        <label htmlFor="text" className="block text-sm font-medium mb-1">
          Post Content (will be condensed by AI)
        </label>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          rows={6}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Write your long post here..."
        />
      </div>

      <div>
        <label htmlFor="image" className="block text-sm font-medium mb-1">
          Attach Image (optional)
        </label>
        <input
          id="image"
          type="file"
          accept="image/*"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div>
        <label htmlFor="adminToken" className="block text-sm font-medium mb-1">
          Admin Token
        </label>
        <input
          id="adminToken"
          type="password"
          value={adminToken}
          onChange={(e) => setAdminToken(e.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Secret password..."
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Condense & Post'}
      </Button>

      {status && (
        <div className={`p-3 rounded-md text-sm ${status.type === 'success' ? 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-400'}`}>
          {status.message}
        </div>
      )}
    </form>
  )
}
