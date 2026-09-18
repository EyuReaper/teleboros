'use client'

import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, Maximize2, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

let mermaidCounter = 0

interface ActiveDiagram {
  id: string
  svg: string
  raw: string
}

/**
 * Client component that dynamically loads Mermaid.js on demand,
 * renders all .language-mermaid and .mermaid code blocks into interactive SVGs,
 * and equips every diagram with an interactive Pan & Zoom modal lightbox.
 */
export function ContentMermaid() {
  const { resolvedTheme } = useTheme()
  const [activeDiagram, setActiveDiagram] = useState<ActiveDiagram | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 })
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Reset pan and zoom when a diagram opens
  const openModal = useCallback((diagram: ActiveDiagram) => {
    setActiveDiagram(diagram)
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
    setCopied(false)
  }, [])

  const closeModal = useCallback(() => {
    setActiveDiagram(null)
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(4, Number((prev + 0.25).toFixed(2))))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(0.4, Number((prev - 0.25).toFixed(2))))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  const handleCopySource = useCallback(async () => {
    if (!activeDiagram?.raw) return
    try {
      await navigator.clipboard.writeText(activeDiagram.raw)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    catch {
      // Fallback
    }
  }, [activeDiagram])

  // Mouse wheel zoom inside lightbox
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.15 : -0.15
    setZoomLevel(prev => Math.min(4, Math.max(0.4, Number((prev + delta).toFixed(2)))))
  }, [])

  // Mouse drag pan inside lightbox
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragOrigin({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }, [panOffset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragOrigin.x,
      y: e.clientY - dragOrigin.y,
    })
  }, [isDragging, dragOrigin])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Render diagrams onto DOM
  useEffect(() => {
    const selector = '.prose-telegram pre code.language-mermaid, .mermaid-diagram-container pre, pre code.language-mermaid, pre.language-mermaid, .mermaid'
    const codeElements = Array.from(document.querySelectorAll<HTMLElement>(selector))
    if (codeElements.length === 0) return

    let isMounted = true

    async function renderMermaidBlocks() {
      try {
        // Dynamically load Mermaid ESM runtime from JSDelivr CDN (zero bundle bloat)
        // @ts-expect-error dynamic external import
        const mermaidModule = await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
        const mermaid = mermaidModule.default || mermaidModule

        if (!isMounted) return

        const isDark = resolvedTheme === 'dark' || document.documentElement.classList.contains('dark')

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'neutral',
          securityLevel: 'loose',
          fontFamily: 'inherit',
          themeVariables: isDark
            ? {
                primaryColor: '#1e293b',
                primaryTextColor: '#f8fafc',
                primaryBorderColor: '#0ea5e9',
                lineColor: '#38bdf8',
                secondaryColor: '#0f172a',
                tertiaryColor: '#1e293b',
              }
            : {
                primaryColor: '#f8fafc',
                primaryTextColor: '#0f172a',
                primaryBorderColor: '#0284c7',
                lineColor: '#0284c7',
              },
        })

        for (const el of codeElements) {
          // If already rendered with the current theme, skip
          if (el.dataset.mermaidRendered === 'true' && el.dataset.mermaidTheme === (isDark ? 'dark' : 'light')) {
            continue
          }

          const rawCode = el.dataset.mermaidRaw || el.textContent || ''
          if (!rawCode.trim() || !rawCode.includes('\n')) continue
          el.dataset.mermaidRaw = rawCode

          mermaidCounter += 1
          const uniqueId = `mermaid-svg-${Date.now()}-${mermaidCounter}`

          try {
            const { svg } = await mermaid.render(uniqueId, rawCode.trim())
            if (!isMounted) return

            const targetContainer = el.tagName.toLowerCase() === 'code' ? (el.closest('pre') || el) : el

            // Create interactive card
            const card = document.createElement('div')
            card.className = 'mermaid-diagram-card group relative my-6 overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm transition-all hover:border-primary/40 hover:shadow-md not-prose'
            card.dataset.mermaidRendered = 'true'
            card.dataset.mermaidTheme = isDark ? 'dark' : 'light'
            card.dataset.mermaidRaw = rawCode

            // Top Toolbar Header
            const header = document.createElement('div')
            header.className = 'flex items-center justify-between border-b border-border/40 bg-muted/40 px-3.5 py-2 text-xs font-mono'

            const titleSpan = document.createElement('span')
            titleSpan.className = 'inline-flex items-center gap-1.5 font-semibold text-muted-foreground'
            titleSpan.innerHTML = '<span class="inline-block h-2 w-2 rounded-full bg-primary/80"></span><span>DIAGRAM</span>'

            const actionsDiv = document.createElement('div')
            actionsDiv.className = 'flex items-center gap-1.5'

            // Zoom button
            const zoomBtn = document.createElement('button')
            zoomBtn.type = 'button'
            zoomBtn.className = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground'
            zoomBtn.title = 'Zoom and pan diagram'
            zoomBtn.innerHTML = '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg><span>Zoom</span>'
            zoomBtn.onclick = (e) => {
              e.stopPropagation()
              openModal({ id: uniqueId, svg, raw: rawCode })
            }

            actionsDiv.appendChild(zoomBtn)
            header.appendChild(titleSpan)
            header.appendChild(actionsDiv)
            card.appendChild(header)

            // Diagram Body Canvas
            const body = document.createElement('div')
            body.className = 'mermaid-body-canvas flex cursor-zoom-in justify-center overflow-x-auto p-5 transition-transform'
            body.innerHTML = svg
            body.onclick = () => {
              openModal({ id: uniqueId, svg, raw: rawCode })
            }
            card.appendChild(body)

            // Hint footer on hover
            const hint = document.createElement('div')
            hint.className = 'text-center text-[10px] text-muted-foreground/60 pb-2 transition-opacity group-hover:text-muted-foreground'
            hint.textContent = '💡 Click diagram to open interactive Pan & Zoom viewer'
            card.appendChild(hint)

            targetContainer.replaceWith(card)
          }
          catch (renderErr) {
            console.warn('[Teleboros Mermaid] Failed to render diagram block:', renderErr)
          }
        }
      }
      catch (loadErr) {
        console.warn('[Teleboros Mermaid] Could not load Mermaid runtime from CDN:', loadErr)
      }
    }

    renderMermaidBlocks()

    return () => {
      isMounted = false
    }
  }, [resolvedTheme, openModal])

  return (
    <Dialog open={Boolean(activeDiagram)} onOpenChange={open => !open && closeModal()}>
      <DialogContent className="max-w-6xl w-[94vw] h-[88vh] flex flex-col p-0 overflow-hidden border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogTitle className="sr-only">Interactive Diagram Viewer</DialogTitle>

        {/* Modal Toolbar */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-xs font-mono font-bold tracking-wider text-foreground uppercase">Diagram Inspector</span>
            <span className="text-[11px] font-mono text-muted-foreground ml-2">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={handleZoomIn}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition-colors hover:bg-muted"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition-colors hover:bg-muted"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border bg-background text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={handleCopySource}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border bg-background text-xs font-medium text-foreground transition-colors hover:bg-muted"
              title="Copy raw Mermaid source"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-foreground transition-colors hover:bg-rose-500/20 hover:text-rose-500 ml-1"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Pan & Zoom Interactive Stage */}
        <div
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 overflow-hidden relative flex items-center justify-center select-none bg-[radial-gradient(#8881_1px,transparent_1px)] [background-size:16px_16px] ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {activeDiagram && (
            <div
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              className="max-w-none max-h-none flex items-center justify-center pointer-events-none [&_svg]:max-w-none [&_svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: activeDiagram.svg }}
            />
          )}

          {/* Quick Helper Floating Badge */}
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-md shadow-sm pointer-events-none">
            <Move className="h-3 w-3" />
            <span>Click & drag to pan · Scroll to zoom</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
