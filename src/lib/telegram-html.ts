import sanitizeHtml from 'sanitize-html'

const TELEGRAM_ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  'ins',
  's',
  'strike',
  'del',
  'code',
  'pre',
  'blockquote',
  'tg-spoiler',
  'a',
]

/**
 * Normalize teaser markup before sending it through Telegram's strict HTML parser.
 * sanitize-html balances unclosed tags, removes unsupported markup, and restricts
 * links to schemes that Telegram can safely render.
 */
export function sanitizeTelegramHtml(input: string): string {
  return sanitizeHtml(
    input
      .replace(/\r\n?/g, '\n')
      .replace(/<br\s*\/?>/gi, '\n'),
    {
      allowedTags: TELEGRAM_ALLOWED_TAGS,
      allowedAttributes: {
        a: ['href'],
      },
      allowedSchemesByTag: {
        a: ['http', 'https', 'tg', 'mailto'],
      },
      disallowedTagsMode: 'discard',
    },
  )
}
