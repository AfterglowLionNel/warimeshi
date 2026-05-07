// バージョンを bump すると activate イベントで古い cache が一掃される。
// デザインリプレースなど大きな UI 変更時に必ず番号を上げること。
const CACHE_NAME = "warimeshi-v4-auth-cache"
const STATIC_ASSETS = ["/offline.html"]
const NETWORK_ONLY_PREFIXES = ["/api/", "/auth", "/group", "/settings"]

function isNetworkOnlyPath(pathname) {
  return NETWORK_ONLY_PREFIXES.some((prefix) => {
    if (prefix.endsWith("/")) return pathname.startsWith(prefix)
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  })
}

function isNextRouterRequest(request, url) {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    url.searchParams.has("_rsc")
  )
}

function shouldCacheResponse(response) {
  const cacheControl = response.headers.get("cache-control") || ""
  return response.ok && !cacheControl.includes("no-store") && !cacheControl.includes("private")
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") return

  // Never cache cross-origin responses or Next.js router payloads.
  if (url.origin !== self.location.origin) return

  // Skip SSE connections
  if (url.pathname.includes("/events")) return

  // Auth-sensitive pages/API and RSC payloads must be network-only.
  if (isNetworkOnlyPath(url.pathname) || isNextRouterRequest(request, url)) {
    event.respondWith(fetch(request))
    return
  }

  // Static assets (_next/static): cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (shouldCacheResponse(response)) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // HTML pages: network-first with offline fallback
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    )
    return
  }

  // Other assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (shouldCacheResponse(response)) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      return cached || fetchPromise
    })
  )
})
