/**
 * **Wo eine Quelle einer belegten Synchro widerspricht, wird nachgesehen.**
 *
 * Daniel am 31.08.2026: „was wenn netflix morgen einen der gemeldeten anime
 * titel komplett rausnimmt aus dem angebot? wann bekommen wir es mit?"
 *
 * Bei Crunchyroll und ADN merkt es ein Lauf. Bei Netflix, Prime und Disney+
 * gibt es keine öffentliche Sprachauskunft — dort steht ein `dub: true`, bis
 * jemand hinsieht. Der Link-Check merkt, wenn die **Seite** verschwindet; dass
 * nur die deutsche Tonspur wegfällt, merkt niemand.
 *
 * Dieser Lauf schließt die Lücke, ohne die Regel zu brechen, die für diese
 * Quelle gilt: **Sie belegt, was da ist, nie was fehlt.** Ein fehlendes `de`
 * heißt dort „noch nicht bekannt" — bei `thunder-3` kannte sie Folge 7 zwei
 * Tage nach dem Erscheinen noch nicht.
 *
 * Deshalb entsteht hier **kein `dub: false`**, sondern ein Verdachtsfall: Der
 * Titel kommt auf die Prüfliste, und ein Mensch entscheidet. Der Unterschied
 * ist der ganze Punkt — ein falsch entfernter Verweis fällt niemandem auf, er
 * ist einfach weg.
 *
 * **Gemeldet wird nur, wo die Quelle wirklich hingesehen hat.** Sie muss den
 * Titel bei genau diesem Anbieter führen (`gelistet` nicht leer) und für den
 * abgedeckten Folgenbereich keine deutsche Tonspur nennen. Kennt sie den Titel
 * dort gar nicht, ist ihr Schweigen keine Auskunft.
 *
 * Aufruf: `tsx pipeline/tonspur-verdacht.ts`
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, writeJson } from './lib/util.ts'
import { LEER as MOTN_LEER, ordneShowsZu, tmdbZuordnung, type MotnDaten } from './lib/motn.ts'
import {
  bewerteTreffer,
  passtZuSerie,
  staffelnDesFranchise,
  volltreffer,
} from './lib/adn.ts'
import type { Title } from '../shared/types.ts'

/** Ein Verweis, dem eine Quelle widerspricht — vorzulegen, nicht anzuwenden. */
interface Verdacht {
  titleId: number
  name: string
  platform: string
  url?: string
  /** Der Folgenbereich, über den die Quelle spricht. */
  von: number
  bis: number
  /** Wann der Verdacht zuerst auffiel. */
  seit: string
  /** Wann er zuletzt bestätigt wurde — solange er steht, wächst dieses Datum. */
  zuletzt: string
  erledigt?: string
}

const heute = new Date().toISOString().slice(0, 10)
const titles = readJson<Title[]>('public/data/titles.json', [])
const motn = readJson<MotnDaten>('data/motn.json', MOTN_LEER)
const bisher = readJson<Verdacht[]>('data/tonspur-verdacht.json', [])

if (!Object.keys(motn.shows ?? {}).length) {
  log('Kein MOTN-Bestand — nichts zu vergleichen.')
  process.exit(0)
}

const belege = ordneShowsZu(
  titles,
  motn.shows,
  (t) => (t.franchiseId ? staffelnDesFranchise(titles, t.franchiseId) : []),
  { passtZuSerie, bewerteTreffer, volltreffer },
  tmdbZuordnung(readJson('data/tmdb-titles.json', {}), motn.tmdb),
)

const jeSchluessel = new Map(bisher.map((v) => [`${v.titleId}:${v.platform}`, v]))
let neu = 0
let bestaetigt = 0

/**
 * **Nur wo diese Quelle unsere beste ist.**
 *
 * Bei Crunchyroll lesen wir den deutschen Katalog selbst, je Folge; bei ADN die
 * `vde`-Angabe je Folge. Beides ist genauer als MOTN — dort widerspricht die
 * schlechtere Quelle der besseren, und das ist kein Verdacht, sondern Rauschen.
 *
 * Der erste Lauf am 31.08.2026 zeigte es in einer Zahl: **228 der 291 Fälle
 * waren Crunchyroll**, und 218 hatten überhaupt keinen Handbeleg — ihr
 * `dub: true` kommt aus unserem eigenen Katalog-Lauf. Übrig bleiben die drei
 * Anbieter, bei denen MOTN wirklich die einzige zweite Meinung ist.
 */
