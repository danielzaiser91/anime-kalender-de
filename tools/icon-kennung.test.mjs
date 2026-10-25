/** Icon-Adressen tragen `?v=<Inhalts-Hash>`: Funktion, Vite-Plugin und Wächter (`iconMaengel`) an Wegwerf-Ordnern. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { iconKennung, iconKennungen, iconMaengel, iconSeitenMaengel, versioniereIcons } from './icon-kennung.mjs'

const wurzel = mkdtempSync(join(tmpdir(), 'icon-kennung-'))
const pub = join(wurzel, 'public')
mkdirSync(join(pub, 'icons'), { recursive: true })
writeFileSync(join(pub, 'icons', 'icon.svg'), '<svg>alt</svg>')
writeFileSync(join(pub, 'icons', 'favicon-32.png'), 'png32')
writeFileSync(join(pub, 'icons', 'apple-touch-icon.png'), 'apfel')
writeFileSync(join(pub, 'icons', 'icon-192.png'), 'png192')

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8)
const html = `<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta property="og:image" content="https://anime-kalender.de/og/default.jpg" />
<img src="/icons/fehlt.png" />`
const neu = versioniereIcons(html, pub)

assert.equal(iconKennung(join(pub, 'icons', 'icon.svg')), hash('<svg>alt</svg>'))
assert.ok(neu.includes(`"/icons/icon.svg?v=${hash('<svg>alt</svg>')}"`))
assert.ok(neu.includes(`"/icons/favicon-32.png?v=${hash('png32')}"`))
assert.ok(neu.includes(`"/icons/apple-touch-icon.png?v=${hash('apfel')}"`))
assert.ok(neu.includes('"/icons/fehlt.png"'), 'Adresse ohne Datei bleibt unverändert')
assert.ok(neu.includes('og/default.jpg"'), 'Fremde Adressen bleiben unberührt')
assert.equal(versioniereIcons(neu, pub), neu, 'zweiter Lauf ändert nichts')
console.log('  ✓ Hash je Datei aus dem Inhalt, stabil im zweiten Lauf')

assert.deepEqual(iconMaengel(neu, pub, 'x'), [])
assert.equal(iconMaengel(html, pub, 'x').length, 3, 'alter Stand ohne ?v= ist rot')
assert.equal(iconMaengel(neu.replace(`icon.svg?v=${hash('<svg>alt</svg>')}`, 'icon.svg?v=00000000'), pub, 'x').length, 1, 'falscher Hash ist rot')
writeFileSync(join(pub, 'icons', 'icon.svg'), '<svg>neu</svg>')
assert.equal(iconMaengel(neu, pub, 'x').length, 1, 'geänderte Datei macht die alte Adresse rot')
assert.ok(versioniereIcons(neu, pub).includes(`icon.svg?v=${hash('<svg>neu</svg>')}`), 'Adresse ändert sich mit dem Inhalt')
assert.ok(versioniereIcons(neu, pub).includes(`favicon-32.png?v=${hash('png32')}`), 'andere Datei bleibt gleich')
console.log('  ✓ Wächter: ohne ?v=, falscher Hash, geänderte Datei rot')

const dist = join(wurzel, 'dist')
mkdirSync(dist)
const manifest = JSON.stringify({ icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }], shortcuts: [{ icons: [{ src: '/icons/icon-192.png' }] }] })
writeFileSync(join(dist, 'manifest.webmanifest'), manifest)
writeFileSync(join(dist, '404.html'), '<link rel="icon" href="/icons/icon.svg" />')
const plugin = iconKennungen(pub)
plugin.configResolved({ root: wurzel, build: { outDir: 'dist' } })
assert.ok(plugin.transformIndexHtml(html).includes('favicon-32.png?v='))
plugin.closeBundle()
const m = readFileSync(join(dist, 'manifest.webmanifest'), 'utf8')
assert.equal(m.split(`icon-192.png?v=${hash('png192')}`).length, 3, 'beide Manifest-Stellen')
assert.deepEqual(iconMaengel(m, pub, 'm'), [])
assert.ok(readFileSync(join(dist, '404.html'), 'utf8').includes('icon.svg?v='))
console.log('  ✓ Plugin: index.html, Manifest (alle Stellen), 404.html')
const dist2 = join(wurzel, 'dist2')
mkdirSync(join(dist2, 'icons'), { recursive: true })
writeFileSync(join(dist2, 'icons', 'icon.svg'), 'svg2')
writeFileSync(join(dist2, 'gut.html'), `<link href="/icons/icon.svg?v=${hash('svg2')}">`)
writeFileSync(join(dist2, 'alt.html'), '<link href="/icons/icon.svg">')
writeFileSync(join(dist2, 'css.html'), `<style>a{background:url(/icons/icon.svg?v=${hash('svg2')})}</style>`)
assert.deepEqual(iconSeitenMaengel(dist2, ['gut.html']), [])
assert.equal(iconSeitenMaengel(dist2, ['gut.html', 'alt.html']).length, 1, 'Seite ohne ?v= wird gemeldet')
assert.equal(iconSeitenMaengel(dist2, ['gut.html', 'weg.html']).length, 1, 'fehlende Seite ist ein Mangel')
assert.equal(iconSeitenMaengel(dist2, ['css.html']).length, 1, 'unbekannte Schreibweise (url()) ist ein Mangel, nicht übersehen')
console.log('  ✓ Seitenliste: fehlende Datei, ohne ?v=, url()-Schreibweise rot')
console.log('icon-kennung.test: alle Fälle grün')
