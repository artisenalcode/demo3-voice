#!/usr/bin/env node
/**
 * Inject CSP hashes for inline <script> blocks into an nginx conf.
 *
 * Usage: node inject-csp-hashes.mjs <src-conf> <dest-conf> [dist-dir]
 *
 * Scans the built HTML (default ./dist) for inline <script> tags (those with no
 * src=), computes their sha256 hashes, and replaces the `__CSP_SCRIPT_HASHES__`
 * placeholder in the conf. Exits non-zero (failing the deploy) if the placeholder
 * is present but no inline scripts were found, so a parsing failure can never
 * silently ship a CSP that blocks the site's own scripts.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [srcConf, destConf, distDir = 'dist'] = process.argv.slice(2)
if (!srcConf || !destConf) {
  console.error('usage: inject-csp-hashes.mjs <src-conf> <dest-conf> [dist-dir]')
  process.exit(2)
}

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) out.push(...walk(p))
    else if (name.endsWith('.html')) out.push(p)
  }
  return out
}

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
const hashes = new Set()
for (const file of walk(distDir)) {
  const html = readFileSync(file, 'utf8')
  let m
  while ((m = INLINE_SCRIPT.exec(html)) !== null) {
    const body = m[1]
    if (body.trim() === '') continue
    const h = createHash('sha256').update(body, 'utf8').digest('base64')
    hashes.add(`'sha256-${h}'`)
  }
}

let conf = readFileSync(srcConf, 'utf8')
if (conf.includes('__CSP_SCRIPT_HASHES__')) {
  if (hashes.size === 0) {
    console.error(
      `ERROR: no inline scripts found in ${distDir}; refusing to ship a CSP that would block them`
    )
    process.exit(1)
  }
  conf = conf.split('__CSP_SCRIPT_HASHES__').join([...hashes].join(' '))
}
writeFileSync(destConf, conf)
console.log(`CSP: injected ${hashes.size} script hash(es) -> ${destConf}`)
for (const h of hashes) console.log('  ' + h)
