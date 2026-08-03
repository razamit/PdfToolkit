import type { ExportDecorations } from '@/domain/types'

export const DEFAULT_EXPORT_DECORATIONS: ExportDecorations = {
  pageNumbers: {
    enabled: false,
    format: 'number',
    startAt: 1,
    position: 'bottom-center',
    fontSizePt: 10,
    colorHex: '#27272a',
  },
  watermark: {
    enabled: false,
    text: '',
    fontSizePt: 42,
    colorHex: '#52525b',
    opacity: 0.18,
  },
}
