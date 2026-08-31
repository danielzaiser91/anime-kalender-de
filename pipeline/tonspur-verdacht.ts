/**
 * **Ein Verdacht entsteht aus einer Änderung, nicht aus einem Schweigen.**
 *
 * Daniel am 31.08.2026: „die wiedervorlage von motn sollte so funktionieren:
 * Motn sagt die netflix synchro existiert -> wir speichern diese info ab ->
 * motn ändert die aussage irgendwann in der zukunft -> wiedervorlage."
 *
 * Die erste Fassung dieses Laufs (Vormittag desselben Tages) fragte etwas
 * anderes: *Widerspricht die Quelle gerade unserem Bestand?* Das ergab 57
 * Dauerfälle — Titel, für die MOTN einfach nie eine deutsche Tonspur kannte.
 * Dorohedoro stand darunter, vollständig gemeldet und trotzdem als „bitte
 * gegenprüfen" in der Prüfliste; im Kasten sah es aus, als fehlten 23 Folgen.
 *
 * **Ein fehlendes `de` heißt dort „noch nicht bekannt", und das gilt in beide
 * Richtungen.** Aus Schweigen wird kein Befund — auch keine Aufgabe. Was
 * dagegen etwas aussagt, ist der **Wechsel**: Wer gestern Deutsch nannte und
 * heute nicht mehr, hat eine Angabe zurückgenommen. Genau das passiert, wenn
 * ein Anbieter die Lizenz verliert und die deutsche Fassung aus dem Angebot
 * nimmt — der Fall, für den es hier überhaupt eine Prüfung gibt.
 *
 * Deshalb führt dieser Lauf zwei Dateien:
 *
 * - `data/motn-tonspur.json` — je Verweis die zuletzt gesehene Aussage. Sie
 *   wächst mit jedem Lauf und ist der Vergleichsmaßstab. Ohne Vorstand gibt es
 *   keinen Verdacht, nur einen ersten Eintrag.
 * - `data/tonspur-verdacht.json` — die Wechsel von „deutsch" auf „nicht mehr
 *   genannt". Nur diese kommen in die Prüfliste.
 *
 * **Gemeldet wird nur, wo die Quelle wirklich hingesehen hat.** Sie muss den
 * Titel bei genau diesem Anbieter führen; kennt sie ihn dort gar nicht, ist ihr
 * Schweigen keine Auskunft und der Vorstand bleibt unangetastet.
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

/** Was die Quelle zuletzt über einen Verweis gesagt hat. */
interface Stand {
  titleId: number
  platform: string
  /** Nannte sie eine deutsche Tonspur? */
  deutsch: boolean
  /** Der Folgenbereich, über den sie gesprochen hat. */
  von: number
  bis: number
  /** Wann diese Aussage zuletzt bestätigt wurde. */
  stand: string
  /** Wann sie zuerst gesehen wurde. */
  seit: string
}

/** Ein zurückgenommenes „deutsch" — vorzulegen, nicht anzuwenden. */
interface Verdacht {
  titleId: number
  name: string
  platform: string
  url?: string
  von: number
  bis: number
  /** Seit wann die Quelle Deutsch nannte, bevor sie es zurücknahm. */
  vorherSeit: string
  /** Wann der Wechsel auffiel. */
  seit: string
  /** Wann er zuletzt bestätigt wurde — solange er steht, wächst dieses Datum. */
  zuletzt: string
  erledigt?: string
}

const heute = new Date().toISOString().slice(0, 10)
const titles = readJson<Title[]>('public/data/titles.json', [])
const motn = readJson<MotnDaten>('data/motn.json', MOTN_LEER)
const staende = readJson<Stand[]>('data/motn-tonspur.json', [])
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

/**
 * **Nur wo diese Quelle unsere beste zweite Meinung ist.**
 *
 * Bei Crunchyroll lesen wir den deutschen Katalog selbst, je Folge; bei ADN die
 * `vde`-Angabe je Folge. Beides ist genauer als MOTN — dort widerspricht die
 * schlechtere Quelle der besseren, und das ist kein Verdacht, sondern Rauschen.
 * Der erste Lauf am 31.08.2026 zeigte es in einer Zahl: 228 der 291 Fälle waren
 * Crunchyroll.
 */
const OHNE_EIGENE_QUELLE = new Set(['netflix', 'primevideo', 'disneyplus'])

const jeSchluessel = new Map(staende.map((s) => [`${s.titleId}:${s.platform}`, s]))
const verdachtJeSchluessel = new Map(bisher.map((v) => [`${v.titleId}:${v.platform}`, v]))

let neuerStand = 0
let bestaetigt = 0
let neuerVerdacht = 0
let zurueck = 0

