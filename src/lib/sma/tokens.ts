import type { SmaColorToken } from './types'

export interface ColorPaletteDef {
  name: string
  hex: string
  bgHex: string
  borderHex: string
  textHex: string
}

export const COLOR_PALETTES: ColorPaletteDef[] = [
  {
    name: 'Cosmic Violet',
    hex: '#a855f7',
    bgHex: 'rgba(168, 85, 247, 0.12)',
    borderHex: 'rgba(168, 85, 247, 0.35)',
    textHex: '#c084fc',
  },
  {
    name: 'Solar Amber',
    hex: '#f59e0b',
    bgHex: 'rgba(245, 158, 11, 0.12)',
    borderHex: 'rgba(245, 158, 11, 0.35)',
    textHex: '#fbbf24',
  },
  {
    name: 'Neon Emerald',
    hex: '#10b981',
    bgHex: 'rgba(16, 185, 129, 0.12)',
    borderHex: 'rgba(16, 185, 129, 0.35)',
    textHex: '#34d399',
  },
  {
    name: 'Electric Cyan',
    hex: '#06b6d4',
    bgHex: 'rgba(6, 182, 212, 0.12)',
    borderHex: 'rgba(6, 182, 212, 0.35)',
    textHex: '#22d3ee',
  },
  {
    name: 'Crimson Pulse',
    hex: '#f43f5e',
    bgHex: 'rgba(244, 63, 94, 0.12)',
    borderHex: 'rgba(244, 63, 94, 0.35)',
    textHex: '#fb7185',
  },
  {
    name: 'Rose Quartz',
    hex: '#ec4899',
    bgHex: 'rgba(236, 72, 153, 0.12)',
    borderHex: 'rgba(236, 72, 153, 0.35)',
    textHex: '#f472b6',
  },
  {
    name: 'Acid Lime',
    hex: '#84cc16',
    bgHex: 'rgba(132, 204, 22, 0.12)',
    borderHex: 'rgba(132, 204, 22, 0.35)',
    textHex: '#a3e635',
  },
  {
    name: 'Glacial Indigo',
    hex: '#6366f1',
    bgHex: 'rgba(99, 102, 241, 0.12)',
    borderHex: 'rgba(99, 102, 241, 0.35)',
    textHex: '#818cf8',
  },
  {
    name: 'Blaze Orange',
    hex: '#f97316',
    bgHex: 'rgba(249, 115, 22, 0.12)',
    borderHex: 'rgba(249, 115, 22, 0.35)',
    textHex: '#fb923c',
  },
  {
    name: 'Teal Mirage',
    hex: '#14b8a6',
    bgHex: 'rgba(20, 184, 166, 0.12)',
    borderHex: 'rgba(20, 184, 166, 0.35)',
    textHex: '#2dd4bf',
  },
  {
    name: 'Hyper Gold',
    hex: '#eab308',
    bgHex: 'rgba(234, 179, 8, 0.12)',
    borderHex: 'rgba(234, 179, 8, 0.35)',
    textHex: '#facc15',
  },
  {
    name: 'Phantom Magenta',
    hex: '#d946ef',
    bgHex: 'rgba(217, 70, 239, 0.12)',
    borderHex: 'rgba(217, 70, 239, 0.35)',
    textHex: '#e879f9',
  },
]

/**
 * 32-bit FNV-1a non-cryptographic hash for fast, uniform token distribution
 */
export function fnv1a32(str: string): number {
  let hash = 0x811C9DC5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Generates or derives a deterministic SmaColorToken given a seed string.
 * Example result: { name: 'Cosmic Violet', hex: '#a855f7', tokenNumber: 104, badge: '● Cosmic Violet #104' }
 */
export function deriveColorToken(seed: string): SmaColorToken {
  const hash = fnv1a32(seed)
  const paletteIndex = hash % COLOR_PALETTES.length
  const palette = COLOR_PALETTES[paletteIndex]
  // 3-digit token number between 100 and 999
  const tokenNumber = 100 + ((hash >>> 8) % 900)
  const badge = `● ${palette.name} #${tokenNumber}`

  return {
    name: palette.name,
    hex: palette.hex,
    bgHex: palette.bgHex,
    borderHex: palette.borderHex,
    textHex: palette.textHex,
    tokenNumber,
    badge,
  }
}

/**
 * Generate a new random seed token for a client session/inquiry
 */
export function generateClientSeed(): string {
  const random = Math.random().toString(36).slice(2, 10)
  const timestamp = Date.now().toString(36)
  return `${timestamp}-${random}`
}
