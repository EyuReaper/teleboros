'use client'

import { Download, Mic, Music, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

export interface AudioPlayerProps {
  src: string
  title: string
  artist?: string
  duration?: string
  waveform?: string
  isVoice?: boolean
  filesize?: string
  className?: string
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }
  const total = Math.floor(seconds)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function parseDurationStringToSeconds(str?: string): number {
  if (!str)
    return 0
  const trimmed = str.trim()
  const parts = trimmed.split(':').map(Number)
  if (parts.some(Number.isNaN))
    return 0
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

/**
 * Parses Telegram waveform or generates a realistic simulated waveform.
 * Telegram waveforms are either comma-separated ints or base64 5-bit packed values.
 */
function resolveWaveformBars(waveformStr?: string, seedText = '', barCount = 42): number[] {
  if (waveformStr?.trim()) {
    const raw = waveformStr.trim()
    // 1. Check if comma-separated
    if (raw.includes(',')) {
      const nums = raw.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n))
      if (nums.length > 0) {
        return resampleArray(nums, barCount)
      }
    }

    // 2. Check if base64 encoded (5 bits per value)
    try {
      const decoded = atob(raw)
      const bytes = new Uint8Array(decoded.length)
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i)
      }
      // Decode 5-bit values
      const values: number[] = []
      let bitOffset = 0
      const totalBits = bytes.length * 8
      while (bitOffset + 5 <= totalBits) {
        const byteIndex = Math.floor(bitOffset / 8)
        const bitRem = bitOffset % 8
        let val = (bytes[byteIndex] >> bitRem) & 0x1F
        if (bitRem > 3 && byteIndex + 1 < bytes.length) {
          val |= (bytes[byteIndex + 1] << (8 - bitRem)) & 0x1F
        }
        values.push(val)
        bitOffset += 5
      }
      if (values.length > 0) {
        return resampleArray(values, barCount)
      }
    }
    catch {
      // Fall through to deterministic simulation
    }
  }

  // Generate deterministic simulated audio waveform
  let hash = 0
  const combined = seedText || 'teleboros-audio-track'
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i)
    hash |= 0
  }

  const bars: number[] = []
  for (let i = 0; i < barCount; i++) {
    // Combination of sine waves and pseudo-random seed to form natural speech/music envelope
    const progress = i / barCount
    const envelope = Math.sin(progress * Math.PI) // Peak in middle, lower at ends
    const pseudoRand = Math.abs(Math.sin(hash + i * 13.37))
    const frequency = Math.sin(i * 0.8) * 0.25 + 0.5
    const value = Math.max(0.18, Math.min(1.0, (envelope * 0.6 + frequency * 0.2 + pseudoRand * 0.4)))
    bars.push(value)
  }

  return bars
}

function resampleArray(source: number[], targetLength: number): number[] {
  if (source.length === 0) {
    return Array.from({ length: targetLength }, () => 0.5)
  }
  const maxVal = Math.max(...source, 1)
  const result: number[] = []
  const step = source.length / targetLength

  for (let i = 0; i < targetLength; i++) {
    const startIdx = Math.floor(i * step)
    const endIdx = Math.min(source.length, Math.floor((i + 1) * step))
    let sum = 0
    let count = 0
    for (let j = startIdx; j < endIdx; j++) {
      sum += source[j]
      count++
    }
    const avg = count > 0 ? sum / count : source[startIdx] || 0
    // Normalize between 0.15 and 1.0
    const normalized = Math.max(0.15, Math.min(1.0, avg / maxVal))
    result.push(normalized)
  }

  return result
}

