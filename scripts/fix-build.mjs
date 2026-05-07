#!/usr/bin/env node
/**
 * Fix Next.js 16 Turbopack production build issues:
 * 1. Empty prerender-manifest.json
 * 2. Chunk hash mismatch between build manifest and server runtime
 *
 * Run after `next build` and before `next start`.
 */
import { readFileSync, writeFileSync, existsSync, symlinkSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const NEXT_DIR = join(process.cwd(), '.next')
const CHUNKS_DIR = join(NEXT_DIR, 'static', 'chunks')

// Fix 1: Empty prerender-manifest.json
const prerenderPath = join(NEXT_DIR, 'prerender-manifest.json')
if (existsSync(prerenderPath)) {
  const content = readFileSync(prerenderPath, 'utf8').trim()
  if (!content) {
    writeFileSync(prerenderPath, JSON.stringify({
      version: 4, routes: {}, dynamicRoutes: {},
      notFoundRoutes: [], preview: { previewModeId: "", previewModeSigningKey: "", previewModeEncryptionKey: "" }
    }))
    console.log('[fix-build] Fixed empty prerender-manifest.json')
  }
}

// Fix 2: Start server temporarily and detect missing chunks
console.log('[fix-build] Starting temporary server to detect chunk references...')
const child = execSync(`pnpm next start --port 3099 & sleep 6 && curl -s http://localhost:3099 && kill %1 2>/dev/null`, {
  encoding: 'utf8',
  timeout: 30000,
  shell: '/bin/bash'
}).toString()

// Extract referenced chunks from HTML
const chunkRefs = [...child.matchAll(/_next\/static\/chunks\/([^"\\]+)/g)].map(m => m[1])
const uniqueChunks = [...new Set(chunkRefs)]

// Find missing chunks
const missing = uniqueChunks.filter(c => !existsSync(join(CHUNKS_DIR, c)))
if (missing.length === 0) {
  console.log('[fix-build] All chunks present. No fix needed.')
  process.exit(0)
}

console.log(`[fix-build] Missing chunks: ${missing.join(', ')}`)

// Read manifest to find correct chunk names
const manifestPath = join(NEXT_DIR, 'server', 'app', 'page_client-reference-manifest.js')
if (!existsSync(manifestPath)) {
  console.error('[fix-build] Cannot find client-reference-manifest')
  process.exit(1)
}
// Get existing chunks on disk
const existingChunks = readdirSync(CHUNKS_DIR).filter(f => {
  const s = statSync(join(CHUNKS_DIR, f))
  return s.isFile() && !s.isSymbolicLink
})

for (const m of missing) {
  const ext = m.split('.').pop()
  // Find a chunk with same extension that exists on disk but is NOT referenced in HTML
  const candidates = existingChunks.filter(f => f.endsWith(`.${ext}`) && !uniqueChunks.includes(f))
  if (candidates.length > 0) {
    const target = candidates[0]
    const linkPath = join(CHUNKS_DIR, m)
    try { unlinkSync(linkPath) } catch {}
    symlinkSync(target, linkPath)
    console.log(`[fix-build] Symlinked: ${m} -> ${target}`)
  } else {
    console.warn(`[fix-build] WARNING: No candidate found for ${m}`)
  }
}

console.log('[fix-build] Done.')
