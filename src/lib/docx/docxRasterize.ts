/**
 * Captures one rendered page element as PNG bytes.
 *
 * `snapdom` rather than html2canvas: html2canvas reimplements CSS painting and
 * has known gaps on grid/flex, pseudo-elements and web fonts, whereas snapdom
 * serialises the subtree into an SVG `foreignObject` and lets the browser paint
 * it — so what lands in the PNG is the browser's own rendering rather than a
 * second engine's approximation of it. It also has no dependencies.
 */

/**
 * Capture scale. 2× of the 96 DPI CSS box gives ~192 DPI, which keeps 9–11pt
 * body text crisp when a reader zooms in without quadrupling the file size the
 * way 3× would. This is the direct cost of route 2 and the number to revisit if
 * output size or sharpness is ever the complaint.
 */
export const RASTER_SCALE = 2

export interface RasterizedPage {
  bytes: Uint8Array
  widthPx: number
  heightPx: number
}

export async function rasterizePage(page: HTMLElement): Promise<RasterizedPage> {
  const { snapdom } = await import('@zumer/snapdom')
  const canvas = await snapdom.toCanvas(page, {
    scale: RASTER_SCALE,
    // The page element's own background is white in Word's model, but a
    // transparent capture would composite against whatever is behind it in the
    // PDF viewer — explicit white keeps it stable.
    backgroundColor: '#ffffff',
    // Fonts are already loaded and awaited by `loadDocxSubstituteFonts`;
    // embedding them again into the capture would inline megabytes per page.
    embedFonts: false,
  })
  return {
    bytes: await canvasToPngBytes(canvas),
    widthPx: canvas.width,
    heightPx: canvas.height,
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('A converted page could not be encoded.'))
        return
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject)
    }, 'image/png')
  })
}
