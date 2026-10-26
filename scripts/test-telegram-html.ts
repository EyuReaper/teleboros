import assert from 'node:assert/strict'
import { sanitizeTelegramHtml } from '../src/lib/telegram-html'

const malformedItalic = sanitizeTelegramHtml('Read <i>this article.')
assert.equal(malformedItalic, 'Read <i>this article.</i>')

const validFormatting = sanitizeTelegramHtml('<b>Headline</b> and <code>code</code>')
assert.equal(validFormatting, '<b>Headline</b> and <code>code</code>')

const unsafeLink = sanitizeTelegramHtml('<a href="javascript:alert(1)">Read</a>')
assert.equal(unsafeLink, '<a>Read</a>')

console.info('Telegram HTML regression checks passed.')