export function AudioPlayerCard({
  src,
  title,
  artist,
  duration: initialDurationStr,
  waveform: initialWaveformStr,
  isVoice = false,
  filesize,
  className = '',
}: AudioPlayerProps) {
  const playerId = useId()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const waveformRef = useRef<HTMLDivElement | null>(null)
  const scrubBarRef = useRef<HTMLDivElement | null>(null)

  const initialDuration = useMemo(
    () => parseDurationStringToSeconds(initialDurationStr),
    [initialDurationStr],
  )

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState<number>(initialDuration)
  const [buffered, setBuffered] = useState(0)
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverProgress, setHoverProgress] = useState<number | null>(null)

  const waveformBars = useMemo(
    () => resolveWaveformBars(initialWaveformStr, `${title}-${src}`, isVoice ? 48 : 36),
    [initialWaveformStr, title, src, isVoice],
  )

  // Listen for global audio play events to pause other audios/videos (Mutex)
  useEffect(() => {
    const handleOtherPlay = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>
      if (customEvent.detail?.id !== playerId && audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
        setIsPlaying(false)
      }
    }

    window.addEventListener('teleboros:audio-play', handleOtherPlay)
    return () => {
      window.removeEventListener('teleboros:audio-play', handleOtherPlay)
    }
  }, [playerId])

  // Audio lifecycle listeners
  useEffect(() => {
    const audio = audioRef.current
    if (!audio)
      return

    const onTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime)
      }
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const end = audio.buffered.end(audio.buffered.length - 1)
        setBuffered(Math.min(100, (end / audio.duration) * 100))
      }
    }

    const onLoadedMetadata = () => {
      if (audio.duration && !Number.isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration)
      }
    }

    const onPlay = () => {
      setIsPlaying(true)
      // Broadcast event so other players stop
      window.dispatchEvent(
        new CustomEvent('teleboros:audio-play', { detail: { id: playerId } }),
      )
      // Pause any HTML5 videos
      document.querySelectorAll('video').forEach((vid) => {
        if (!vid.paused) {
          vid.pause()
        }
      })
    }

    const onPause = () => {
      setIsPlaying(false)
    }

    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [playerId, isDragging])

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio)
      return

    if (audio.paused) {
      audio.play().catch((err) => {
        console.warn('[teleboros audio] Play error:', err)
      })
    }
    else {
      audio.pause()
    }
  }, [])

  // Seek helper
  const seekToRatio = useCallback((ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio))
    const effectiveDuration = duration || initialDuration || 0
    const targetTime = clamped * effectiveDuration
    setCurrentTime(targetTime)
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime
    }
  }, [duration, initialDuration])

  // Playback speed cycle: 1x -> 1.5x -> 2x -> 1x
  const cyclePlaybackRate = useCallback(() => {
    const speeds: Array<1 | 1.5 | 2> = [1, 1.5, 2]
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length
    const nextSpeed = speeds[nextIndex]
    setPlaybackRate(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }, [playbackRate])

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (!audioRef.current)
      return
    const nextMute = !isMuted
    audioRef.current.muted = nextMute
    setIsMuted(nextMute)
  }, [isMuted])

  // Scrub bar drag & click handlers
  const handleScrubPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0)
      return
    const clientX = e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    seekToRatio(ratio)
  }, [seekToRatio])

  const onScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    handleScrubPointer(e)
  }

  const onScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width > 0) {
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setHoverProgress(ratio)
      if (isDragging) {
        handleScrubPointer(e)
      }
    }
  }

  const onScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false)
      handleScrubPointer(e)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      catch {
        // pointer capture release fallback
      }
    }
  }

  // Waveform click / drag seeking
  const handleWaveformPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width <= 0)
      return
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekToRatio(ratio)
  }, [seekToRatio])

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const progressPercent = progressRatio * 100

  // Download filename generator
  const downloadFilename = useMemo(() => {
    const ext = isVoice ? 'ogg' : 'mp3'
    const safeTitle = (title || 'audio-track')
      .replace(/[^\w\-\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 40)
    return `${safeTitle}.${ext}`
  }, [title, isVoice])

  return (
    <div
      className={`teleboros-audio-widget group/audio relative my-3.5 flex flex-col rounded-2xl border bg-card/85 p-3.5 shadow-sm backdrop-blur-md transition-all hover:border-primary/40 hover:shadow-md ${className}`}
      data-playing={isPlaying ? 'true' : 'false'}
    >
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
      />

      {/* Top Section: Play Button, Metadata & Actions */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {isPlaying
            ? (
                <Pause className="h-5 w-5 fill-current" />
              )
            : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
        </button>

        {/* Title, Artist & Badges */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isVoice
              ? (
                  <Mic className="h-3.5 w-3.5 shrink-0 text-primary" />
                )
              : (
                  <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
            <h4 className="truncate text-sm font-semibold tracking-tight text-foreground" title={title}>
              {title || (isVoice ? 'Voice Message' : 'Audio Track')}
            </h4>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {artist
              ? (
                  <span className="truncate font-medium text-foreground/80">{artist}</span>
                )
              : null}
            {artist ? <span>•</span> : null}
            <span className="font-mono text-[11px]">
              {formatTime(currentTime)}
              {' / '}
              {formatTime(duration || initialDuration)}
            </span>
            {filesize
              ? (
                  <>
                    <span>•</span>
                    <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-medium">{filesize}</span>
                  </>
                )
              : null}
          </div>
        </div>

        {/* Controls: Speed, Mute & Download */}
        <div className="flex items-center gap-1">
          {/* Playback Speed Control (1x, 1.5x, 2x) */}
          <button
            type="button"
            onClick={cyclePlaybackRate}
            title={`Playback speed: ${playbackRate}x (Click to switch)`}
            aria-label={`Playback speed: ${playbackRate}x`}
            className="flex h-7 items-center justify-center rounded-lg border bg-background/60 px-2 font-mono text-[11px] font-semibold text-foreground/80 shadow-2xs transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            {playbackRate}
            x
          </button>

          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          {/* Download Button */}
          <a
            href={src}
            download={downloadFilename}
            aria-label={`Download ${title || 'audio'}`}
            title={`Download ${title || 'audio'}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Middle Section: Waveform Visualizer Simulation */}
      <div
        ref={waveformRef}
        onPointerDown={handleWaveformPointer}
        className="relative mt-3 flex h-9 cursor-pointer items-end gap-[2px] rounded-lg px-1 py-1 transition-colors hover:bg-muted/40"
        title="Click to seek"
        role="slider"
        aria-label="Audio waveform seeker"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
      >
        {waveformBars.map((heightFactor, idx) => {
          const barRatio = idx / waveformBars.length
          const isPlayed = barRatio <= progressRatio
          const barHeightPercent = Math.max(14, Math.round(heightFactor * 100))

          return (
            <span
              key={idx}
              style={{ height: `${barHeightPercent}%` }}
              className={`flex-1 min-w-[2px] max-w-[5px] rounded-full transition-all duration-100 ${
                isPlayed
                  ? 'bg-primary shadow-[0_0_8px_rgba(var(--primary),0.3)]'
                  : 'bg-muted-foreground/25 hover:bg-muted-foreground/45'
              } ${isPlaying && isPlayed && idx === Math.floor(progressRatio * waveformBars.length) ? 'scale-y-110' : ''}`}
            />
          )
        })}
      </div>

      {/* Bottom Section: Smooth Progress Scrub Bar */}
      <div
        ref={scrubBarRef}
        onPointerDown={onScrubPointerDown}
        onPointerMove={onScrubPointerMove}
        onPointerUp={onScrubPointerUp}
        onPointerLeave={() => setHoverProgress(null)}
        className="group/scrub relative mt-1.5 flex h-4 cursor-pointer items-center py-1 select-none"
        role="progressbar"
        aria-label="Audio scrub bar"
        aria-valuenow={Math.round(progressPercent)}
      >
        {/* Hover timestamp tooltip */}
        {hoverProgress !== null && duration > 0
          ? (
              <div
                style={{ left: `${hoverProgress * 100}%` }}
                className="pointer-events-none absolute -top-5 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold text-background shadow-sm"
              >
                {formatTime(hoverProgress * duration)}
              </div>
            )
          : null}

        {/* Track Background */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted transition-all group-hover/scrub:h-2">
          {/* Buffered progress */}
          <div
            style={{ width: `${buffered}%` }}
            className="absolute left-0 top-0 h-full rounded-full bg-muted-foreground/20 transition-all duration-200"
          />

          {/* Played progress */}
          <div
            style={{ width: `${progressPercent}%` }}
            className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-75"
          />
        </div>

        {/* Scrubber thumb handle */}
        <div
          style={{ left: `${progressPercent}%` }}
          className={`absolute h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow transition-transform duration-75 ${
            isDragging ? 'scale-125' : 'scale-0 group-hover/scrub:scale-100'
          }`}
        />
      </div>
    </div>
  )
}
