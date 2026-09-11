'use client'

import type { Root } from 'react-dom/client'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { AudioPlayerCard } from '@/components/audio/audio-player-card'

const AUDIO_EXT_PATTERN = /\.(?:mp3|ogg|oga|m4a|aac|wav|opus|flac|wma)(?:\?|$)/i

interface MountedAudio {
  host: HTMLElement
  root: Root
}

export function ContentAudioPlayer() {
  useEffect(() => {
    let disposed = false
    const mountedRoots = new Map<HTMLElement, MountedAudio>()

    const teardownNode = (host: HTMLElement) => {
      const mounted = mountedRoots.get(host)
      if (mounted) {
        try {
          mounted.root.unmount()
        }
        catch {
          // ignore unmount errors
        }
        mountedRoots.delete(host)
      }
    }

    const mountAudioPlayer = (element: HTMLElement) => {
      if (disposed || element.dataset.audioMounted === 'true') {
        return
      }

      let src = element.dataset.src || ''
      let title = element.dataset.title || ''
      let artist = element.dataset.artist || ''
      let duration = element.dataset.duration || ''
      let waveform = element.dataset.waveform || ''
      let filesize = element.dataset.filesize || ''
      let isVoice = element.dataset.voice === 'true'

      // If it's a native telegram voice player
      if (element.classList.contains('tgme_widget_message_voice_player') || element.classList.contains('js-message_voice_player')) {
        isVoice = true
        const audioEl = element.querySelector<HTMLAudioElement>('audio.js-message_voice, audio.tgme_widget_message_voice, audio')
        if (audioEl) {
          src = audioEl.src || audioEl.getAttribute('src') || audioEl.getAttribute('data-ogg') || src
          waveform = audioEl.getAttribute('data-waveform') || waveform
        }
        const durationEl = element.querySelector('.tgme_widget_message_voice_duration, .js-message_voice_duration')
        if (durationEl && !duration) {
          duration = durationEl.textContent?.trim() || ''
        }
        if (!src && element.tagName === 'A') {
          src = (element as HTMLAnchorElement).href || ''
        }
      }
      // If it's a telegram document wrap with audio
      else if (element.classList.contains('tgme_widget_message_document_wrap')) {
        const titleEl = element.querySelector('.tgme_widget_message_document_title')
        const extraEl = element.querySelector('.tgme_widget_message_document_extra')
        if (titleEl && !title) {
          title = titleEl.textContent?.trim() || ''
        }
        if (extraEl) {
          const extraText = extraEl.textContent?.trim() || ''
          const durationMatch = extraText.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)
          if (durationMatch && !duration) {
            duration = durationMatch[0]
          }
          const sizeMatch = extraText.match(/\b[\d.]+\s*(?:KB|MB|GB|B)\b/i)
          if (sizeMatch && !filesize) {
            filesize = sizeMatch[0]
          }
          if (extraText.includes('–') || extraText.includes('—') || extraText.includes('-')) {
            const parts = extraText.split(/[–—\-]/)
            if (parts[0] && !artist) {
              artist = parts[0].trim()
            }
          }
        }
        if (element.tagName === 'A' && !src) {
          src = (element as HTMLAnchorElement).href || ''
        }
      }
      // If it's a raw audio element
      else if (element.tagName === 'AUDIO') {
        const audioEl = element as HTMLAudioElement
        src = audioEl.src || audioEl.getAttribute('src') || src
        title = audioEl.getAttribute('data-title') || title
        artist = audioEl.getAttribute('data-artist') || artist
        duration = audioEl.getAttribute('data-duration') || duration
        waveform = audioEl.getAttribute('data-waveform') || waveform
        isVoice = audioEl.getAttribute('data-voice') === 'true' || isVoice
      }

      // Check inner audio if src not found
      if (!src) {
        const innerAudio = element.querySelector<HTMLAudioElement>('audio')
        if (innerAudio) {
          src = innerAudio.src || innerAudio.getAttribute('src') || ''
        }
      }

      if (!src && element.tagName === 'A') {
        const href = (element as HTMLAnchorElement).href || ''
        if (AUDIO_EXT_PATTERN.test(href)) {
          src = href
        }
      }

      if (!src) {
        return
      }

      if (!title) {
        title = isVoice ? 'Voice Message' : 'Audio Track'
      }

      element.dataset.audioMounted = 'true'

      // Host container
      const host = document.createElement('div')
      host.className = 'teleboros-audio-host'

      // Hide SSR placeholder
      const placeholder = element.querySelector('.teleboros-audio-card')
      if (placeholder) {
        (placeholder as HTMLElement).style.display = 'none'
      }

      // Insert host inside element or replace
      element.appendChild(host)

      try {
        const root = createRoot(host)
        root.render(
          <AudioPlayerCard
            src={src}
            title={title}
            artist={artist}
            duration={duration}
            waveform={waveform}
            isVoice={isVoice}
            filesize={filesize}
          />,
        )
        mountedRoots.set(element, { host, root })
      }
      catch (err) {
        console.error('[teleboros] Failed to mount AudioPlayerCard:', err)
        if (placeholder) {
          (placeholder as HTMLElement).style.display = ''
        }
      }
    }

    const scanAndMount = () => {
      if (disposed)
        return
      const selector = [
        '.teleboros-audio-player:not([data-audio-mounted="true"])',
        '.tgme_widget_message_voice_player:not([data-audio-mounted="true"])',
        '.tgme_widget_message_document_wrap:has(.tgme_widget_message_document_icon.audio):not([data-audio-mounted="true"])',
        '.prose-telegram audio:not([data-audio-mounted="true"]):not(.hidden)',
      ].join(', ')

      try {
        const elements = document.querySelectorAll<HTMLElement>(selector)
        elements.forEach(mountAudioPlayer)
      }
      catch {
        // Fallback if :has() is not supported
        const elements = document.querySelectorAll<HTMLElement>(
          '.teleboros-audio-player:not([data-audio-mounted="true"]), .tgme_widget_message_voice_player:not([data-audio-mounted="true"])',
        )
        elements.forEach(mountAudioPlayer)
      }
    }

    scanAndMount()

    const observer = new MutationObserver((mutations) => {
      let shouldScan = false
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.removedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (mountedRoots.has(node)) {
                teardownNode(node)
              }
              node.querySelectorAll<HTMLElement>('.teleboros-audio-host').forEach((host) => {
                const parent = host.parentElement
                if (parent && mountedRoots.has(parent)) {
                  teardownNode(parent)
                }
              })
            }
          })

          if (mutation.addedNodes.length > 0) {
            shouldScan = true
          }
        }
      }

      if (shouldScan) {
        scanAndMount()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      disposed = true
      observer.disconnect()
      mountedRoots.forEach(({ root }) => {
        try {
          root.unmount()
        }
        catch {
          // ignore
        }
      })
      mountedRoots.clear()
    }
  }, [])

  return null
}
