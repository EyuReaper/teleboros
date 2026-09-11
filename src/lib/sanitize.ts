import sanitizeHtml from 'sanitize-html'

const commonTags = sanitizeHtml.defaults.allowedTags.concat([
  'img',
  'video',
  'audio',
  'source',
  'track',
  'button',
  'input',
  'label',
  'span',
  'svg',
  'path',
  'polygon',
  'line',
  'circle',
  'rect',
  'figure',
  'figcaption',
  'blockquote',
  'tg-spoiler',
])

const commonAttributes = {
  ...sanitizeHtml.defaults.allowedAttributes,
  '*': [
    'class',
    'id',
    'style',
    'title',
    'aria-label',
    'data-src',
    'data-title',
    'data-artist',
    'data-duration',
    'data-waveform',
    'data-voice',
    'data-filesize',
    'data-mounted',
    'data-speed',
    'data-media-type',
    'data-ratio',
    'data-album-id',
    'data-media-index',
    'data-total',
    'data-active',
  ],
  'a': ['href', 'name', 'target', 'rel', 'title', 'download'],
  'img': ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'class', 'data-blur-src', 'data-media-index', 'data-media-type', 'data-ratio', 'data-album-id'],
  'video': ['src', 'width', 'height', 'poster', 'controls', 'autoplay', 'loop', 'muted', 'playsinline', 'preload', 'data-media-index', 'data-media-type', 'data-ratio', 'data-album-id', 'class'],
  'audio': ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'data-src', 'data-title', 'data-artist', 'data-duration', 'data-waveform', 'data-voice', 'data-filesize', 'class'],
  'source': ['src', 'type'],
  'button': ['type', 'class', 'id', 'popover', 'popovertarget', 'popovertargetaction', 'aria-label', 'data-slide-index', 'data-album-id'],
  'input': ['type', 'class', 'id', 'checked', 'min', 'max', 'step', 'value', 'aria-label'],
  'label': ['for', 'class', 'aria-label'],
  'div': ['class', 'id', 'style', 'data-src', 'data-title', 'data-artist', 'data-duration', 'data-waveform', 'data-voice', 'data-filesize', 'data-mounted', 'data-image-count', 'data-album-id', 'data-album-laid', 'data-carousel-ready'],
  'svg': ['xmlns', 'viewBox', 'viewbox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'class'],
  'path': ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
  'polygon': ['points', 'fill', 'stroke', 'stroke-width'],
  'line': ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
  'circle': ['cx', 'cy', 'r', 'fill', 'stroke'],
  'rect': ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
}

const sanitizeConfig: sanitizeHtml.IOptions = {
  allowedTags: commonTags,
  allowedAttributes: commonAttributes,
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto', 'tel'],
    img: ['http', 'https', 'data'],
    video: ['http', 'https'],
    audio: ['http', 'https', 'data', 'blob'],
    source: ['http', 'https'],
  },
}

export function sanitizePostHtml(html: string) {
  return sanitizeHtml(html || '', sanitizeConfig)
}

export function sanitizeDescriptionHtml(html: string) {
  const descriptionAllowedTags = Array.isArray(sanitizeConfig.allowedTags)
    ? sanitizeConfig.allowedTags.filter(tag => tag !== 'button' && tag !== 'input' && tag !== 'video')
    : []

  return sanitizeHtml(html || '', {
    ...sanitizeConfig,
    allowedTags: descriptionAllowedTags,
  })
}

const INLINE_CODE_TOKEN_PREFIX = '__TELEBOROS_INLINE_CODE_'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

export function renderInlineMarkdown(input: string) {
  const raw = input.trim()
  if (!raw) {
    return ''
  }

  const codeSegments: string[] = []
  const withCodePlaceholders = raw
    .replace(/\r\n?/g, '\n')
    .replace(/`([^`\n]+)`/g, (_match, codeValue: string) => {
      const token = `${INLINE_CODE_TOKEN_PREFIX}${codeSegments.length}__`
      codeSegments.push(`<code>${escapeHtml(codeValue)}</code>`)
      return token
    })

  let html = escapeHtml(withCodePlaceholders)

  html = html
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => (
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
    ))
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
    .replace(/\n{2,}/g, '<br /><br />')
    .replace(/\n/g, '<br />')

  for (let index = 0; index < codeSegments.length; index += 1) {
    const token = `${INLINE_CODE_TOKEN_PREFIX}${index}__`
    html = html.replaceAll(token, codeSegments[index])
  }

  return sanitizeHtml(html, {
    allowedTags: ['a', 'strong', 'em', 'code', 'br', 's'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto', 'tel'],
    },
  })
}

export function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}
