/**
 * Bestandsprüfung (20.10.2026): Keine bestehende Meldung in `public/data/news.json` ändert Anbieter, Kanal, Einordnung, Sicherheit oder
 * `weiterer` gegenüber dem Vorstand, dem zuletzt eingecheckten Stand (`HEAD`; `--vorstand <ref>` wählt einen anderen, etwa `HEAD^1`).
 * Eine Meldung ist eine Aussage zu ihrem Tag (`lib/news-felder-fest.ts`). Kann der Vorstand nicht gelesen werden, ist die Prüfung rot:
 * Nichtauskunft ist kein Befund „alles gleich“. Liest den gebauten Bestand, deshalb in `check:bestand` (`tools/check-bestand-liste.txt`).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { readJson, ROOT } from './lib/util.ts'
import type { NewsEintrag } from '../shared/news-typen.ts'
import { felderAenderungen } from './lib/news-felder-fest.ts'

const DATEI = 'public/data/news.json'
const git = (...a: string[]): string => execFileSync(process.env.GIT_EXE ?? 'git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

/** `news.json` des Vorstands; `undefined`, wenn es die Datei dort nicht gab. Wirft bei unbekanntem Stand oder unlesbarem Inhalt. */
export function leseVorstand(ref: string): NewsEintrag[] | undefined {
  if (!git('ls-tree', ref, '--', DATEI).trim()) return undefined
  return JSON.parse(git('show', `${ref}:${DATEI}`)) as NewsEintrag[]
}

export function main(argv: string[]): number {
  const ref = argv.includes('--vorstand') ? argv[argv.indexOf('--vorstand') + 1]! : 'HEAD'
  let vorstand: NewsEintrag[] | undefined
  try {
    vorstand = leseVorstand(ref)
  } catch (e) {
    console.error(`FEHLER: Vorstand ${ref} nicht lesbar: ${(e as Error).message.split('\n')[0]}`)
    console.log('VERSTÖSSE: 1')
    return 1
  }
  const jetzt = readJson<NewsEintrag[]>(DATEI, [])
  const zeilen = vorstand ? felderAenderungen(vorstand, jetzt) : []
  for (const z of zeilen) console.error(`FEHLER: ${z}`)
  console.log(`check-news-felder-bestand: ${jetzt.length} Einträge gegen ${vorstand ? `${vorstand.length} des Vorstands ${ref}` : `Vorstand ${ref} ohne news.json`}, ${zeilen.length} geänderte Felder`)
  console.log(`VERSTÖSSE: ${zeilen.length}`)
  return zeilen.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(main(process.argv.slice(2)))
