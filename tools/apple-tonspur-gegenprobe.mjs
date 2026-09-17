/**
 * **Gegenprobe zu den Film-Belegen aus JustWatch** (17.09.2026)
 *
 * Seit heute macht der Bau aus JustWatchs Tonspur je Angebot ein „DE ✓" am Bezugsweg —
 * aber nur bei Filmen, wo die Angabe genau eine Einheit beschreibt. 664 Wege in 269
 * Filmen hängen daran, und keiner davon ist bisher an der Quelle nachgesehen worden.
 *
 * Apple TV nennt die Tonspuren im gelieferten HTML im Klartext („Deutsch (AAC, Dolby
 * 5.1), Japanisch"), ohne Anmeldung und ohne Browser. Das sind 200 der 664 Wege — genug
 * für eine belastbare Quote. maxdome, MagentaTV und Rakuten laden ihre Angaben per
 * JavaScript nach; sie brauchen den Browser und stehen hier nicht drin.
 *
 * Gemeldet wird beides: Wo Apple Deutsch führt, hält der Beleg. Wo Apple eine Sprachliste
 * **ohne** Deutsch zeigt, widerspricht die Quelle — und das ist ein Befund, kein Rauschen.
 *
 * Aufruf: node tools/apple-tonspur-gegenprobe.mjs [anzahl]
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANZAHL = Number(process.argv[2] ?? 30)

const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titles = Array.isArray(roh) ? roh : roh.titles

const faelle = []
for (const t of titles) {
  if (t.format !== 'MOVIE') continue
  for (const w of t.watchLinks ?? []) {
    if (!/^Apple TV/i.test(w.name ?? '')) continue
    if (!w.dubRanges?.some((r) => r.dub)) continue
    faelle.push({ id: t.id, titel: t.titleDe ?? t.titleEn ?? String(t.id), url: w.url })
  }
}

/* Gleichmäßig über den Bestand statt die ersten N — sonst misst man eine Ecke. */
const schritt = Math.max(1, Math.floor(faelle.length / ANZAHL))
const proben = faelle.filter((_, i) => i % schritt === 0).slice(0, ANZAHL)
console.log(`${faelle.length} Apple-TV-Belege, ${proben.length} werden geprüft.\n`)

/**
 * Die Tonspur-Zeile der Seite: „Deutsch (Deutschland) (AAC), Japanisch (Japan) (AAC)".
 *
 * Apple rendert sie serverseitig zwischen Svelte-Platzhaltern, und **zwischen `START` und
 * `-->` steht ein Leerzeichen** — ohne das im Muster findet der Lauf nichts und meldet
 * zwölfmal „keine Sprachliste" (erster Versuch, 17.09.2026).
 */
const SPRACHEN = /HTML_TAG_START\s*-->([^<]{2,200})<!--\s*HTML_TAG/g
/** Was eine Tonspur-Angabe von einer Beschreibung unterscheidet. */
const TONSPUR = /\b(AAC|Dolby|DTS|Stereo|5\.1|Atmos)\b/

let ja = 0
let nein = 0
let unklar = 0
for (const p of proben) {
  let text = ''
  try {
    const antwort = await fetch(p.url.split('?')[0], {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
        'Accept-Language': 'de-DE',
      },
    })
    if (!antwort.ok) {
      console.log(`  ?  ${p.id} ${p.titel.slice(0, 40)} — HTTP ${antwort.status}`)
      unklar++
      continue
    }
    text = await antwort.text()
  } catch (e) {
    console.log(`  ?  ${p.id} ${p.titel.slice(0, 40)} — ${String(e).slice(0, 60)}`)
    unklar++
    continue
  }
  const zeilen = [...text.matchAll(SPRACHEN)].map((m) => m[1].trim())
  /* Die Tonspur-Zeile ist die einzige, die ein Tonformat nennt — sonst trifft man den Klappentext. */
  const ton = zeilen.find((z) => TONSPUR.test(z))
  if (!ton) {
    console.log(`  ?  ${p.id} ${p.titel.slice(0, 40)} — keine Sprachliste gefunden`)
    unklar++
    continue
  }
  if (/Deutsch/i.test(ton)) {
    ja++
  } else {
    nein++
    console.log(`  ✕  ${p.id} ${p.titel.slice(0, 40)} — Apple nennt: ${ton.slice(0, 70)}`)
  }
  await new Promise((r) => setTimeout(r, 400))
}

console.log(`\nbestätigt ${ja} · widersprochen ${nein} · ohne Auskunft ${unklar}`)
if (nein) console.log('Jeder Widerspruch gehört einzeln angesehen, bevor die Regel bleibt.')
