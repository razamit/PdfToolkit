/**
 * Public URL prefix for pdf.js's runtime decoder assets.
 *
 * pdf.js builds these URLs by plain string concatenation (`${wasmUrl}jbig2.wasm`),
 * so the served filenames must match the names inside `pdfjs-dist/wasm/` exactly
 * — they cannot be content-hashed like the rest of the bundle. The trailing
 * slash is part of the contract.
 *
 * Deliberately dependency-free: `vite/pdfjsWasmPlugin.ts` imports this same
 * constant to decide where to serve and emit those files, so the build and the
 * runtime can never disagree about the path.
 */
export const PDFJS_WASM_BASE = '/pdfjs-wasm/'
