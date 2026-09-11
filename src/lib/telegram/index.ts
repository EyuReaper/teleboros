import type { ChannelInfo, ChannelPost, ChannelReaction } from '@/lib/types'
import * as cheerio from 'cheerio'
import flourite from 'flourite'
import { LRUCache } from 'lru-cache'
import { $fetch } from 'ofetch'
import { buildStaticProxyUrl, getAppConfig } from '@/lib/config'
import { extractMediaFilename, getImageMetaMap } from '@/lib/image-meta'
import prism from '@/lib/prism'
import { sanitizeDescriptionHtml, sanitizePostHtml } from '@/lib/sanitize'

interface ChannelQuery {
  before?: string
  after?: string
  q?: string
  id?: string
  requestHeaders?: HeadersInit
}

const cache = new LRUCache<string, ChannelInfo | ChannelPost>({
  ttl: 1000 * 60 * 5,
  maxSize: 50 * 1024 * 1024,
  sizeCalculation: item => JSON.stringify(item).length,
})

const TELEGRAM_FETCH_TIMEOUT_MS = 60000

const unnecessaryHeaders = new Set(['host', 'cookie', 'origin', 'referer'])
const codeLanguageClassPattern = /\b(?:language|lang)-([a-z0-9#+-]+)\b/i

const prismLanguageAliases: Record<string, string> = {
  cplusplus: 'cpp',
  cs: 'csharp',
  csharp: 'csharp',
  dockerfile: 'docker',
  golang: 'go',
  html: 'markup',
  js: 'javascript',
  json5: 'json',
  md: 'markdown',
  plaintext: 'text',
  py: 'python',
  shell: 'bash',
  shellscript: 'bash',
  sh: 'bash',
  text: 'text',
  ts: 'typescript',
  xml: 'markup',
  yml: 'yaml',
  zsh: 'bash',
}

function normalizeLanguageCandidate(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^language[-_:]/, '')
    .replace(/^lang[-_:]/, '')
    .replace(/\s+/g, '')
}

function resolvePrismLanguage(value?: string | null) {
  if (!value) {
    return null
  }

  const normalized = normalizeLanguageCandidate(value)
  if (!normalized) {
    return null
  }

  const mapped = prismLanguageAliases[normalized] || normalized
  return prism.languages[mapped] ? mapped : null
}

function extractCodeLanguageFromNode($: cheerio.CheerioAPI, node: cheerio.Element) {
  const pre = $(node)
  const code = pre.find('code').first()
  const candidates = [
    pre.attr('data-language'),
    pre.attr('data-lang'),
    pre.attr('language'),
    pre.attr('lang'),
    code.attr('data-language'),
    code.attr('data-lang'),
    code.attr('language'),
    code.attr('lang'),
  ]

  for (const candidate of candidates) {
    const resolved = resolvePrismLanguage(candidate)
    if (resolved) {
      return resolved
    }
  }

  const classNames = [pre.attr('class') || '', code.attr('class') || ''].join(' ')
  const classMatch = classNames.match(codeLanguageClassPattern)
  if (classMatch?.[1]) {
    const resolved = resolvePrismLanguage(classMatch[1])
    if (resolved) {
      return resolved
    }
  }

  return null
}

function escapeHtmlAttr(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;')
}

function normalizeEmoji(emoji: string) {
  const emojiMap: Record<string, string> = {
    '\u2764': '\u2764\uFE0F',
    '\u263A': '\u263A\uFE0F',
    '\u2639': '\u2639\uFE0F',
    '\u2665': '\u2764\uFE0F',
  }
  return emojiMap[emoji] || emoji
}

function getCustomEmojiImage(emojiId?: string, staticProxy = '') {
  if (!emojiId) {
    return ''
  }

  const imageUrl = `https://t.me/i/emoji/${emojiId}.webp`
  return buildStaticProxyUrl(staticProxy, imageUrl)
}

async function hydrateTelegramEmoji($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>, staticProxy = '') {
  const emojiNodes = $(content).find('tg-emoji')?.toArray() ?? []
  if (emojiNodes.length === 0) {
    return
  }

  await Promise.all(emojiNodes.map((emojiEl) => {
    const emojiId = $(emojiEl).attr('emoji-id')
    if (!emojiId) {
      return null
    }

    const imageUrl = getCustomEmojiImage(emojiId, staticProxy)
    if (!imageUrl) {
      return null
    }

    const imageMarkup = `<img class="tg-emoji" src="${escapeHtmlAttr(imageUrl)}" alt="" loading="lazy" />`
    $(emojiEl).replaceWith(imageMarkup)
    return null
  }))
}

function getVideoStickers($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string, _index: number) {
  return $(item)
    .find('.js-videosticker_video')
    ?.map((_index, video) => {
      const src = $(video).attr('src')
      const fallback = $(video).find('img')?.attr('src')
      if (!src || !fallback) {
        return ''
      }

      return `
      <div style="background-image:none;width:256px;">
        <video src="${escapeHtmlAttr(buildStaticProxyUrl(staticProxy, src))}" width="100%" height="100%" preload="metadata" muted autoplay loop playsinline disablepictureinpicture>
          <img class="sticker" src="${escapeHtmlAttr(buildStaticProxyUrl(staticProxy, fallback))}" alt="Video sticker" loading="lazy" />
        </video>
      </div>`
    })
    ?.get()
    ?.join('')
}

function getImageStickers($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string, _index: number) {
  return $(item)
    .find('.tgme_widget_message_sticker')
    ?.map((_index, image) => {
      const url = $(image).attr('data-webp')
      if (!url) {
        return ''
      }

      return `<img class="sticker" src="${escapeHtmlAttr(buildStaticProxyUrl(staticProxy, url))}" style="width:256px;" alt="Sticker" loading="lazy" />`
    })
    ?.get()
    ?.join('')
}

async function getImages($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string, index: number, title: string) {
  const metaMap = await getImageMetaMap()
  const images = $(item)
    .find('.tgme_widget_message_photo_wrap')
    ?.map((_index, photo) => {
      const style = $(photo).attr('style')
      const url = style?.match(/url\(["']?(.*?)["']?\)/)?.[1]
      if (!url) {
        return ''
      }

      const escapedTitle = escapeHtmlAttr(title || 'Post image')
      const proxyUrl = buildStaticProxyUrl(staticProxy, url)
      const escapedUrl = escapeHtmlAttr(proxyUrl)

      // Look up build-time image metadata for dimensions + blur placeholder.
      const filename = extractMediaFilename(proxyUrl)
      const meta = metaMap[filename]
      const sizeAttrs = meta ? ` width="${meta.w}" height="${meta.h}"` : ''
      const blurAttr = meta?.b ? ` data-blur-src="${escapeHtmlAttr(meta.b)}"` : ''

      return `
      <img class="zoomable" src="${escapedUrl}" alt="${escapedTitle}" loading="lazy"${sizeAttrs}${blurAttr} />`
    })
    ?.get()
    ?.filter(Boolean)

  if (!images || images.length === 0) {
    return ''
  }

  return `<div class="image-list-container" data-image-count="${images.length}">${images.join('')}</div>`
}

function getVideo($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string, index: number) {
  const videoElements: string[] = []

  $(item).find('.tgme_widget_message_video_wrap').each((_wIndex, wrapEl) => {
    const wrap = $(wrapEl)
    const video = wrap.find('video')
    if (video.length > 0) {
      const src = video.attr('src')
      if (src) {
        video.attr('src', buildStaticProxyUrl(staticProxy, src))
      }
      video.find('source').each((_sourceIndex, source) => {
        const sourceSrc = $(source).attr('src')
        if (sourceSrc) {
          $(source).attr('src', buildStaticProxyUrl(staticProxy, sourceSrc))
        }
      })

      const thumb = wrap.find('.tgme_widget_message_video_thumb')
      if (thumb.length > 0) {
        const style = thumb.attr('style')
        const urlMatch = style?.match(/url\(["']?(.*?)["']?\)/)
        if (urlMatch && urlMatch[1]) {
          video.attr('poster', buildStaticProxyUrl(staticProxy, urlMatch[1]))
        }
      }

      video
        .addClass('post-video')
        .attr('controls', 'true')
        .attr('preload', index > 15 ? 'auto' : 'metadata')
        .attr('playsinline', 'true')
        .attr('webkit-playsinline', 'true')

      videoElements.push($.html(video))
    }
  })

  $(item).find('.tgme_widget_message_roundvideo_wrap').each((_rIndex, roundWrapEl) => {
    const roundVideoWrap = $(roundWrapEl)
    const roundVideo = roundVideoWrap.find('video')
    if (roundVideo.length > 0) {
      const src = roundVideo.attr('src')
      if (src) {
        roundVideo.attr('src', buildStaticProxyUrl(staticProxy, src))
      }
      roundVideo.find('source').each((_sourceIndex, source) => {
        const sourceSrc = $(source).attr('src')
        if (sourceSrc) {
          $(source).attr('src', buildStaticProxyUrl(staticProxy, sourceSrc))
        }
      })

      const roundThumb = roundVideoWrap.find('.tgme_widget_message_roundvideo_thumb')
      if (roundThumb.length > 0) {
        const style = roundThumb.attr('style')
        const urlMatch = style?.match(/url\(["']?(.*?)["']?\)/)
        if (urlMatch && urlMatch[1]) {
          roundVideo.attr('poster', buildStaticProxyUrl(staticProxy, urlMatch[1]))
        }
      }

      roundVideo
        .addClass('post-video')
        .attr('controls', 'true')
        .attr('preload', index > 15 ? 'auto' : 'metadata')
        .attr('playsinline', 'true')
        .attr('webkit-playsinline', 'true')

      videoElements.push($.html(roundVideo))
    }
  })

  return videoElements.join('')
}

const AUDIO_EXT_PATTERN = /\.(?:mp3|ogg|oga|m4a|aac|wav|opus|flac|wma)(?:\?|$)/i

function isAudioDocumentWrap($: cheerio.CheerioAPI, wrap: cheerio.Cheerio<any>): boolean {
  if (wrap.find('.tgme_widget_message_document_icon.audio').length > 0) {
    return true
  }
  if (wrap.find('audio').length > 0) {
    return true
  }
  const href = wrap.attr('href') || ''
  const title = wrap.find('.tgme_widget_message_document_title').text().trim()
  if (AUDIO_EXT_PATTERN.test(href) || AUDIO_EXT_PATTERN.test(title)) {
    return true
  }
  const extra = wrap.find('.tgme_widget_message_document_extra').text().trim()
  if (/\b(?:audio|voice|mp3|ogg|m4a|wav|podcast)\b/i.test(extra)) {
    return true
  }
  return false
}

function getAudio($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string, _index: number): string {
  const audioElements: string[] = []
  const handledSrcs = new Set<string>()

  // 1. Voice players (.tgme_widget_message_voice_player)
  $(item).find('.tgme_widget_message_voice_player, .js-message_voice_player').each((_vIndex, vEl) => {
    const wrap = $(vEl)
    const audioEl = wrap.find('audio.tgme_widget_message_voice, audio.js-message_voice, audio')
    const rawSrc = audioEl.attr('src') || audioEl.attr('data-ogg') || wrap.attr('href') || ''
    if (!rawSrc)
      return

    const src = buildStaticProxyUrl(staticProxy, rawSrc)
    if (handledSrcs.has(src))
      return
    handledSrcs.add(src)

    const waveform = audioEl.attr('data-waveform') || wrap.attr('data-waveform') || ''
    const duration = wrap.find('.tgme_widget_message_voice_duration, .js-message_voice_duration').text().trim()
    const title = 'Voice message'

    audioElements.push(`
      <div class="teleboros-audio-player my-3"
           data-src="${escapeHtmlAttr(src)}"
           data-title="${escapeHtmlAttr(title)}"
           data-duration="${escapeHtmlAttr(duration)}"
           data-waveform="${escapeHtmlAttr(waveform)}"
           data-voice="true">
        <audio preload="metadata" src="${escapeHtmlAttr(src)}" class="hidden"></audio>
        <div class="teleboros-audio-card flex items-center gap-3 rounded-2xl border bg-card/80 p-3.5 shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-foreground">${escapeHtmlAttr(title)}</div>
            <div class="text-xs text-muted-foreground">${escapeHtmlAttr(duration || 'Voice Note')}</div>
          </div>
          <a href="${escapeHtmlAttr(src)}" download="voice_message.ogg" class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground" title="Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </div>
      </div>
    `)
  })

  // 2. Audio documents (.tgme_widget_message_document_wrap with audio)
  $(item).find('.tgme_widget_message_document_wrap').each((_dIndex, dEl) => {
    const wrap = $(dEl)
    if (!isAudioDocumentWrap($, wrap)) {
      return
    }

    const rawSrc = wrap.find('audio').attr('src') || wrap.find('source').attr('src') || wrap.attr('href') || ''
    if (!rawSrc)
      return

    const src = buildStaticProxyUrl(staticProxy, rawSrc)
    if (handledSrcs.has(src))
      return
    handledSrcs.add(src)

    const title = wrap.find('.tgme_widget_message_document_title').text().trim() || 'Audio Track'
    const extra = wrap.find('.tgme_widget_message_document_extra').text().trim()

    let artist = ''
    let duration = ''
    let filesize = ''

    if (extra) {
      const durMatch = extra.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)
      if (durMatch)
        duration = durMatch[0]

      const sizeMatch = extra.match(/\b[\d.]+\s*(?:KB|MB|GB|B)\b/i)
      if (sizeMatch)
        filesize = sizeMatch[0]

      if (extra.includes('–') || extra.includes('—') || extra.includes('-')) {
        const parts = extra.split(/[–—\-]/)
        if (parts[0])
          artist = parts[0].trim()
      }
    }

    const filename = title.includes('.') ? title : `${title}.mp3`

    audioElements.push(`
      <div class="teleboros-audio-player my-3"
           data-src="${escapeHtmlAttr(src)}"
           data-title="${escapeHtmlAttr(title)}"
           data-artist="${escapeHtmlAttr(artist)}"
           data-duration="${escapeHtmlAttr(duration)}"
           data-filesize="${escapeHtmlAttr(filesize)}"
           data-voice="false">
        <audio preload="metadata" src="${escapeHtmlAttr(src)}" class="hidden"></audio>
        <div class="teleboros-audio-card flex items-center gap-3 rounded-2xl border bg-card/80 p-3.5 shadow-sm">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-foreground">${escapeHtmlAttr(title)}</div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              ${artist ? `<span>${escapeHtmlAttr(artist)}</span><span>•</span>` : ''}
              <span>${escapeHtmlAttr(duration || 'Audio')}</span>
              ${filesize ? `<span>•</span><span>${escapeHtmlAttr(filesize)}</span>` : ''}
            </div>
          </div>
          <a href="${escapeHtmlAttr(src)}" download="${escapeHtmlAttr(filename)}" class="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground" title="Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </div>
      </div>
    `)
  })

  // 3. Any standalone <audio> elements
  $(item).find('audio').each((_aIndex, aEl) => {
    const audioEl = $(aEl)
    if (audioEl.closest('.tgme_widget_message_voice_player, .tgme_widget_message_document_wrap, .teleboros-audio-player').length > 0) {
      return
    }

    const rawSrc = audioEl.attr('src') || audioEl.find('source').attr('src') || ''
    if (!rawSrc)
      return

    const src = buildStaticProxyUrl(staticProxy, rawSrc)
    if (handledSrcs.has(src))
      return
    handledSrcs.add(src)

    const title = audioEl.attr('data-title') || 'Audio Track'
    const artist = audioEl.attr('data-artist') || ''
    const duration = audioEl.attr('data-duration') || ''
    const waveform = audioEl.attr('data-waveform') || ''
    const isVoice = audioEl.attr('data-voice') === 'true'

    audioElements.push(`
      <div class="teleboros-audio-player my-3"
           data-src="${escapeHtmlAttr(src)}"
           data-title="${escapeHtmlAttr(title)}"
           data-artist="${escapeHtmlAttr(artist)}"
           data-duration="${escapeHtmlAttr(duration)}"
           data-waveform="${escapeHtmlAttr(waveform)}"
           data-voice="${isVoice ? 'true' : 'false'}">
        <audio preload="metadata" src="${escapeHtmlAttr(src)}" class="hidden"></audio>
      </div>
    `)
  })

  return audioElements.join('')
}

function getNonAudioDocuments($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string): string {
  const docElements: string[] = []

  $(item).find('.tgme_widget_message_document_wrap').each((_dIndex, dEl) => {
    const wrap = $(dEl)
    if (isAudioDocumentWrap($, wrap)) {
      return // skip, already rendered by getAudio()
    }

    const href = wrap.attr('href')
    if (href) {
      wrap.attr('href', buildStaticProxyUrl(staticProxy, href))
    }

    docElements.push($.html(wrap))
  })

  return docElements.join('')
}

function getLinkPreview($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string, _index: number) {
  const link = $(item).find('.tgme_widget_message_link_preview')
  const title = $(item).find('.link_preview_title')?.text() || $(item).find('.link_preview_site_name')?.text() || ''
  const description = $(item).find('.link_preview_description')?.text() || ''
  const siteName = link.find('.link_preview_site_name')?.first()

  link.attr('target', '_blank').attr('rel', 'noopener noreferrer').attr('title', description)

  const href = link.attr('href') || ''
  if (href) {
    try {
      const parsed = new URL(href, 'https://t.me')
      const host = parsed.hostname.replace(/^www\./i, '')
      if (host) {
        link.attr('data-host', host)
        if (!siteName?.text()?.trim()) {
          siteName?.text(host)
        }
      }
    }
    catch {
      // Keep rendering even if preview link is malformed.
    }
  }

  const image = $(item).find('.link_preview_image')
  const src = image?.attr('style')?.match(/url\(["']?(.*?)["']?\)/)?.[1]
  if (src) {
    const imageSrc = escapeHtmlAttr(buildStaticProxyUrl(staticProxy, src))
    image.replaceWith(`<img class="link_preview_image" alt="${escapeHtmlAttr(title)}" src="${imageSrc}" loading="lazy" />`)
  }
  else {
    const imageSrc = image.attr('src')
    if (imageSrc) {
      image.attr('src', buildStaticProxyUrl(staticProxy, imageSrc))
    }
  }

  return $.html(link)
}

function getReply($: cheerio.CheerioAPI, item: cheerio.Element, channel: string) {
  const reply = $(item).find('.tgme_widget_message_reply')
  reply?.wrapInner('<small></small>')?.wrapInner('<blockquote></blockquote>')

  const href = reply?.attr('href')
  if (href) {
    try {
      const replyUrl = new URL(href)
      const pathname = replyUrl.pathname.replace(new RegExp(`/${channel}/`, 'i'), '/posts/')
      reply.attr('href', pathname)
    }
    catch {
      // ignore invalid reply URL
    }
  }

  return $.html(reply)
}

async function modifyHtmlContent($: cheerio.CheerioAPI, content: cheerio.Cheerio<any>, index: number, staticProxy: string) {
  await hydrateTelegramEmoji($, content, staticProxy)

  $(content).find('.emoji')?.removeAttr('style')

  $(content).find('a')?.each((_index, anchor) => {
    const title = $(anchor)?.text()
    $(anchor)?.attr('title', title)?.removeAttr('onclick')

    if ($(anchor)?.attr('target') === '_blank') {
      $(anchor).attr('rel', 'noopener noreferrer')
    }
  })

  $(content).find('blockquote[expandable]')?.each((_index, blockquote) => {
    const innerHtml = $(blockquote).html()
    const id = `expand-${index}-${_index}`
    const expandable = `<div class="tg-expandable">
      <input type="checkbox" id="${id}" class="tg-expandable__checkbox">
      <div class="tg-expandable__content">${innerHtml}</div>
      <label for="${id}" class="tg-expandable__toggle" aria-label="Expand or collapse"></label>
    </div>`
    $(blockquote).replaceWith(expandable)
  })

  $(content).find('tg-spoiler')?.each((_index, spoiler) => {
    const id = `spoiler-${index}-${_index}`
    $(spoiler).attr('id', id)?.wrap('<label class="spoiler-button"></label>')?.before('<input type="checkbox" />')
  })

  $(content).find('pre').each((_index, pre) => {
    try {
      $(pre).find('br').replaceWith('\n')

      const code = $(pre).text().replace(/^(?:\r?\n)+/, '')
      const explicitLanguage = extractCodeLanguageFromNode($, pre)
      const detectedLanguage = resolvePrismLanguage(flourite(code, { shiki: true, noUnknown: true })?.language)
      const language = explicitLanguage || detectedLanguage || 'text'
      const grammar = prism.languages[language]
      const highlightedCode = grammar
        ? prism.highlight(code, grammar, language)
        : prism.util.encode(code).toString()

      $(pre).attr('data-language', language)
      $(pre).html(`<code class="language-${language}" data-language="${escapeHtmlAttr(language)}">${highlightedCode}</code>`)
    }
    catch (error) {
      console.error(error)
    }
  })

  return content
}

function getReactions($: cheerio.CheerioAPI, item: cheerio.Element, staticProxy: string): ChannelReaction[] {
  const reactions: ChannelReaction[] = []
  const reactionNodes = $(item).find('.tgme_widget_message_reactions .tgme_reaction').toArray()

  for (const reaction of reactionNodes) {
    const isPaid = $(reaction).hasClass('tgme_reaction_paid')
    let emoji = ''
    let emojiId = ''
    let emojiImage = ''

    const standardEmoji = $(reaction).find('.emoji b')
    if (standardEmoji.length) {
      emoji = normalizeEmoji(standardEmoji.text().trim())
    }

    const tgEmoji = $(reaction).find('tg-emoji')
    if (tgEmoji.length && !emoji) {
      emojiId = tgEmoji.attr('emoji-id') || ''
      emojiImage = getCustomEmojiImage(emojiId, staticProxy)
    }

    if (isPaid && !emoji && !emojiImage) {
      emoji = '\u2B50'
    }

    const clone = $(reaction).clone()
    clone.find('.emoji, tg-emoji, i').remove()
    const count = clone.text().trim()

    if (!count) {
      continue
    }

    reactions.push({
      emoji,
      emojiId,
      emojiImage,
      count,
      isPaid,
    })
  }

  return reactions
}

function getPostViews(messageNode: cheerio.Cheerio<any>) {
  const viewSelectors = [
    '.tgme_widget_message_views',
    '.tgme_widget_message_info_views',
    '.tgme_widget_message_views_wrap',
  ]

  for (const selector of viewSelectors) {
    const viewNode = messageNode.find(selector).first()
    if (!viewNode.length) {
      continue
    }

    const text = viewNode.text().replace(/\s+/g, ' ').trim()
    if (text) {
      return text
    }

    const title = (viewNode.attr('title') || '').trim()
    if (title) {
      return title.replace(/\s+views?$/i, '').trim()
    }

    const ariaLabel = (viewNode.attr('aria-label') || '').trim()
    if (ariaLabel) {
      return ariaLabel.replace(/\s+views?$/i, '').trim()
    }

    const dataViews = (viewNode.attr('data-views') || '').trim()
    if (dataViews) {
      return dataViews
    }
  }

  return ''
}

function getPostComments(messageNode: cheerio.Cheerio<any>) {
  const commentSelectors = [
    '.tgme_widget_message_replies',
    '.tgme_widget_message_comments',
    '.tgme_widget_message_discussion',
    '.tgme_widget_message_replies_wrap',
  ]

  for (const selector of commentSelectors) {
    const node = messageNode.find(selector).first()
    if (!node.length) {
      continue
    }

    const text = node.text().replace(/\s+/g, ' ').trim()
    if (text) {
      const match = text.match(/[\d.]+[km]?/i)
      return match ? match[0] : text
    }

    const countAttr = node.attr('data-count') || node.attr('data-replies') || node.attr('data-comments')
    if (countAttr) {
      return countAttr.trim()
    }
  }

  return ''
}

function isPostEdited(messageNode: cheerio.Cheerio<any>) {
  const explicitEditedMarker = messageNode.find(
    '[class*="edited"], [class*="edit_date"], [class*="message_edit"]',
  )

  if (explicitEditedMarker.length > 0) {
    return true
  }

  const metadataText = messageNode
    .find('.tgme_widget_message_info, .tgme_widget_message_meta')
    .text()
    .replace(/\s+/g, ' ')
    .trim()

  if (/\bedited\b/i.test(metadataText)) {
    return true
  }

  const dateTitle = (messageNode.find('.tgme_widget_message_date').first().attr('title') || '').trim()
  if (/\bedited\b/i.test(dateTitle)) {
    return true
  }

  return false
}

async function getPost(
  $: cheerio.CheerioAPI,
  item: cheerio.Element | null,
  channel: string,
  staticProxy: string,
  index: number,
  reactionsEnabled: boolean,
): Promise<ChannelPost> {
  const messageNode = item ? $(item).find('.tgme_widget_message') : $('.tgme_widget_message')
  const messageTextNode = messageNode.find('.js-message_reply_text')?.length > 0
    ? messageNode.find('.tgme_widget_message_text.js-message_text')
    : messageNode.find('.tgme_widget_message_text')

  const contentNode = await modifyHtmlContent($, messageTextNode, index, staticProxy)

  const text = contentNode?.text() || ''
  const title = text.match(/^.*?(?=[。\n]|http\S)/g)?.[0] ?? text
  const id = messageNode.attr('data-post')?.replace(new RegExp(`${channel}/`, 'i'), '') || ''

  const tags = contentNode
    .find('a[href^="?q="]')
    ?.each((_index, anchor) => {
      const anchorText = $(anchor)?.text()
      $(anchor)?.attr('href', `/search?q=${encodeURIComponent(anchorText)}`)
    })
    ?.map((_index, anchor) => $(anchor)?.text()?.replace('#', ''))
    ?.get()
    ?.filter(Boolean) as string[]

  const hasDirectVideo = messageNode.find('.tgme_widget_message_video_wrap video, .tgme_widget_message_roundvideo_wrap video').length > 0

  const rawContent = [
    getReply($, messageNode[0], channel),
    await getImages($, messageNode[0], staticProxy, index, title),
    getVideo($, messageNode[0], staticProxy, index),
    getAudio($, messageNode[0], staticProxy, index),
    contentNode?.html(),
    getImageStickers($, messageNode[0], staticProxy, index),
    getVideoStickers($, messageNode[0], staticProxy, index),
    messageNode.find('.tgme_widget_message_poll')?.html(),
    getNonAudioDocuments($, messageNode[0], staticProxy),
    hasDirectVideo ? '' : $.html(messageNode.find('.tgme_widget_message_video_player.not_supported')),
    $.html(messageNode.find('.tgme_widget_message_location_wrap')),
    getLinkPreview($, messageNode[0], staticProxy, index),
  ]
    .filter(Boolean)
    .join('')
    .replace(/url\(["']?(https?:\/\/|\/\/)([^"')]+)["']?\)/g, (_match, scheme, tail) => {
      const sourceUrl = scheme === '//' ? `https://${tail}` : `${scheme}${tail}`
      const targetUrl = buildStaticProxyUrl(staticProxy, sourceUrl)
      return `url("${targetUrl}")`
    })

  return {
    id,
    title,
    type: messageNode.attr('class')?.includes('service_message') ? 'service' : 'text',
    datetime: messageNode.find('.tgme_widget_message_date time')?.attr('datetime') || '',
    edited: isPostEdited(messageNode),
    views: getPostViews(messageNode),
    comments: getPostComments(messageNode),
    tags,
    text,
    content: sanitizePostHtml(rawContent),
    reactions: reactionsEnabled ? getReactions($, messageNode[0], staticProxy) : [],
  }
}

function normalizeHeaders(requestHeaders?: HeadersInit) {
  const normalized: Record<string, string> = {}
  if (!requestHeaders) {
    return normalized
  }

  const headers = new Headers(requestHeaders)
  headers.forEach((value, key) => {
    const lowered = key.toLowerCase()
    if (!unnecessaryHeaders.has(lowered)) {
      normalized[lowered] = value
    }
  })
  return normalized
}

export async function getChannelInfo(options: ChannelQuery = {}): Promise<ChannelInfo | ChannelPost> {
  const { before = '', after = '', q = '', id = '' } = options
  const cfg = getAppConfig()

  if (!cfg.channel) {
    throw new Error('Missing channel identifier in SITE_CONSTANTS.channel')
  }

  const cacheKey = JSON.stringify({
    channel: cfg.channel,
    host: cfg.telegramHost,
    staticProxy: cfg.staticProxy,
    reactions: cfg.reactionsEnabled,
    before,
    after,
    q,
    id,
  })

  const cachedResult = cache.get(cacheKey)
  if (cachedResult) {
    return JSON.parse(JSON.stringify(cachedResult))
  }

  const url = id
    ? `https://${cfg.telegramHost}/${cfg.channel}/${id}?embed=1&mode=tme`
    : `https://${cfg.telegramHost}/s/${cfg.channel}`

  const headers = normalizeHeaders(options.requestHeaders)

  let html = ''
  try {
    html = await $fetch<string>(url, {
      headers,
      query: {
        before: before || undefined,
        after: after || undefined,
        q: q || undefined,
      },
      retry: 5,
      retryDelay: 1000,
      timeout: TELEGRAM_FETCH_TIMEOUT_MS,
    })
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const fetchContext = `before=${before || '-'} after=${after || '-'} q=${q || '-'} id=${id || '-'}`
    console.error(`[teleboros] failed to fetch channel data ${url} ${fetchContext} error=${errorMessage}`)

    const baselineCacheKey = JSON.stringify({
      channel: cfg.channel,
      host: cfg.telegramHost,
      staticProxy: cfg.staticProxy,
      reactions: cfg.reactionsEnabled,
      before: '',
      after: '',
      q: '',
      id: '',
    })

    const baselineCached = cache.get(baselineCacheKey)
    if (baselineCached && 'posts' in baselineCached) {
      return JSON.parse(JSON.stringify(baselineCached))
    }

    if (id) {
      return {
        id,
        title: `Post ${id}`,
        type: 'text',
        datetime: '',
        edited: false,
        views: '',
        comments: '',
        tags: [],
        text: '',
        content: '',
        reactions: [],
      }
    }

    return {
      posts: [],
      title: cfg.channel,
      description: '',
      descriptionHTML: '',
      avatar: '',
    }
  }

  const $ = cheerio.load(html, {}, false)

  if (id) {
    const post = await getPost($, null, cfg.channel, cfg.staticProxy, 0, cfg.reactionsEnabled)
    cache.set(cacheKey, post)
    return post
  }

  const postNodes = $('.tgme_channel_history  .tgme_widget_message_wrap')?.toArray() ?? []
  const parsedPosts = await Promise.all(postNodes.map((item, index) => getPost($, item, cfg.channel, cfg.staticProxy, index, cfg.reactionsEnabled)))

  const posts = parsedPosts
    .reverse()
    .filter(post => post.type === 'text' && post.id && post.content)

  const descriptionNode = await modifyHtmlContent($, $('.tgme_channel_info_description'), 0, cfg.staticProxy)

  let subscriberCount: string | undefined
  $('.tgme_channel_info_counter').each((_, el) => {
    const type = $(el).find('.counter_type').text().trim().toLowerCase()
    if (type === 'subscribers' || type === 'members') {
      subscriberCount = $(el).find('.counter_value').text().trim() || undefined
    }
  })

  const channelInfo: ChannelInfo = {
    posts,
    title: $('.tgme_channel_info_header_title')?.text() || cfg.channel,
    description: $('.tgme_channel_info_description')?.text() || '',
    descriptionHTML: sanitizeDescriptionHtml(descriptionNode?.html() || ''),
    avatar: $('.tgme_page_photo_image img')?.attr('src') || '',
    subscriberCount,
  }

  cache.set(cacheKey, channelInfo)
  return channelInfo
}
