import type { AnnotationPlacement, PageSizeMode, SourceKind } from '@/domain/types'
import type { ExportScope } from '@/coordinator/toolkitContext'

/**
 * Every event this app reports, with its properties.
 *
 * Properties are drawn from existing domain types (`SourceKind`, `PageSizeMode`,
 * `AnnotationPlacement['kind']`) rather than restated as string literals, so a new
 * annotation tool or page-size preset cannot be added without this union following.
 *
 * Note what is absent: no filenames, no annotation text, no image data, no page
 * dimensions. Only counts and closed sets of enum values ever leave the browser.
 */
export type ToolkitAnalyticsEvent =
  | { name: 'file-added'; kind: SourceKind; pageCount: number }
  | { name: 'pages-removed'; count: number }
  | { name: 'pages-rotated'; count: number }
  | { name: 'pages-resized'; preset: PageSizeMode }
  | { name: 'pages-reordered' }
  | { name: 'signature-added'; reused: boolean }
  | { name: 'annotation-added'; kind: AnnotationPlacement['kind'] }
  | { name: 'pdf-exported'; scope: ExportScope; pageCount: number }
