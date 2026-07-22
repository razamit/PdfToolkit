import bidiFactory from 'bidi-js'
import type { BaseDirection } from './annotationText'

/**
 * Splits one line of annotation text into directional runs ordered for
 * left-to-right drawing (UAX#9). Each run keeps its characters in logical
 * order: fontkit reverses Hebrew runs into visual order itself when pdf-lib
 * lays them out, so drawing the runs sequentially reproduces what the
 * browser's bidi rendering shows in the editor.
 */

const bidi = bidiFactory()

/** Chars fontkit's script detection treats as Hebrew (it auto-reverses such runs). */
const HEBREW_PATTERN = /[\u0590-\u05ff]/

interface DirectionalRun {
  level: number
  text: string
}

export function splitLineIntoVisualRuns(line: string, baseDirection: BaseDirection): string[] {
  if (line === '') return []
  const { levels } = bidi.getEmbeddingLevels(line, baseDirection)
  const mirrored = bidi.getMirroredCharactersMap(line, levels)
  const runs = extractLevelRuns(line, levels, mirrored)
  reorderRunsVisually(runs)
  return runs.map(runTextForDrawing)
}

/** Group contiguous characters of equal embedding level, applying bracket mirroring (rule L4). */
function extractLevelRuns(
  line: string,
  levels: Uint8Array,
  mirrored: Map<number, string>,
): DirectionalRun[] {
  const runs: DirectionalRun[] = []
  for (let index = 0; index < line.length; ) {
    const level = levels[index]
    let text = ''
    while (index < line.length && levels[index] === level) {
      text += mirrored.get(index) ?? line[index]
      index += 1
    }
    runs.push({ level, text })
  }
  return runs
}

/** UAX#9 rule L2 at run granularity: reverse run sequences from the deepest level down. */
function reorderRunsVisually(runs: DirectionalRun[]): void {
  const maxLevel = runs.reduce((max, run) => Math.max(max, run.level), 0)
  for (let level = maxLevel; level >= 1; level -= 1) {
    for (let start = 0; start < runs.length; start += 1) {
      if (runs[start].level < level) continue
      let end = start
      while (end + 1 < runs.length && runs[end + 1].level >= level) end += 1
      const reversed = runs.slice(start, end + 1).reverse()
      runs.splice(start, reversed.length, ...reversed)
      start = end
    }
  }
}

/**
 * fontkit only auto-reverses runs it can detect as Hebrew. A right-to-left
 * run made of neutrals alone (e.g. " ₪") must be pre-reversed here; that is
 * safe because such runs contain no shaping-sensitive characters.
 */
function runTextForDrawing(run: DirectionalRun): string {
  const isRightToLeft = (run.level & 1) === 1
  if (!isRightToLeft || HEBREW_PATTERN.test(run.text)) return run.text
  return [...run.text].reverse().join('')
}
