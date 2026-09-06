'use client'

import { upload } from '@vercel/blob/client'
import { AlertCircle, Check, ExternalLink, Eye, FileText, Film, Globe, Image as ImageIcon, Loader2, Send, Sparkles, X } from 'lucide-react'
import { marked } from 'marked'
import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'teleboros_admin_token'
const MAX_MEDIA_BYTES = 4.5 * 1024 * 1024 // 4.5 MB Vercel Serverless Function payload limit

async function parseApiResponse(res: Response) {
  if (res.status === 413) {
    throw new Error('Payload too large (HTTP 413): The uploaded media exceeds Vercel\'s 4.5 MB serverless limit. Please compress the file or post directly to your Telegram channel (supports up to 2 GB).')
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Request failed with status ${res.status}`)
      }
      return data
    }
    catch (err: any) {
      if (!res.ok) {
        throw err
      }
      throw new Error('Failed to parse server response as JSON')
    }
  }

  const rawText = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(rawText || `Request failed with status ${res.status}`)
  }
  return { rawText }
}

function formatTelegramPreviewHtml(text: string): string {
  if (!text)
    return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)([bius]|strong|em|ins|strike|del|code|pre|blockquote|tg-spoiler)&gt;/gi, '<$1$2>')
    .replace(/&lt;a\s+href="([^"]+)"&gt;(.*?)&lt;\/a&gt;/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-sky-500 underline hover:text-sky-400">$2</a>')
    .replace(/\n/g, '<br />')
}

export function ComposeForm() {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [condensedText, setCondensedText] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [media, setMedia] = useState<File | null>(null)
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null)

  const [activePreviewTab, setActivePreviewTab] = useState<'telegram' | 'website'>('telegram')
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit')

  const [isCondensing, setIsCondensing] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean, percent: number, text: string } | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string, postUrl?: string } | null>(null)
  const [renderedWebHtml, setRenderedWebHtml] = useState('')

  // Load saved Admin Token from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setAdminToken(saved)
      }
    }
    catch {
      // Ignore local storage errors
    }
  }, [])

  // Persist Admin Token
  const handleAdminTokenChange = (value: string) => {
    setAdminToken(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    }
    catch {
      // Ignore local storage errors
    }
  }

  // Handle local media selection and preview URL
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }

    if (file) {
      const isVideo = file.type.startsWith('video/') || /\.(?:mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name)
      setMedia(file)
      setMediaType(isVideo ? 'video' : 'image')
      setMediaPreviewUrl(URL.createObjectURL(file))
    }
    else {
      setMedia(null)
      setMediaType(null)
      setMediaPreviewUrl(null)
    }
  }

  const removeMedia = () => {
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl)
    }
    setMedia(null)
    setMediaType(null)
    setMediaPreviewUrl(null)
  }

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl)
      }
    }
  }, [mediaPreviewUrl])

  // Asynchronously render markdown for Website preview
  useEffect(() => {
    let isMounted = true
    if (!text.trim()) {
      setRenderedWebHtml('')
      return
    }

    const parsed = marked.parse(text, { breaks: true, gfm: true })
    if (parsed instanceof Promise) {
      parsed.then((html) => {
        if (isMounted)
          setRenderedWebHtml(html)
      })
    }
    else {
      setRenderedWebHtml(parsed)
    }

    return () => {
      isMounted = false
    }
  }, [text])

  const isMediaOversized = Boolean(media && media.size > MAX_MEDIA_BYTES)

  // AI Condense action
  const handleCondense = async () => {
    if (!text.trim()) {
      setStatus({ type: 'error', message: 'Please write your post content first before condensing.' })
      return
    }
    if (!adminToken.trim()) {
      setStatus({ type: 'error', message: 'Admin Token is required to use AI condensation.' })
      return
    }

    setIsCondensing(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append('action', 'condense')
      formData.append('text', text)
      formData.append('adminToken', adminToken)
      formData.append('hasMedia', media ? 'true' : 'false')

      const res = await fetch('/api/compose', {
        method: 'POST',
        body: formData,
      })

      const data = await parseApiResponse(res)

      setCondensedText(data.condensedText || '')
      setStatus({
        type: 'success',
        message: 'AI teaser condensed! You may tweak it below or preview the Telegram message.',
      })
    }
    catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error condensing text' })
    }
    finally {
      setIsCondensing(false)
    }
  }

  // Final Publish action
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      setStatus({ type: 'error', message: 'Post content cannot be empty.' })
      return
    }
    if (!adminToken.trim()) {
      setStatus({ type: 'error', message: 'Admin Token is required.' })
      return
    }

    setIsPublishing(true)
    setStatus(null)
    setUploadProgress(null)

    try {
      let uploadedBlobUrl: string | null = null

      // If media is larger than Vercel's 4.5MB serverless limit, stream directly to Vercel Blob!
      if (media && isMediaOversized) {
        setUploadProgress({
          active: true,
          percent: 0,
          text: `Streaming ${(media.size / (1024 * 1024)).toFixed(1)} MB directly to Vercel Blob...`,
        })

        const blob = await upload(media.name, media, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          clientPayload: JSON.stringify({ adminToken }),
          onUploadProgress: (progress) => {
            const percent = Math.round(progress.percentage)
            setUploadProgress({
              active: true,
              percent,
              text: `Uploading media to Vercel Blob (${percent}%)...`,
            })
          },
        })

        uploadedBlobUrl = blob.url
        setUploadProgress({
          active: true,
          percent: 100,
          text: 'Media uploaded to Blob! Broadcasting post...',
        })
      }

      const formData = new FormData()
      formData.append('action', 'publish')
      if (title.trim()) {
        formData.append('title', title.trim())
      }
      formData.append('text', text)
      if (condensedText.trim()) {
        formData.append('condensedText', condensedText.trim())
      }
      formData.append('adminToken', adminToken)

      if (uploadedBlobUrl) {
        formData.append('mediaUrl', uploadedBlobUrl)
        formData.append('mediaType', mediaType || 'video')
      }
      else if (media) {
        if (mediaType === 'video') {
          formData.append('video', media)
        }
        else {
          formData.append('image', media)
        }
      }

      const res = await fetch('/api/compose', {
        method: 'POST',
        body: formData,
      })

      const data = await parseApiResponse(res)

      setStatus({
        type: 'success',
        message: 'Post successfully published to Telegram and queued for site rebuild!',
        postUrl: data.postUrl,
      })

      // Reset form
      setTitle('')
      setText('')
      setCondensedText('')
      removeMedia()
    }
    catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to publish' })
    }
    finally {
      setIsPublishing(false)
      setUploadProgress(null)
    }
  }

  // Telegram character count calculation & badge coloring
  const charCount = condensedText.length
  const charBadge = useMemo(() => {
    if (charCount === 0) {
      return { text: '0 / 800 chars', color: 'text-muted-foreground bg-muted' }
    }
    if (charCount <= 800) {
      return { text: `${charCount} / 800 chars`, color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/40' }
    }
    if (charCount <= 1024) {
      return { text: `${charCount} / 1024 chars (Getting tight)`, color: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40' }
    }
    return { text: `${charCount} / 1024 chars (Exceeds Telegram limit!)`, color: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/40' }
  }, [charCount])

  const telegramHtmlPreview = useMemo(() => {
    return formatTelegramPreviewHtml(condensedText)
  }, [condensedText])

  return (
    <div className="space-y-6">
      {/* Mobile Tab Switcher */}
      <div className="flex rounded-lg bg-muted p-1 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('edit')}
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
            mobileTab === 'edit'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Editor
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
            mobileTab === 'preview'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Live Preview
          </span>
        </button>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 items-start">
        {/* Left Column: Editor Form */}
        <form
          onSubmit={handlePublish}
          className={`space-y-5 ${mobileTab === 'edit' ? 'block' : 'hidden lg:block'}`}
        >
          {/* Post Title */}
          <div>
            <label htmlFor="title" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Article Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="e.g. Exploring Architecture in Distributed Systems"
            />
          </div>

          {/* Post Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="text" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Post Content (Markdown)
              </label>
              <span className="text-[11px] text-muted-foreground">Full article on Teleboros</span>
            </div>
            <textarea
              id="text"
              value={text}
              onChange={e => setText(e.target.value)}
              required
              rows={9}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              placeholder="Write your full long-form thoughts here in Markdown...&#10;&#10;Supports **bold**, _italics_, `code`, blockquotes, and links."
            />
          </div>

          {/* Media Attachment */}
          <div>
            <label htmlFor="media-upload" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Media Attachment (Image or Video Clip, optional)
            </label>

            {media && mediaPreviewUrl
              ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden border bg-black/20 flex items-center justify-center">
                          {mediaType === 'video'
                            ? (
                                <video
                                  src={`${mediaPreviewUrl}#t=0.001`}
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              )
                            : (
                                <Image src={mediaPreviewUrl} alt="Preview" fill unoptimized className="object-cover" />
                              )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{media.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            {mediaType === 'video' ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                            {mediaType === 'video' ? 'Video Clip' : 'Image'}
                            {' '}
                            ·
                            <span className={isMediaOversized ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>
                              {(media.size / (1024 * 1024)).toFixed(2)}
                              {' '}
                              MB
                            </span>
                            {isMediaOversized && (
                              <span className="ml-1 inline-flex items-center rounded bg-sky-100 dark:bg-sky-950/70 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                                Vercel Blob
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeMedia}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label="Remove media"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {isMediaOversized && (
                      <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-50 p-2.5 text-xs text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                        <Sparkles className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold">Vercel Blob Direct Streaming Enabled</p>
                          <p className="text-[11px] leading-relaxed opacity-90">
                            This media file ({(media.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 4.5 MB serverless limit and will stream directly into your Vercel Blob storage with full original quality.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              : (
                  <div className="relative">
                    <input
                      id="media-upload"
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleMediaChange}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                )}
          </div>

          {/* Admin Token */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="adminToken" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin Token
              </label>
              <span className="text-[11px] text-muted-foreground">Saved locally</span>
            </div>
            <input
              id="adminToken"
              type="password"
              value={adminToken}
              onChange={e => handleAdminTokenChange(e.target.value)}
              required
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Your secret Admin Token..."
            />
          </div>

          {/* Editable Telegram Teaser Box */}
          <div className="rounded-xl border bg-card p-4 shadow-sm space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-sky-500" />
                <span className="text-xs font-semibold text-foreground">Telegram Teaser (Editable)</span>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${charBadge.color}`}>
                {charBadge.text}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">
              This summary teaser is dispatched to Telegram with a backlink to the full article on Teleboros.
            </p>

            <textarea
              id="condensedText"
              value={condensedText}
              onChange={e => setCondensedText(e.target.value)}
              rows={4}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              placeholder="Click '✨ Condense (AI)' above or type your custom Telegram caption/teaser here..."
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted-foreground">
                Supports Telegram HTML: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;, &lt;a&gt;
              </span>
              {condensedText && (
                <button
                  type="button"
                  onClick={() => setCondensedText('')}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Clear teaser
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons: Condense & Publish */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCondense}
              disabled={isCondensing || isPublishing || !text.trim()}
              className="flex-1 border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 gap-2 h-11"
            >
              {isCondensing
                ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                      <span>Condensing with Gemini...</span>
                    </>
                  )
                : (
                    <>
                      <Sparkles className="h-4 w-4 text-sky-500" />
                      <span>{condensedText ? 'Re-condense (AI)' : 'Condense (AI)'}</span>
                    </>
                  )}
            </Button>

            <Button
              type="submit"
              disabled={isPublishing || isCondensing || !text.trim() || !adminToken.trim()}
              className="flex-1 gap-2 h-11"
            >
              {isPublishing
                ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{uploadProgress?.active ? 'Streaming Media...' : 'Broadcasting...'}</span>
                    </>
                  )
                : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Post to Telegram</span>
                    </>
                  )}
            </Button>
          </div>

          {/* Vercel Blob Live Upload Progress Bar */}
          {uploadProgress?.active && (
            <div className="space-y-2 rounded-xl border border-sky-500/30 bg-sky-50/60 dark:bg-sky-950/40 p-3.5 text-xs shadow-sm">
              <div className="flex items-center justify-between font-semibold text-sky-900 dark:text-sky-200">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-400" />
                  {uploadProgress.text}
                </span>
                <span className="font-mono text-sky-700 dark:text-sky-300">{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Message */}
          {status && (
            <div
              className={`p-4 rounded-xl text-sm flex items-start gap-3 ${
                status.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-500/30'
                  : 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200 border border-rose-500/30'
              }`}
            >
              {status.type === 'success'
                ? <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                : <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <p className="font-medium">{status.message}</p>
                {status.postUrl && (
                  <a
                    href={status.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    <span>View published article</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Right Column: Live Dual Preview */}
        <div className={`space-y-4 lg:sticky lg:top-16 ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Post Preview</span>
            </div>

            {/* Preview Tab Buttons */}
            <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActivePreviewTab('telegram')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activePreviewTab === 'telegram'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Send className="h-3 w-3 text-sky-500" />
                <span>Telegram</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePreviewTab('website')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all ${
                  activePreviewTab === 'website'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="h-3 w-3 text-emerald-500" />
                <span>Teleboros Web</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Telegram Message Bubble Preview */}
          {activePreviewTab === 'telegram' && (
            <div className="rounded-2xl border border-sky-500/20 bg-[#f4f7f9] dark:bg-[#18222d] text-foreground p-4 shadow-md space-y-3 transition-all">
              {/* Telegram Channel Header */}
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <Image
                    src="/logo.png"
                    alt="Teleboros"
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-contain bg-background"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold leading-none text-sky-600 dark:text-sky-400">Teleboros Channel</span>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">channel broadcast</span>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground">Just now</span>
              </div>

              {/* Media Preview in Telegram Bubble */}
              {mediaPreviewUrl && (
                <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-black/40">
                  {mediaType === 'video'
                    ? (
                        <video
                          src={`${mediaPreviewUrl}#t=0.001`}
                          preload="metadata"
                          controls
                          playsInline
                          className="max-h-72 w-full object-cover"
                        />
                      )
                    : (
                        <div className="relative max-h-72 w-full min-h-[160px] bg-black/10">
                          <Image
                            src={mediaPreviewUrl}
                            alt="Telegram media preview"
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      )}
                </div>
              )}

              {/* Telegram Teaser Content */}
              <div className="text-xs leading-relaxed break-words [overflow-wrap:anywhere]">
                {telegramHtmlPreview
                  ? (
                      <div
                        className="[&_a]:text-sky-500 [&_a]:underline [&_code]:bg-black/10 dark:[&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-black/10 dark:[&_pre]:bg-white/10 [&_pre]:p-2 [&_pre]:rounded-md font-sans"
                        dangerouslySetInnerHTML={{ __html: telegramHtmlPreview }}
                      />
                    )
                  : (
                      <p className="italic text-muted-foreground">
                        No teaser yet. Click &ldquo;✨ Condense (AI)&rdquo; or type in the Telegram Teaser field on the left to see the message bubble preview.
                      </p>
                    )}
              </div>

              {/* Simulated Backlink Pill */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-700 dark:text-sky-300">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span>📖</span>
                  <span className="truncate">Read full article on Teleboros</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-75" />
              </div>

              {/* Telegram Message Footer */}
              <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground pt-1">
                <span>12:00</span>
                <span className="font-mono">✓✓</span>
              </div>
            </div>
          )}

          {/* TAB 2: Teleboros Website Post Preview */}
          {activePreviewTab === 'website' && (
            <div className="rounded-2xl border bg-card text-card-foreground p-5 shadow-md space-y-4">
              {/* Site Card Header */}
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Teleboros"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border object-contain"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-semibold text-foreground">Teleboros</span>
                    <span className="text-muted-foreground">@teleboros</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-xs">Just now</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Long-Form Article Preview</p>
                </div>
              </div>

              {/* Title if set */}
              {title && (
                <h2 className="text-lg font-bold tracking-tight text-foreground border-b pb-2">
                  {title}
                </h2>
              )}

              {/* Media Preview in Website Card */}
              {mediaPreviewUrl && (
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  {mediaType === 'video'
                    ? (
                        <video
                          src={`${mediaPreviewUrl}#t=0.001`}
                          preload="metadata"
                          controls
                          playsInline
                          className="max-h-80 w-full object-cover"
                        />
                      )
                    : (
                        <div className="relative max-h-80 w-full min-h-[180px]">
                          <Image
                            src={mediaPreviewUrl}
                            alt="Website post media"
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      )}
                </div>
              )}

              {/* Markdown Content */}
              <div className="prose-telegram text-sm leading-relaxed max-h-96 overflow-y-auto pr-1">
                {renderedWebHtml
                  ? (
                      <div dangerouslySetInnerHTML={{ __html: renderedWebHtml }} />
                    )
                  : (
                      <p className="italic text-muted-foreground">
                        Your article content will appear here in full formatted Markdown as readers see it on Teleboros...
                      </p>
                    )}
              </div>

              {/* Card Meta Simulation */}
              <div className="border-t pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-semibold text-primary">
                  <span>Read full article</span>
                  <span>&rarr;</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">❤️ 1</span>
                  <span className="inline-flex items-center gap-1">👁️ 1</span>
                  <span className="inline-flex items-center gap-1">💬 0</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
