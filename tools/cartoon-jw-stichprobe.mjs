/**
 * Die Stichprobe 50 + 50 für die JustWatch-Vertrauensregel bei Cartoons (Auftrag 11.10.2026).
 *
 * Für Anime gilt „Deutsch laut JustWatch“ als vertrauenswürdig (Prime, 99,4 % bei n = 468); für Cartoons
 * fehlt die Messung, weil kaum ein Cartoon-Weg einen Beleg trägt (4 von 901). Daniel prüft deshalb zwei Gruppen
 * von Cartoon-Wegen (Titel × Anbieter) mit der Erweiterung, ohne vorher zu sehen, was JustWatch sagt:
 *
 *   jw-deutsch        JustWatch nennt für den Anbieter einen Flatrate-Weg mit deutscher Tonspur (50)
 *   jw-ohne-deutsch   JustWatch nennt keine deutsche Tonspur: Ton ohne Deutsch, Ton leer oder kein Angebot (50)
 *
 * Auswahl deterministisch: je Weg ein Schlüssel `sha256(SEED|Kennung|Anbieter)`; je Gruppe und Anbieter
 * zählen die niedrigsten Schlüssel (Quoten unten). Wer neu in den Bestand kommt, mischt die übrigen nicht um.
 * Ausgeschlossen: Wege mit Urteil (`dub` gesetzt) und Wege ohne Adresse, die eine Prüfliste öffnen kann;
 * eine Adresse zählt einmal. Netflix fehlt in `jw-deutsch`, weil JustWatch dort nie einen Ton nennt (Messung 11.10.2026).
 *
 * Das Ergebnis liegt eingefroren in `data/cartoon-jw-stichprobe.json` (die Prüfliste liest nur diese Datei).
 * Neu schreiben: node tools/cartoon-jw-stichprobe.mjs --schreiben
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { todayIso } from '../shared/time.ts'

const WURZEL = resolve(import.meta.dirname, '..')

export const SEED = 'cartoon-jw-stichprobe-2026-10-11'
export const ZIEL = 'data/cartoon-jw-stichprobe.json'

/** Wie viele Wege je Gruppe und Anbieter; die Summe je Gruppe ist 50. */
export const QUOTEN = {
  'jw-deutsch': { disneyplus: 25, primevideo: 25 },
  'jw-ohne-deutsch': { netflix: 20, disneyplus: 15, primevideo: 15 },
}

const ANBIETER = Object.keys(QUOTEN['jw-ohne-deutsch'])

/** JustWatchs Namen der Abo-Angebote je Anbieter; Kanäle und Stores zählen nicht (wie `jwTonAnbieter`). */
const JW_NAME = { netflix: /^Netflix/, primevideo: /^Amazon Prime Video/, disneyplus: /^Disney Plus/ }

/** Adressformen, die eine Prüfliste öffnen kann (wie `kennung()` in `extension-offene-*.mjs`). */
const LISTENFAEHIG = {
  netflix: /\/(?:title|watch)\/\d+/,
  primevideo: /\/(?:dp|detail)\/(?:[A-Z0-9]{10,32}|amzn1\.dv\.gti\.[a-z0-9-]+)|[?&]gti=amzn1\.dv\.gti\./i,
  disneyplus: /\/browse\/entity-[0-9a-f-]{8,}|\/(?:series|movies)\/[^/]+\/[A-Za-z0-9]{6,}/i,
}

/** Was JustWatch zum Anbieter sagt: `urteil` ordnet in die Gruppe, `text` steht in der Liste. */
export function jwAussage(angebote, plattform) {
  const eigene = (angebote ?? []).filter((a) => a.art === 'FLATRATE' && JW_NAME[plattform].test(a.anbieter ?? ''))
  if (!eigene.length) return { urteil: 'kein-angebot', text: 'kein Abo-Angebot bei diesem Anbieter' }
  if (eigene.some((a) => a.audio?.includes('de'))) return { urteil: 'deutsch', text: 'Ton: Deutsch' }
  const sprachen = [...new Set(eigene.flatMap((a) => a.audio ?? []))]
  if (sprachen.length) return { urteil: 'ton-ohne-deutsch', text: `Ton ohne Deutsch (${sprachen.join(', ')})` }
  return { urteil: 'ton-leer', text: 'Angebot ohne Tonangabe' }
}

