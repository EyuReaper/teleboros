'use client'

import { ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const ZOOMABLE_SELECTOR = '.prose-telegram img.zoomable, .prose-telegram video.post-video'

interface MediaItem {
  src: string
  alt: string
  type: 'image' | 'video'
  poster?: string
  albumId?: string
  index: number
  total: number
}

export function ContentAlbumLightbox() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MediaItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const scanFrame = useRef<number | undefined>(undefined)

  const currentItem = items[currentIndex]

  // Reset zoom level on media switch
  useEffect(() => {
    setZoomLevel(1)
  }, [currentIndex, open])

  // Scan and register click handlers
  useEffect(() => {
    const enhanceElement = (el: HTMLElement) => {
      if (el.dataset.lightboxEnhanced === 'true') {
        return
      }
      el.dataset.lightboxEnhanced = 'true'

      if (el instanceof HTMLImageElement) {
        el.decoding = 'async'
        const blurSrc = el.dataset.blurSrc
        if (blurSrc) {
          el.style.backgroundImage = `url("${blurSrc}")`
          el.style.backgroundSize = 'cover'
          el.style.backgroundPosition = 'center'
          el.style.backgroundRepeat = 'no-repeat'
        }

        const markLoaded = () => {
          el.classList.remove('image-loading')
          el.classList.add('image-loaded')
          if (blurSrc) {
            setTimeout(() => {
              el.style.backgroundImage = ''
              el.style.backgroundSize = ''
              el.style.backgroundPosition = ''
              el.style.backgroundRepeat = ''
            }, 300)
          }
        }

        if (el.complete && el.naturalWidth > 0) {
          markLoaded()
        }
        else {
          el.classList.add('image-loading')
          el.addEventListener('load', markLoaded, { once: true })
          el.addEventListener('error', markLoaded, { once: true })
        }
      }
    }

    const handleMediaClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement
      if (!target)
        return

      // Determine album clustering context
      const albumContainer = target.closest<HTMLElement>('.image-list-container, .tgme_widget_message_grouped_wrap, .grouped_media_wrap')
      const albumId = target.dataset.albumId || albumContainer?.dataset.albumId || ''

      let albumItems: MediaItem[] = []

      if (albumContainer) {
        const elements = Array.from(albumContainer.querySelectorAll<HTMLElement>('img.zoomable, video.post-video'))
        if (elements.length > 0) {
          albumItems = elements.map((el, i) => {
            const isVideo = el instanceof HTMLVideoElement || el.tagName.toLowerCase() === 'video'
            const src = (el instanceof HTMLImageElement ? el.src : (el as HTMLVideoElement).currentSrc || (el as HTMLVideoElement).src) || ''
            const alt = (el as HTMLImageElement).alt || (isVideo ? 'Post video' : 'Post image')
            const poster = isVideo ? (el as HTMLVideoElement).poster : undefined
            return {
              src,
              alt,
              type: isVideo ? 'video' : 'image',
              poster,
              albumId,
              index: i,
              total: elements.length,
            }
          })
        }
      }

      if (albumItems.length === 0) {
        // Standalone media item
        const isVideo = target instanceof HTMLVideoElement || target.tagName.toLowerCase() === 'video'
        const src = (target instanceof HTMLImageElement ? target.src : (target as HTMLVideoElement).currentSrc || (target as HTMLVideoElement).src) || ''
        const alt = (target as HTMLImageElement).alt || (isVideo ? 'Post video' : 'Post image')
        const poster = isVideo ? (target as HTMLVideoElement).poster : undefined
        albumItems = [{
          src,
          alt,
          type: isVideo ? 'video' : 'image',
          poster,
          index: 0,
          total: 1,
        }]
      }

      const targetSrc = (target as HTMLImageElement).src || (target as HTMLVideoElement).currentSrc || (target as HTMLVideoElement).src
      const clickedIndex = albumItems.findIndex(item => item.src === targetSrc)
      setItems(albumItems)
      setCurrentIndex(clickedIndex >= 0 ? clickedIndex : 0)
      setOpen(true)
    }

    const attachedElements = new Set<HTMLElement>()

    const scanMedia = () => {
      const elements = document.querySelectorAll<HTMLElement>(ZOOMABLE_SELECTOR)
      elements.forEach((el) => {
        enhanceElement(el)
        if (!attachedElements.has(el)) {
          attachedElements.add(el)
          el.addEventListener('click', handleMediaClick)
        }
      })
    }

    const observer = new MutationObserver(() => {
      if (scanFrame.current) {
        cancelAnimationFrame(scanFrame.current)
      }
      scanFrame.current = requestAnimationFrame(scanMedia)
    })

    scanMedia()
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (scanFrame.current) {
        cancelAnimationFrame(scanFrame.current)
      }
      attachedElements.forEach(el => el.removeEventListener('click', handleMediaClick))
      attachedElements.clear()
    }
  }, [])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : items.length - 1))
  }, [items.length])

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => (prev < items.length - 1 ? prev + 1 : 0))
  }, [items.length])

  // Keyboard events
  useEffect(() => {
    if (!open)
      return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      }
      else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setZoomLevel(prev => Math.min(prev + 0.5, 3))
      }
      else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setZoomLevel(prev => Math.max(prev - 0.5, 1))
      }
      else if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handlePrev, handleNext])

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null)
      return

    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        handlePrev()
      }
      else {
        handleNext()
      }
    }

    touchStartX.current = null
    touchStartY.current = null
  }

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!containerRef.current)
      return
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      }
      else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
    catch {
      // Ignore fullscreen rejection
    }
  }

  // Prevent background scroll lock issues
  useEffect(() => {
    if (!open)
      return
    const undo = () => {
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('padding-right')
      document.body.style.removeProperty('margin-right')
    }
    const frame = requestAnimationFrame(undo)
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!currentItem) {
    return null
  }

  const hasMultiple = items.length > 1

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        ref={containerRef}
        className="fixed inset-0 z-50 flex h-screen w-screen max-w-none items-center justify-center border-0 bg-background/95 p-0 backdrop-blur-md outline-none ring-0 focus:outline-none focus:ring-0 [&>button]:hidden select-none"
        onInteractOutside={() => setOpen(false)}
        onOpenAutoFocus={e => e.preventDefault()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <DialogTitle className="sr-only">{currentItem.alt || 'Media preview'}</DialogTitle>

        {/* Top Control Bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent text-white">
          <div className="flex items-center gap-2 text-sm font-medium">
            {hasMultiple && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur-sm">
                {currentIndex + 1}
                {' '}
                /
                {' '}
                {items.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {currentItem.type === 'image' && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setZoomLevel(prev => Math.min(prev + 0.5, 3))
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setZoomLevel(prev => Math.max(prev - 0.5, 1))
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                toggleFullscreen()
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>

            <a
              href={currentItem.src}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
              title="Download original"
              aria-label="Download original"
            >
              <Download className="h-4 w-4" />
            </a>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 active:scale-95"
              title="Close"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Previous Navigation Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            className="absolute left-3 sm:left-6 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/70 hover:scale-105 active:scale-95"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Main Media Container */}
        <div
          className="relative flex h-full w-full items-center justify-center p-4 sm:p-12 overflow-hidden"
          onClick={() => {
            if (zoomLevel > 1) {
              setZoomLevel(1)
            }
            else {
              setOpen(false)
            }
          }}
        >
          {currentItem.type === 'video'
            ? (
                <video
                  key={currentItem.src}
                  src={currentItem.src}
                  poster={currentItem.poster}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
                  onClick={e => e.stopPropagation()}
                />
              )
            : (
                <div
                  className="relative flex max-h-[88vh] max-w-[90vw] items-center justify-center transition-transform duration-200 ease-out"
                  style={{ transform: `scale(${zoomLevel})` }}
                  onClick={e => e.stopPropagation()}
                >
                  <Image
                    key={currentItem.src}
                    src={currentItem.src}
                    alt={currentItem.alt}
                    width={1600}
                    height={1200}
                    priority
                    unoptimized
                    className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain select-none shadow-2xl"
                  />
                </div>
              )}
        </div>

        {/* Next Navigation Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            className="absolute right-3 sm:right-6 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/70 hover:scale-105 active:scale-95"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Bottom Thumbnail Strip / Dots for Albums */}
        {hasMultiple && (
          <div className="absolute bottom-4 inset-x-0 z-20 flex items-center justify-center gap-2 pointer-events-none">
            <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm pointer-events-auto">
              {items.map((item, idx) => (
                <button
                  key={`dot-${item.src}-${idx}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCurrentIndex(idx)
                  }}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    idx === currentIndex
                      ? 'w-6 bg-white'
                      : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
