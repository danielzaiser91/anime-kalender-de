/**
 * Was jeder Lauf am Bestand wirklich verändert hat — Zeile für Zeile.
 *
 * ## Warum es das braucht
 *
 * Am 26.08.2026 gingen an einem Abend zweimal Meldungen verloren, ohne dass es
 * jemand bemerkt hätte: Der Übernahme-Lauf hakte 508 Disney-Meldungen ab und
 * schrieb daraus einen einzigen Eintrag, und 216 One-Piece-Meldungen wurden
 * abgehakt, ohne je zu einem Urteil zu werden. Beide Male sah der Lauf grün aus.
 * Gefunden hat es Daniel, weil ihm eine Zahl in der Oberfläche komisch vorkam.
 *
 * Sein Auftrag danach: „stell sicher, dass wann immer automatische läufe unseren
 * bestand aktualisieren eine historie angelegt wird von dem tatsächlichen delta,
 * und du es dir für die nächsten paar tage vornimmst dieses delta zu überwachen."
 *
 * ## Was hier steht
 *
 * Je Lauf eine Zeile in `data/bestand-historie.jsonl` mit den Kennzahlen und
 * dem Unterschied zur vorigen. Eine Zeile ist billig, und die Datei ist damit
 * das Gedächtnis, das dem Datensatz selbst fehlt: Er kennt nur seinen jetzigen
 * Zustand, nie den Weg dorthin.
 *
 * **Auffälliges wird benannt, nicht nur gezählt.** Ein Bestand, der schrumpft,
 * ist der Normalfall bei aufgeräumten Verweisen und der Alarmfall bei
 * verlorenen Belegen — beides sieht in einer Zahl gleich aus. Deshalb steht in
 * `auffaellig` im Klartext, was zu prüfen wäre.
 *
 * ## Aufruf
 *
 *   npx tsx pipeline/bestand-historie.ts [--lauf <name>]
 *
 * Läuft nach `data:build`, liest nur den ausgelieferten Datensatz und schreibt
 * eine Zeile an.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Title } from '../shared/types.ts'
import { findeAuffaelliges, messen, type Kennzahlen } from './lib/bestand-delta.ts'

const ROOT = resolve(import.meta.dirname, '..')
const DATEI = resolve(ROOT, 'data/bestand-historie.jsonl')

const args = process.argv.slice(2)
const laufName = args[args.indexOf('--lauf') + 1] ?? process.env.GITHUB_WORKFLOW ?? 'lokal'

function lies<T>(pfad: string, vorgabe: T): T {
  const p = resolve(ROOT, pfad)
  if (!existsSync(p)) return vorgabe
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T
  } catch {
    return vorgabe
  }
}

function messenAusDateien(): Kennzahlen {
  const roh = lies<Title[] | Record<string, Title>>('public/data/titles.json', [])
  return messen({
    titel: Array.isArray(roh) ? roh : Object.values(roh),
    releases: lies<unknown[]>('public/data/releases.json', []),
    termine: lies<unknown[]>('public/data/events.json', []),
    entfernt: lies<{ verweise?: unknown[] }>('data/verweise-entfernt.json', {}),
  })
}

function letzteZeile(): (Kennzahlen & { zeitpunkt: string }) | null {
  if (!existsSync(DATEI)) return null
  const zeilen = readFileSync(DATEI, 'utf8').trimEnd().split('\n').filter(Boolean)
  if (!zeilen.length) return null
  try {
    return JSON.parse(zeilen[zeilen.length - 1]!)
  } catch {
    return null
  }
}

const jetzt = messenAusDateien()
const vorher = letzteZeile()
const auffaellig = findeAuffaelliges(jetzt, vorher)

const zeile = {
  zeitpunkt: new Date().toISOString(),
  lauf: laufName,
  ...jetzt,
  delta: vorher
    ? {
        titel: jetzt.titel - vorher.titel,
        verweise: jetzt.verweise - vorher.verweise,
        mitUrteil: jetzt.mitUrteil - vorher.mitUrteil,
        ohneUrteil: jetzt.ohneUrteil - vorher.ohneUrteil,
        titelMitSynchro: jetzt.titelMitSynchro - vorher.titelMitSynchro,
        releases: jetzt.releases - vorher.releases,
        termine: jetzt.termine - vorher.termine,
      }
    : null,
  auffaellig: auffaellig.length ? auffaellig : undefined,
}

appendFileSync(DATEI, JSON.stringify(zeile) + '\n')

const d = zeile.delta
console.log(
  `[historie] ${jetzt.titel} Titel, ${jetzt.mitUrteil} Urteile, ${jetzt.ohneUrteil} offen` +
    (d
      ? ` — Delta: Titel ${d.titel >= 0 ? '+' : ''}${d.titel}, Urteile ${d.mitUrteil >= 0 ? '+' : ''}${d.mitUrteil}, offen ${d.ohneUrteil >= 0 ? '+' : ''}${d.ohneUrteil}`
      : ' — erste Zeile'),
)
if (auffaellig.length) {
  console.log(`[historie] ⚠  ${auffaellig.join('; ')}`)
}
