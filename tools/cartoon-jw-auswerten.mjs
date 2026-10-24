/**
 * Wertet die Stichprobe 50 + 50 aus (`data/cartoon-jw-stichprobe.json`, Auswahl in `cartoon-jw-stichprobe.mjs`):
 * Wie oft stimmt JustWatch bei Cartoon-Wegen — je Anbieter und Richtung?
 *
 * Eingabe sind Daniels Meldungen aus der Erweiterung, so wie `pipeline/fetch-urteile.ts` sie vom Worker holt
 * (`/pruefung?alle=1`, Feld `pruefungen`): `plattform`, `url`, `titel_id`, `ton_de` (`ja`/`nein`/`unbekannt`) und
 * `vorhanden`, ältere nur `befund` (`dub`/`kein_dub`/`weg`). Einer Meldung gehört der Weg, dessen Kennung (Titel × Anbieter)
 * oder dessen Adresskennung sie trägt. Je Weg gilt: irgendeine Folge mit deutschem Ton → deutsch (so meint es JustWatch
 * auch: „irgendwo in der Serie“), sonst eine Folge ohne → kein Deutsch, sonst offen oder nicht verfügbar.
 *
 * Richtig heißt: Gruppe `jw-deutsch` und der Weg ist deutsch, Gruppe `jw-ohne-deutsch` und er ist es nicht. Offene und
 * nicht verfügbare Wege zählen nicht (wie bei der Anime-Messung, Bericht 11.10.2026). Schwelle der Anime-Regel:
 * Punktwert ≥ 98 % bei n ≥ 50 und Wilson-Untergrenze ≥ 95 % — je Anbieter, ein Fehler über der Grenze setzt die Regel zurück.
 *
 * Aufruf: node tools/cartoon-jw-auswerten.mjs --meldungen=<datei.json>   (oder --holen mit LAUF_TOKEN, optional LAUF_WORKER)
 * Läuft ohne Schreiben; `--json` gibt die Zahlen statt der Tabelle aus.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'

/** Die Kennung hinter einer Adresse (Netflix-Zahl, Prime-ASIN oder -GTI, Disney+-Entität), kleingeschrieben. */
export function adresskennung(url) {
  const treffer =
    /\/(?:title|watch)\/(\d+)/.exec(url ?? '') ??
    /\/(?:dp|detail)\/([A-Z0-9]{10,32}|amzn1\.dv\.gti\.[a-z0-9-]+)/i.exec(url ?? '') ??
    /[?&]gti=(amzn1\.dv\.gti\.[a-z0-9-]+)/i.exec(url ?? '') ??
    /\/browse\/entity-([0-9a-f-]{8,})/i.exec(url ?? '') ??
    /\/(?:series|movies)\/[^/]+\/([A-Za-z0-9]{6,})/.exec(url ?? '')
  return treffer?.[1].toLowerCase()
}

/** Was die Meldung über den deutschen Ton sagt: `ja` · `nein` · `weg` (nicht verfügbar) · `unbekannt`. */
export function tonDerMeldung(m) {
  const vorhanden = m.vorhanden ?? (m.befund === 'weg' ? 'nein' : m.befund ? 'ja' : null)
  if (vorhanden === 'nein') return 'weg'
  const ton = m.ton_de ?? (m.befund === 'dub' ? 'ja' : m.befund === 'kein_dub' ? 'nein' : 'unbekannt')
  return ['ja', 'nein'].includes(ton) ? ton : 'unbekannt'
}

/** Das Urteil über einen Weg aus seinen Meldungen: `deutsch` · `kein deutsch` · `nicht verfügbar` · `offen`. */
export function urteilJeWeg(meldungen) {
  const tonspur = meldungen.map(tonDerMeldung)
  if (tonspur.includes('ja')) return 'deutsch'
  if (tonspur.includes('nein')) return 'kein deutsch'
  return tonspur.includes('weg') ? 'nicht verfügbar' : 'offen'
}

/** Untergrenze des Wilson-Intervalls (95 %) für `k` Treffer bei `n`. */
export function wilsonUnten(k, n) {
  if (!n) return 0
  const z = 1.96
  const p = k / n
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n)
}

/** Meldungen eines Wegs: gleiche Titelkennung und Anbieter, sonst gleiche Adresskennung beim selben Anbieter. */
function meldungenZu(eintrag, meldungen) {
  const kennung = adresskennung(eintrag.url)
  return meldungen.filter((m) => m.plattform === eintrag.plattform && (m.titel_id === eintrag.id || (kennung && adresskennung(m.url) === kennung)))
}

