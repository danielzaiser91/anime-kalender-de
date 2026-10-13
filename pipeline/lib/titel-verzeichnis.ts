/**
 * Das A–Z-Verzeichnis: `/titel/` (Übersicht) und `/titel/<buchstabe>/`, zusammen mit einem Link auf jede Titelseite.
 * Gemessen am 13.10.2026: Von 2.924 Titelseiten waren nur 650 von der Startseite oder `/termine/` aus verlinkt,
 * 2.274 stand nur in der Sitemap, und Google führt sie als „Gefunden – zurzeit nicht indexiert“.
 * Reines HTML, kein Skript; die Seiten teilen sich den Rahmen der Startseite (`before`/`after`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { teilenPfad } from '../../shared/teilen.ts'
import { OG_FASSUNG } from './og-fassung.ts'
import { ARTIKEL_STIL, SITE, esc } from './titel-seite.ts'
import { LINK_STIL, START_KRUME, UEBERSCHRIFT_2, VERZEICHNIS_KRUME, brotkrumenHtml, brotkrumenJsonLd, type Krume } from './titel-umfeld.ts'
import { buchstabenLabel, verzeichnisSchluessel } from './verzeichnis-buchstabe.ts'

export interface VerzeichnisTitel {
  name: string
  adresse: string
  belegt: boolean
}

export interface Buchstabe {
  schluessel: string
  anzahl: number
}

/** Rahmen der vorgerenderten Seiten: die Vorlage um die `social:`-Marker und der Platzhalter für den Inhalt. */
export interface SeitenVorlage {
  before: string
  after: string
  rootTag: string
}

const VERZEICHNIS_STIL = '<style>.vz a{color:#7dd3fc}</style>'

/** Je Buchstabe die Titel, nach Namen sortiert; eine Adresse erscheint einmal (zusammengeführte Kennungen). */
export function gruppiere(eintraege: VerzeichnisTitel[]): Map<string, VerzeichnisTitel[]> {
  const einmalig = [...new Map(eintraege.map((e) => [e.adresse, e])).values()]
  einmalig.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }) || a.adresse.localeCompare(b.adresse))
  const gruppen = new Map<string, VerzeichnisTitel[]>()
  for (const e of einmalig) {
    const schluessel = verzeichnisSchluessel(e.name)
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), e])
  }
  return new Map([...gruppen].sort(([a], [b]) => (a === '0-9' ? -1 : b === '0-9' ? 1 : a.localeCompare(b))))
}

export function buchstabenListe(gruppen: Map<string, VerzeichnisTitel[]>): Buchstabe[] {
  return [...gruppen].map(([schluessel, liste]) => ({ schluessel, anzahl: liste.length }))
}

/** Die Buchstaben-Leiste: ein Link je Buchstabe mit Anzahl (`aktuell` bleibt ohne Link). */
export function buchstabenLeiste(buchstaben: Buchstabe[], aktuell?: string): string {
  const teile = buchstaben.map((b) => {
    const text = `${buchstabenLabel(b.schluessel)} (${b.anzahl})`
    return b.schluessel === aktuell ? `<strong>${text}</strong>` : `<a href="${SITE}titel/${b.schluessel}/" style="${LINK_STIL}">${text}</a>`
  })
  return `<p style="margin:0 0 1.5rem;line-height:2;">${teile.join(' · ')}</p>`
}

function titelZeile(e: VerzeichnisTitel): string {
  const vermerk = e.belegt ? '' : ' · Synchro erwartet'
  return `<li><a href="${SITE}${teilenPfad(e.adresse)}">${esc(e.name)}</a>${vermerk}</li>`
}

function kopf(titel: string, beschreibung: string, url: string, krumen: Krume[]): string {
  const bild = `${SITE}og/default.jpg?v=${OG_FASSUNG}`
  return (
    `    <title>${esc(titel)}</title>\n` +
    `    <meta name="description" content="${esc(beschreibung)}" />\n` +
    `    <link rel="canonical" href="${url}" />\n` +
    `    <meta property="og:type" content="website" />\n` +
    `    <meta property="og:site_name" content="Anime-Kalender DE" />\n` +
    `    <meta property="og:locale" content="de_DE" />\n` +
    `    <meta property="og:url" content="${url}" />\n` +
    `    <meta property="og:title" content="${esc(titel)}" />\n` +
    `    <meta property="og:description" content="${esc(beschreibung)}" />\n` +
    `    <meta property="og:image" content="${bild}" />\n` +
    `    ${VERZEICHNIS_STIL}\n` +
    `${brotkrumenJsonLd(krumen)}\n`
  )
}

