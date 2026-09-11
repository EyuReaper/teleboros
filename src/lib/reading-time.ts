/**
 * Calculates human-readable reading time for an article or post text.
 * Average reading speed: 200 words per minute.
 */
export function calculateReadingTime(text: string): string {
  if (!text || !text.trim()) {
    return '1 min read'
  }

  // Strip HTML and Markdown syntax for accurate word count
  const clean = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*`_~[\]()]/g, ' ')
    .trim()

  const words = clean.split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 200))

  return `${minutes} min read`
}
