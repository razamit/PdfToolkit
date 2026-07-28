import { createRequire } from 'node:module'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { PDFJS_WASM_BASE } from '../src/lib/pdfjsAssetPaths.ts'

const require = createRequire(import.meta.url)

/** `pdfjs-dist/wasm/`, resolved through node so hoisting layout never matters. */
function wasmSourceDir(): string {
  return path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'wasm')
}

const CONTENT_TYPES: Record<string, string> = {
  '.wasm': 'application/wasm',
  '.js': 'text/javascript; charset=utf-8',
}

/**
 * Serves pdf.js's image-decoder assets at a stable, unhashed path.
 *
 * pdf.js 5+ moved JBIG2, CCITT Group 4 and JPEG 2000 decoding out of JavaScript
 * and into WebAssembly modules that it fetches at runtime from the `wasmUrl`
 * API option. Those are exactly the encodings scanners emit, so without them a
 * scanned PDF opens fine and then renders as a blank page — pdf.js only warns
 * ("Dependent image isn't ready yet") and draws nothing.
 *
 * The files are copied straight out of `node_modules` rather than committed
 * into `public/`, so they can never drift from the pinned `pdfjs-dist` version.
 * They cost nothing until they are needed: pdf.js fetches a decoder only when a
 * document actually contains that encoding, so the entry chunk is unaffected.
 */
export function pdfjsWasmPlugin(): Plugin {
  const sourceDir = wasmSourceDir()

  return {
    name: 'pdfjs-wasm-assets',

    // Dev: stream them out of node_modules. Nothing to copy, nothing to stale.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith(PDFJS_WASM_BASE)) return next()
        // basename() confines the read to the decoder directory.
        const name = path.basename(url)
        readFile(path.join(sourceDir, name))
          .then((body) => {
            res.setHeader('Content-Type', CONTENT_TYPES[path.extname(name)] ?? 'text/plain')
            res.end(body)
          })
          .catch(() => next())
      })
    },

    // Build: emit under fixed names, since pdf.js cannot be told a hashed one.
    async generateBundle() {
      const dir = PDFJS_WASM_BASE.replace(/^\/|\/$/g, '')
      for (const name of await readdir(sourceDir)) {
        this.emitFile({
          type: 'asset',
          fileName: `${dir}/${name}`,
          source: await readFile(path.join(sourceDir, name)),
        })
      }
    },
  }
}
