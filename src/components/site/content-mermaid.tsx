'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

let mermaidCounter = 0

/**
 * Client component that dynamically loads Mermaid.js on-demand and renders
 * all .language-mermaid and .mermaid code blocks into interactive SVGs.
 * Automatically responds to Next.js dark/light theme shifts.
 */
export function ContentMermaid() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    // Find all unrendered Mermaid blocks across longform articles and feed posts
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
                primaryColor: '#f1f5f9',
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

          // Extract and cache raw Mermaid code
          const rawCode = el.dataset.mermaidRaw || el.textContent || ''
          if (!rawCode.trim() || !rawCode.includes('\n')) continue
          el.dataset.mermaidRaw = rawCode

          mermaidCounter += 1
          const uniqueId = `mermaid-svg-${Date.now()}-${mermaidCounter}`

          try {
            const { svg } = await mermaid.render(uniqueId, rawCode.trim())
            if (!isMounted) return

            // Determine target container to replace (either code's pre parent or the element itself)
            const targetContainer = el.tagName.toLowerCase() === 'code' ? (el.closest('pre') || el) : el

            const wrapper = document.createElement('div')
            wrapper.className = 'mermaid-diagram-card my-6 flex justify-center overflow-x-auto rounded-xl border border-border/60 bg-muted/20 p-4 shadow-sm not-prose transition-all'
            wrapper.innerHTML = svg
            wrapper.dataset.mermaidRendered = 'true'
            wrapper.dataset.mermaidTheme = isDark ? 'dark' : 'light'
            wrapper.dataset.mermaidRaw = rawCode

            targetContainer.replaceWith(wrapper)
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
  }, [resolvedTheme])

  return null
}
