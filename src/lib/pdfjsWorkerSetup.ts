/**
 * pdf.js worker wiring for Vite.
 *
 * This module MUST be imported exactly once, before any `getDocument` call, so
 * that `GlobalWorkerOptions.workerSrc` is assigned before pdf.js spins up a
 * worker. `pdfjs-dist` is pinned to an exact version so the bundled worker and
 * the API never drift (a mismatch throws at runtime).
 *
 * Importing the worker with the `?url` suffix lets Vite fingerprint and serve
 * it as a static asset in both dev and production builds.
 */
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }
