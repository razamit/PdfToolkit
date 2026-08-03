const CACHE_NAME = 'free-pdf-machine-2026-08-03-3'
const STATIC_URLS = [
  '/',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/fonts/LiberationSans-Regular.ttf',
  '/pdfjs-wasm/jbig2.wasm',
  '/pdfjs-wasm/jbig2_nowasm_fallback.js',
  '/pdfjs-wasm/openjpeg.wasm',
  '/pdfjs-wasm/openjpeg_nowasm_fallback.js',
  '/pdfjs-wasm/qcms_bg.wasm',
  '/pdfjs-wasm/quickjs-eval.js',
  '/pdfjs-wasm/quickjs-eval.wasm',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const urls = new Set(STATIC_URLS)
      try {
        const response = await fetch('/vite-manifest.json', { cache: 'no-store' })
        if (response.ok) {
          const manifest = await response.json()
          collectManifestUrls(manifest, urls)
          urls.add('/vite-manifest.json')
        }
      } catch {
        // The core shell is still cached if the manifest fetch is unavailable.
      }
      await cache.addAll([...urls])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.startsWith('free-pdf-machine-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/'))
    return
  }
  event.respondWith(cacheFirst(request))
})

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return (
      (await cache.match(request, { ignoreVary: true })) ||
      (await cache.match(fallbackUrl, { ignoreVary: true }))
    )
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request, { ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

function collectManifestUrls(manifest, urls) {
  for (const entry of Object.values(manifest)) {
    for (const value of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
      if (typeof value === 'string') urls.add(`/${value.replace(/^\//, '')}`)
    }
  }
}