for (const beleg of belege) {
  if (!OHNE_EIGENE_QUELLE.has(beleg.platform)) continue
  const titel = titles.find((t) => t.id === beleg.titleId)
  if (!titel) continue

  const schluessel = `${beleg.titleId}:${beleg.platform}`
  const vorher = jeSchluessel.get(schluessel)

  /*
    **Der Wechsel, um den es geht: gestern deutsch, heute nicht mehr.**

    Nur er wird zur Aufgabe. Die Gegenrichtung (die Quelle lernt eine Synchro
    dazu) ist eine gute Nachricht und braucht keine Handarbeit — sie bestätigt
    höchstens, was wir ohnehin führen.
  */
  if (vorher?.deutsch && !beleg.deutsch) {
    const stream = titel.streams?.find((s) => s.platform === beleg.platform)
    const vorhandener = verdachtJeSchluessel.get(schluessel)
    if (vorhandener) {
      vorhandener.zuletzt = heute
      delete vorhandener.erledigt
      bestaetigt++
    } else {
      verdachtJeSchluessel.set(schluessel, {
        titleId: beleg.titleId,
        name: titel.titleDe ?? titel.titleEn ?? titel.titleRomaji ?? String(titel.id),
        platform: beleg.platform,
        url: stream?.url,
        von: beleg.von,
        bis: beleg.bis,
        vorherSeit: vorher.seit,
        seit: heute,
        zuletzt: heute,
      })
      neuerVerdacht++
    }
  }

  /*
    **Ein Verdacht, den die Quelle zurücknimmt, wird abgeräumt.**

    Nennt sie wieder Deutsch, war der Wechsel ein Aussetzer — genau deshalb ist
    ein Widerspruch von ihr kein Urteil.
  */
  if (beleg.deutsch) {
    const vorhandener = verdachtJeSchluessel.get(schluessel)
    if (vorhandener && !vorhandener.erledigt) {
      vorhandener.erledigt = heute
      zurueck++
    }
  }

  if (vorher) {
    vorher.deutsch = beleg.deutsch
    vorher.von = beleg.von
    vorher.bis = beleg.bis
    vorher.stand = heute
  } else {
    jeSchluessel.set(schluessel, {
      titleId: beleg.titleId,
      platform: beleg.platform,
      deutsch: beleg.deutsch,
      von: beleg.von,
      bis: beleg.bis,
      stand: heute,
      seit: heute,
    })
    neuerStand++
  }
}

writeJson('data/motn-tonspur.json', [...jeSchluessel.values()], true)

const alle = [...verdachtJeSchluessel.values()]
writeJson('data/tonspur-verdacht.json', alle, true)

const offen = alle.filter((v) => !v.erledigt)
const zeilen = [
  '# Tonspur-Verdacht',
  '',
  'Verweise, für die die Streaming Availability API **früher** eine deutsche Tonspur nannte und',
  'jetzt keine mehr. Das ist die Frage, für die es diese Prüfung gibt: Verliert ein Anbieter die',
  'Lizenz, nimmt er die deutsche Fassung aus dem Angebot, und niemand sagt es uns.',
  '',
  '**Ein Schweigen ist kein Eintrag.** Kennt die Quelle einen Titel gar nicht auf Deutsch, steht',
  'hier nichts — bei `thunder-3` kannte sie eine Folge zwei Tage nach dem Erscheinen noch nicht.',
  'Nur der Wechsel von „deutsch" auf „nicht mehr genannt" zählt.',
  '',
  'Der Vergleichsmaßstab steht in `data/motn-tonspur.json`: je Verweis die zuletzt gesehene',
  'Aussage. Ohne Vorstand gibt es keinen Verdacht, nur einen ersten Eintrag.',
  '',
  `Stand: ${heute} · ${offen.length} offen · ${jeSchluessel.size} Verweise beobachtet`,
  '',
  '| Titel | Anbieter | Folgen | nannte Deutsch seit | Wechsel bemerkt | Verweis |',
  '|---|---|---|---|---|---|',
  ...offen
    .sort((a, b) => (a.seit < b.seit ? -1 : 1))
    .map(
      (v) =>
        `| ${v.name} | ${v.platform} | ${v.von}–${v.bis} | ${v.vorherSeit} | ${v.seit} | ${v.url ?? '—'} |`,
    ),
  '',
]
writeFileSync(resolve(ROOT, 'daniel-zum-abarbeiten/13-tonspur-verdacht.md'), zeilen.join('\n'))

log(
  `${jeSchluessel.size} Verweise beobachtet (${neuerStand} neu) — ` +
    `${neuerVerdacht} neue(r) Verdachtsfall/-fälle, ${bestaetigt} bestätigt, ${zurueck} zurückgenommen, ` +
    `${offen.length} offen`,
)