function uebersichtInhalt(buchstaben: Buchstabe[], unbelegt: number): string {
  const summe = buchstaben.reduce((n, b) => n + b.anzahl, 0)
  return (
    `<article style="${ARTIKEL_STIL}">\n      ${brotkrumenHtml([START_KRUME, VERZEICHNIS_KRUME])}\n` +
    `      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">Alle Anime von A bis Z</h1>\n` +
    `      <p style="margin:0 0 1rem;">${summe} Anime und Animationsserien im Kalender, nach Anfangsbuchstaben. Jeder Titel hat eine eigene Seite mit deutscher Synchro, Anbietern und Terminen.` +
    (unbelegt ? ` Bei ${unbelegt} Titeln ist die Synchro erst angekündigt oder wahrscheinlich; sie tragen den Vermerk „Synchro erwartet“.` : '') +
    `</p>\n      ${buchstabenLeiste(buchstaben)}\n` +
    `      <p><a href="${SITE}termine/" style="${LINK_STIL}">Alle Termine</a> · <a href="${SITE}" style="${LINK_STIL}">Zum Kalender</a></p>\n    </article>`
  )
}

function buchstabenInhalt(schluessel: string, liste: VerzeichnisTitel[], buchstaben: Buchstabe[]): string {
  const label = buchstabenLabel(schluessel)
  const krumen = [START_KRUME, VERZEICHNIS_KRUME, { name: label, url: `${SITE}titel/${schluessel}/` }]
  return (
    `<article style="${ARTIKEL_STIL}">\n      ${brotkrumenHtml(krumen)}\n` +
    `      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">Anime mit ${label}</h1>\n` +
    `      <p style="margin:0 0 1rem;">${liste.length} Titel mit Seite zu deutscher Synchro, Anbietern und Terminen.</p>\n` +
    `      <ul class="vz" style="margin:0 0 1.5rem;padding-left:1.2rem;">\n        ${liste.map(titelZeile).join('\n        ')}\n      </ul>\n` +
    `      <h2 style="${UEBERSCHRIFT_2}">Weitere Buchstaben</h2>\n      ${buchstabenLeiste(buchstaben, schluessel)}\n    </article>`
  )
}

function schreibeSeite(dist: string, v: SeitenVorlage, pfad: string, kopfHtml: string, inhalt: string): void {
  const dir = resolve(dist, pfad)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'index.html'), (v.before + kopfHtml + v.after).replace(v.rootTag, () => `<div id="root">${inhalt}</div>`), 'utf8')
}

/** Schreibt `titel/index.html` und `titel/<buchstabe>/index.html`; gibt die Buchstaben mit Anzahl zurück (für Startseite und Sitemap). */
export function schreibeVerzeichnis(dist: string, v: SeitenVorlage, eintraege: VerzeichnisTitel[]): Buchstabe[] {
  const gruppen = gruppiere(eintraege)
  const buchstaben = buchstabenListe(gruppen)
  const unbelegt = [...gruppen.values()].flat().filter((e) => !e.belegt).length
  const summe = buchstaben.reduce((n, b) => n + b.anzahl, 0)
  schreibeSeite(
    dist,
    v,
    'titel',
    kopf(
      'Anime von A bis Z: alle Titel mit deutscher Synchro',
      `Alle ${summe} Anime und Animationsserien im Kalender von A bis Z: deutsche Synchro, Anbieter und Termine je Titel.`,
      `${SITE}titel/`,
      [START_KRUME, VERZEICHNIS_KRUME],
    ),
    uebersichtInhalt(buchstaben, unbelegt),
  )
  for (const [schluessel, liste] of gruppen) {
    const label = buchstabenLabel(schluessel)
    const krumen = [START_KRUME, VERZEICHNIS_KRUME, { name: label, url: `${SITE}titel/${schluessel}/` }]
    const beschreibung = `${liste.length} Anime mit ${label}, von „${liste[0]!.name}“ bis „${liste[liste.length - 1]!.name}“: deutsche Synchro, Anbieter und Termine.`
    schreibeSeite(dist, v, `titel/${schluessel}`, kopf(`Anime mit ${label}: Titel mit deutscher Synchro`, beschreibung, `${SITE}titel/${schluessel}/`, krumen), buchstabenInhalt(schluessel, liste, buchstaben))
  }
  return buchstaben
}

/** Adressen von Seiten, die das Verzeichnis zusätzlich zu den Titeln braucht (für die Sitemap). */
export function verzeichnisAdressen(buchstaben: Buchstabe[]): string[] {
  return [`${SITE}titel/`, ...buchstaben.map((b) => `${SITE}titel/${b.schluessel}/`)]
}