const RICHTIG = { 'jw-deutsch': 'deutsch', 'jw-ohne-deutsch': 'kein deutsch' }

/** Die Zahlen je Anbieter × Gruppe (und je Gruppe gesamt): n, richtig, Quote, Wilson-Untergrenze, offen. */
export function auswerten(eintraege, meldungen) {
  const zeilen = new Map()
  const zeile = (richtung, plattform) => {
    const k = `${richtung}|${plattform}`
    if (!zeilen.has(k)) zeilen.set(k, { richtung, plattform, wege: 0, n: 0, richtig: 0, falsch: [], offen: 0, nichtVerfuegbar: 0 })
    return zeilen.get(k)
  }
  for (const e of eintraege) {
    const urteil = urteilJeWeg(meldungenZu(e, meldungen))
    for (const z of [zeile(e.richtung, e.plattform), zeile(e.richtung, 'gesamt')]) {
      z.wege++
      if (urteil === 'offen') z.offen++
      else if (urteil === 'nicht verfügbar') z.nichtVerfuegbar++
      else {
        z.n++
        if (urteil === RICHTIG[e.richtung]) z.richtig++
        else z.falsch.push(`${e.titel} (${e.plattform}, ${urteil})`)
      }
    }
  }
  return [...zeilen.values()]
    .map((z) => ({ ...z, quote: z.n ? z.richtig / z.n : null, wilsonUnten: z.n ? wilsonUnten(z.richtig, z.n) : null }))
    .sort((a, b) => a.richtung.localeCompare(b.richtung) || (a.plattform === 'gesamt') - (b.plattform === 'gesamt') || a.plattform.localeCompare(b.plattform))
}

const prozent = (x) => (x == null ? '–' : `${(x * 100).toFixed(1).replace('.', ',')} %`)

/** Die Tabelle als Text; die Schwelle der Anime-Regel steht je Zeile als Ja/Nein. */
export function tabelle(zahlen) {
  const kopf = 'Gruppe             Anbieter     Wege  gemeldet  richtig  Quote     Wilson ≥  offen  n.verf.  Schwelle'
  const zeilen = zahlen.map((z) => {
    const schwelle = z.n < 50 ? `n < 50 (${z.n})` : z.quote >= 0.98 && z.wilsonUnten >= 0.95 ? 'erreicht' : 'verfehlt'
    return [z.richtung.padEnd(18), z.plattform.padEnd(12), String(z.wege).padStart(4), String(z.n).padStart(9), String(z.richtig).padStart(8), prozent(z.quote).padStart(8), prozent(z.wilsonUnten).padStart(9), String(z.offen).padStart(6), String(z.nichtVerfuegbar).padStart(8), `  ${schwelle}`].join(' ')
  })
  const falsch = zahlen.filter((z) => z.plattform !== 'gesamt').flatMap((z) => z.falsch.map((f) => `  ${z.richtung}: ${f}`))
  return [kopf, ...zeilen, ...(falsch.length ? ['', 'Fehlschläge:', ...falsch] : [])].join('\n')
}

/** Holt alle Meldungen vom Worker, seitenweise wie `fetch-urteile.ts`; `fetchFn` ist für den Test austauschbar. */
export async function holeMeldungen(worker, token, fetchFn = fetch) {
  const alle = []
  let nach = 0
  for (;;) {
    const r = await fetchFn(`${worker}/pruefung?alle=1&nach=${nach}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`Worker antwortet ${r.status}`)
    const j = await r.json()
    alle.push(...(j.pruefungen ?? []))
    if (j.weiter == null) return alle
    nach = j.weiter
  }
}

async function main() {
  const arg = (n) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
  const datei = arg('meldungen')
  if (!datei && !process.argv.includes('--holen')) throw new Error('--meldungen=<datei.json> oder --holen angeben')
  const roh = datei ? JSON.parse(readFileSync(resolve(datei), 'utf8')) : await holeMeldungen(WORKER, process.env.LAUF_TOKEN ?? '')
  const meldungen = Array.isArray(roh) ? roh : (roh.pruefungen ?? [])
  const stichprobe = JSON.parse(readFileSync(resolve(WURZEL, 'data/cartoon-jw-stichprobe.json'), 'utf8'))
  const zahlen = auswerten(stichprobe.eintraege, meldungen)
  console.log(process.argv.includes('--json') ? JSON.stringify(zahlen, null, 1) : tabelle(zahlen))
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) await main()