const schluessel = (id, plattform, seed) => createHash('sha256').update(`${seed}|${id}|${plattform}`).digest('hex')

/** Alle Wege, die in Frage kommen — jeder mit seiner Gruppe und dem Auswahlschlüssel. */
export function kandidaten(cartoons, jw, seed = SEED) {
  const raus = []
  for (const t of cartoons) {
    for (const s of t.streams ?? []) {
      if (!ANBIETER.includes(s.platform) || s.dub !== undefined) continue
      if (!s.url || !LISTENFAEHIG[s.platform].test(s.url)) continue
      const aussage = jwAussage(jw[String(t.id)]?.angebote, s.platform)
      const richtung = aussage.urteil === 'deutsch' ? 'jw-deutsch' : 'jw-ohne-deutsch'
      raus.push({ id: t.id, titel: t.titleEn ?? t.titleDe ?? String(t.id), plattform: s.platform, url: s.url, richtung, jw: aussage, sort: schluessel(t.id, s.platform, seed) })
    }
  }
  return raus
}

/** Je Gruppe die ersten `n` nach Schlüssel; fehlt es einem Anbieter an Wegen, füllen die übrigen der Gruppe auf. */
function ziehe(sortiert, richtung, quoten) {
  const frei = sortiert.filter((k) => k.richtung === richtung)
  const ziel = Object.values(quoten).reduce((a, b) => a + b, 0)
  const gewaehlt = Object.entries(quoten).flatMap(([plattform, n]) => frei.filter((k) => k.plattform === plattform).slice(0, n))
  const rest = frei.filter((k) => !gewaehlt.includes(k))
  return [...gewaehlt, ...rest.slice(0, ziel - gewaehlt.length)]
}

/** Die Stichprobe: je Gruppe genau die Summe der Quoten, jede Adresse und jeder Weg einmal, stabil sortiert. */
export function waehleStichprobe(kandidatenListe, quoten = QUOTEN) {
  const sortiert = [...kandidatenListe].sort((a, b) => (a.sort < b.sort ? -1 : 1))
  const gesehen = new Set()
  const eindeutig = sortiert.filter((k) => {
    const adresse = `${k.plattform}|${k.url}`
    if (gesehen.has(adresse)) return false
    gesehen.add(adresse)
    return true
  })
  return Object.keys(quoten).flatMap((richtung) => ziehe(eindeutig, richtung, quoten[richtung])).map(({ sort, ...rest }) => rest)
}

function ladeJson(datei) {
  const roh = JSON.parse(readFileSync(resolve(WURZEL, datei), 'utf8'))
  return Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))
}

/** Die Quellen der Auswahl: Cartoons und JustWatch-Tonangaben aus den Live-Dateien. */
export function ladeBestand() {
  return { cartoons: ladeJson('public/data/cartoons.json'), jw: JSON.parse(readFileSync(resolve(WURZEL, 'data/justwatch-audio.json'), 'utf8')) }
}

/** Der Inhalt der eingefrorenen Datei, gerechnet aus dem heutigen Bestand. */
export function stichprobeDatei(heute = todayIso()) {
  const { cartoons, jw } = ladeBestand()
  return { seed: SEED, erzeugt: heute, quoten: QUOTEN, eintraege: waehleStichprobe(kandidaten(cartoons, jw)) }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename) && process.argv.includes('--schreiben')) {
  const datei = stichprobeDatei()
  writeFileSync(resolve(WURZEL, ZIEL), `${JSON.stringify(datei, null, 1)}\n`)
  console.log(`${datei.eintraege.length} Wege nach ${ZIEL}`)
}