const OHNE_EIGENE_QUELLE = new Set(['netflix', 'primevideo', 'disneyplus'])

for (const beleg of belege) {
  /* Nur der Widerspruch zählt: Die Quelle kennt den Titel dort und nennt kein Deutsch. */
  if (beleg.deutsch) continue
  if (!OHNE_EIGENE_QUELLE.has(beleg.platform)) continue
  const titel = titles.find((t) => t.id === beleg.titleId)
  const stream = titel?.streams?.find((s) => s.platform === beleg.platform)
  /* Ein Verweis ohne belegte Synchro widerspricht nichts — er sagt ja nichts. */
  if (!titel || stream?.dub !== true) continue

  const schluessel = `${beleg.titleId}:${beleg.platform}`
  const vorhanden = jeSchluessel.get(schluessel)
  if (vorhanden) {
    vorhanden.zuletzt = heute
    delete vorhanden.erledigt
    bestaetigt++
    continue
  }
  const eintrag: Verdacht = {
    titleId: beleg.titleId,
    name: titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? String(titel.id),
    platform: beleg.platform,
    url: stream?.url,
    von: beleg.von,
    bis: beleg.bis,
    seit: heute,
    zuletzt: heute,
  }
  jeSchluessel.set(schluessel, eintrag)
  neu++
}

/*
  **Ein Verdacht, den die Quelle nicht mehr trägt, wird abgeräumt.**

  Sie kann sich korrigieren — genau deshalb ist ein Widerspruch von ihr kein
  Urteil. Wer nach dem heutigen Lauf nicht mehr bestätigt wurde, bekommt ein
  Erledigt-Datum und verschwindet aus der Arbeitsliste, bleibt aber in der
  Datei: Was einmal auffiel, ist beim nächsten Mal ein Muster.
*/
let abgeraeumt = 0
for (const v of jeSchluessel.values()) {
  if (v.zuletzt !== heute && !v.erledigt) {
    v.erledigt = heute
    abgeraeumt++
  }
}

const alle = [...jeSchluessel.values()]
writeJson('data/tonspur-verdacht.json', alle, true)

const offen = alle.filter((v) => !v.erledigt)
const zeilen = [
  '# Tonspur-Verdacht',
  '',
  'Verweise, für die wir eine deutsche Synchro belegt haben, während die Streaming Availability',
  'API für denselben Anbieter **keine** deutsche Tonspur nennt.',
  '',
  '**Das ist kein Befund, sondern eine Frage.** Die Quelle belegt, was da ist, nie was fehlt —',
  'bei `thunder-3` kannte sie eine Folge zwei Tage nach dem Erscheinen noch nicht. Ein Eintrag',
  'hier heißt deshalb: Bitte einmal nachsehen, ob die deutsche Fassung noch da ist.',
  '',
  'Gemeldet wird nur, wo die Quelle den Titel bei diesem Anbieter wirklich führt. Wo sie ihn gar',
  'nicht kennt, steht hier nichts.',
  '',
  `Stand: ${heute} · ${offen.length} offen`,
  '',
  '| Titel | Anbieter | Folgen | seit | Verweis |',
  '|---|---|---|---|---|',
  ...offen
    .sort((a, b) => (a.seit < b.seit ? -1 : 1))
    .map((v) => `| ${v.name} | ${v.platform} | ${v.von}–${v.bis} | ${v.seit} | ${v.url ?? '—'} |`),
  '',
]
writeFileSync(resolve(ROOT, 'daniel-zum-abarbeiten/13-tonspur-verdacht.md'), zeilen.join('\n'))

log(
  `${neu} neue(r) Verdachtsfall/-fälle, ${bestaetigt} bestätigt, ${abgeraeumt} abgeräumt — ` +
    `${offen.length} offen`,
)
