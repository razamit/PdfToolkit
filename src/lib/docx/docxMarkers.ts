/**
 * Resolves CSS generated content — list bullets and numbers — into literal text
 * before the page is captured.
 *
 * docx-preview draws every list marker with a pseudo-element:
 *
 *   .docx-num-2-0::before { content: "" counter(docx-num-2-0) ".\9 ";
 *                           counter-increment: docx-num-2-0 1 }
 *
 * Two things about that survive the browser but not a DOM-to-image capture:
 *
 * 1. `counter-increment` sits on the **pseudo-element**, and the capture cannot
 *    reproduce pseudo-element counter state, so every item renders as "1." —
 *    a numbered list that reads 1, 1, 1 is not a cosmetic defect, it is wrong
 *    information in someone's document.
 * 2. `\9` is the CSS escape for a tab. The capture emits it literally, so
 *    bullets come out as "•\9" instead of "•".
 *
 * Rather than replace the markers with real elements — which would shift the
 * layout the whole route-2 approach exists to preserve — this resolves each
 * marker's text and pins it back onto the *same* pseudo-element through a
 * generated rule. Same box, same font, same spacing; only the content changes.
 */

const MARKER_ATTRIBUTE = 'data-docx-marker'

/** Scoped to the render host so the app's own pseudo-elements are untouched. */
const HOST_SELECTOR = '.docx-render-host'

export function flattenGeneratedContent(host: HTMLElement): void {
  const counters = new Map<string, number>()
  const rules: string[] = []
  let index = 0

  const walker = document.createTreeWalker(host, NodeFilter.SHOW_ELEMENT)
  let element = walker.currentNode as HTMLElement | null
  while (element) {
    // The element's own counter operations run before its pseudo-elements',
    // because ::before is a child box. This ordering is what makes nesting
    // work: a level-1 item carries `counter-set: <level-2 counter> 0`, so the
    // deeper counter must be zeroed here, before the ::before increments its
    // own. Reading only the pseudo-element — as this did originally — leaves
    // sub-counters running and a list numbers 1., 1.1., 1.2., 2., **2.3.**
    applyCounterStyles(getComputedStyle(element), counters)

    for (const pseudo of ['::before', '::after'] as const) {
      const style = getComputedStyle(element, pseudo)
      applyCounterStyles(style, counters)

      const resolved = resolveContent(style.content, counters)
      if (resolved !== null) {
        const id = String((index += 1))
        element.setAttribute(MARKER_ATTRIBUTE, id)
        rules.push(
          `${HOST_SELECTOR} [${MARKER_ATTRIBUTE}="${id}"]${pseudo}{content:${cssString(resolved)} !important;counter-increment:none !important}`,
        )
      }
    }
    element = walker.nextNode() as HTMLElement | null
  }

  if (rules.length === 0) return
  // Inside the host so it is discarded with it; a <style> applies document-wide
  // wherever it sits, which is why every selector above is host-scoped.
  const sheet = document.createElement('style')
  sheet.textContent = rules.join('\n')
  host.appendChild(sheet)
}

/**
 * Apply one style's counter properties in the order CSS defines: reset, then
 * increment, then set.
 *
 * `counter-set` is not an alias for `counter-reset` and must be read
 * separately — it is the property docx-preview actually uses to restart a
 * nested list level, so ignoring it breaks multi-level numbering while leaving
 * single-level lists looking perfect.
 */
function applyCounterStyles(style: CSSStyleDeclaration, counters: Map<string, number>): void {
  applyCounterOperations(style.counterReset, counters, 'reset')
  applyCounterOperations(style.counterIncrement, counters, 'increment')
  applyCounterOperations(style.counterSet, counters, 'set')
}

type CounterOperation = 'reset' | 'increment' | 'set'

/**
 * `counter-reset: a 0 b 3` / `counter-increment: a 1` / `counter-set: a 0`.
 * The value is optional and defaults to 1 for an increment, 0 otherwise.
 */
function applyCounterOperations(
  value: string,
  counters: Map<string, number>,
  operation: CounterOperation,
): void {
  if (!value || value === 'none') return
  const tokens = value.trim().split(/\s+/)
  for (let index = 0; index < tokens.length; index += 1) {
    const name = tokens[index]
    if (!/^[-\w]+$/.test(name) || /^-?\d+$/.test(name)) continue
    const next = tokens[index + 1]
    const explicit = next !== undefined && /^-?\d+$/.test(next)
    const amount = explicit ? Number(next) : operation === 'increment' ? 1 : 0
    if (explicit) index += 1
    counters.set(name, operation === 'increment' ? (counters.get(name) ?? 0) + amount : amount)
  }
}

/**
 * Turn a computed `content` value into the text it renders as, or `null` when
 * there is nothing to substitute. `none`/`normal` mean no pseudo-element box at
 * all — writing a rule for those would *create* one.
 */
function resolveContent(content: string, counters: Map<string, number>): string | null {
  if (!content || content === 'none' || content === 'normal') return null
  let out = ''
  let rest = content.trim()

  while (rest.length > 0) {
    const quoted = rest.match(/^"((?:[^"\\]|\\.)*)"/)
    if (quoted) {
      out += decodeCssEscapes(quoted[1])
      rest = rest.slice(quoted[0].length).trimStart()
      continue
    }
    const counter = rest.match(/^counters?\(\s*([-\w]+)\s*(?:,\s*("(?:[^"\\]|\\.)*"|[-\w]+)\s*)?(?:,\s*([-\w]+)\s*)?\)/)
    if (counter) {
      const style = counter[3] ?? (counter[2] && !counter[2].startsWith('"') ? counter[2] : 'decimal')
      out += formatCounter(counters.get(counter[1]) ?? 0, style)
      rest = rest.slice(counter[0].length).trimStart()
      continue
    }
    // An unsupported function (attr(), image-set(), url()) — leaving the
    // original content alone is safer than emitting a half-resolved string.
    return null
  }
  return out
}

/** CSS escapes are `\` + up to six hex digits with an optional trailing space. */
function decodeCssEscapes(value: string): string {
  return value.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex: string, literal: string) =>
    hex ? String.fromCodePoint(parseInt(hex, 16)) : literal,
  )
}

const UPPER_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
]

function formatCounter(value: number, style: string): string {
  switch (style) {
    case 'lower-alpha':
    case 'lower-latin':
      return alphabetic(value).toLowerCase()
    case 'upper-alpha':
    case 'upper-latin':
      return alphabetic(value)
    case 'lower-roman':
      return roman(value)
    case 'upper-roman':
      return roman(value).toUpperCase()
    case 'decimal-leading-zero':
      return value < 10 && value >= 0 ? `0${value}` : String(value)
    default:
      return String(value)
  }
}

function alphabetic(value: number): string {
  if (value < 1) return String(value)
  let result = ''
  let remaining = value
  while (remaining > 0) {
    remaining -= 1
    result = UPPER_ALPHA[remaining % 26] + result
    remaining = Math.floor(remaining / 26)
  }
  return result
}

function roman(value: number): string {
  if (value < 1 || value > 3999) return String(value)
  let remaining = value
  let result = ''
  for (const [amount, numeral] of ROMAN) {
    while (remaining >= amount) {
      result += numeral
      remaining -= amount
    }
  }
  return result
}

/**
 * Serialise as a CSS string. The tab that Word's numbering uses to separate a
 * marker from its text becomes a space: it already collapsed to one when the
 * browser rendered it, and the real gap comes from the item's hanging indent.
 */
function cssString(value: string): string {
  const printable = value.replace(/[\t\n\r]/g, ' ')
  return `"${printable.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
