/**
 * Die RTL+-Verweise prüfen — was geht und was nicht.
 *
 * ## Was hier **nicht** herauskommt: die Sprache
 *
 * RTL+ liefert zu jeder Serienseite einen `TVSeries`-Block nach schema.org, und
 * der enthält Name, Beschreibung, Adresse und Bild — sonst nichts. Kein
 * `audio`, kein `inLanguage` zur Tonspur. Das einzige `inLanguage: "de"` auf
 * der Seite gehört zur **WebPage**, also zur Sprache der Seite selbst; bei
 * einem deutschen Dienst steht dort immer „de", auch über einem Video mit
 * Originalton. Als Beleg taugt es nicht (geprüft am 23.08.2026).
 *
 * Dass RTL+ ein deutscher Dienst ist und dort praktisch nur synchronisierte
 * Fassungen laufen, ist plausibel — aber plausibel ist kein Beleg, und diese
 * Seite verspricht ihren Besuchern Belege.
 *
 * ## Was herauskommt
 *
 * Ob der Verweis noch lebt, und ob er zum richtigen Titel führt. Der Name aus
 * dem `TVSeries`-Block wird mit unserem verglichen — so fallen Verweise auf,
 * die irgendwann auf etwas anderes zeigen.
 *
 * `robots.txt` erlaubt alles (`Allow: /`, geprüft am 23.08.2026); RTL+ bietet
 * sogar eigene Sitemaps an.
 *
 * Aufruf: node pipeline/check-rtlplus.mjs [--limit N] [--pause MS]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const zahl = (n, s) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : s
}
const LIMIT = zahl('--limit', 0)
const PAUSE = zahl('--pause', 800)

const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const liste = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))

const offen = []
for (const t of liste) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'rtlplus' || s.dub !== undefined) continue
    offen.push({ id: t.id, titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), url: s.url })
  }
}

/** Zwei Namen vergleichbar machen — Sonderzeichen und Groß/Klein weg. */
const kern = (x) => String(x ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const ZIEL = resolve(wurzel, 'data/rtlplus-befunde.json')
const bestand = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {}
const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen
let tot = 0
let fremd = 0
let ohneNamen = 0
let ok = 0

for (const [i, v] of arbeit.entries()) {
  let befund
  try {
    const antwort = await fetch(v.url, { redirect: 'follow' })
    if (!antwort.ok) {
      befund = { status: antwort.status, lebt: false }
      tot++
    } else {
      const html = await antwort.text()
      let name = null
      for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
        try {
          const j = JSON.parse(m[1])
          if (j['@type'] === 'TVSeries' || j['@type'] === 'Movie') name = j.name ?? name
        } catch {
          /* Ein kaputter Block ist kein Grund, den ganzen Abruf zu verwerfen. */
        }
      }
      const a = kern(name)
      const b = kern(v.titel)
      const passt = Boolean(a && b && (a.includes(b) || b.includes(a)))
      befund = { status: 200, lebt: true, seitenTitel: name, passt, endAdresse: antwort.url }
      // Ohne Namen ist die Seite weder bestätigt noch widerlegt — das ist eine
      // eigene Gruppe, keine stille Zustimmung.
      if (!name) ohneNamen++
      else if (!passt) fremd++
      else ok++
    }
  } catch (err) {
    console.log(`  ${i + 1}/${arbeit.length} ? ${v.titel.slice(0, 34)} — ${err.message}`)
    continue
  }
  bestand[v.url] = { ...befund, anilistId: v.id, geprueftAm: new Date().toISOString().slice(0, 10) }
  const zeichen = !befund.lebt ? '✕' : befund.passt ? '·' : '≠'
  console.log(`  ${i + 1}/${arbeit.length} ${zeichen} ${v.titel.slice(0, 36).padEnd(38)} ${befund.seitenTitel ?? ''}`)
  await new Promise((r) => setTimeout(r, PAUSE))
}

writeFileSync(ZIEL, JSON.stringify(bestand, null, 1) + '\n')
console.log('')
console.log(
  `${arbeit.length} Verweise geprüft: ${tot} tot, ${fremd} führen woandershin, ` +
    `${ohneNamen} ohne Titelangabe, ${ok} bestätigt`,
)
console.log('Die Sprache sagt RTL+ nicht — siehe Kommentar oben.')
