/**
 * **Folgentitel je Titel, nachgeladen** (Daniel, 04.10.2026): Nutzer sollen im Panel sehen, welche Folgen es gibt,
 * statt zu aniSearch/MAL oder zu Google zu springen — gerade bei Titeln mit über tausend Folgen.
 *
 * Quelle ist `data/anisearch-folgen.json`, **nach aniSearch-ID abgelegt** (Zuordnung `data/anisearch.json`; ein Eintrag,
 * den sich mehrere Titel teilen, ist ein Bündel und bleibt ohne Liste — die Nummern gälten nur für einen davon)
 * (Nummer, Minuten, deutscher/englischer/japanischer Titel). Je Titel eine kleine Datei
 * `public/data/folgen/<AniList-ID>.json` und ein Verzeichnis `index.json`: Die Oberfläche zeigt den Pfeil nur, wo es
 * eine Datei gibt, und lädt sie erst beim Aufklappen. Ein neues Feld in `titles.json` wäre für alle Besucher, die
 * Datei braucht nur, wer aufklappt (ARCHITEKTUR.md).
 *
 * Dateiform: `{ f: [[nr, titel] oder [nr, titel, min], …], de: [[von, bis], …], min? }`. Sind alle Folgen gleich lang,
 * steht die Minutenzahl einmal in `min` (aniSearch führt sie je Folge; One Piece: 1.173 von 1.173 mit 24). `de` sind die
 * Folgen mit belegter deutscher Synchro: die belegten Bereiche der Wege (`dubRanges` mit `dub: true`) und die Folgen,
 * die laut deutscher Wikipedia-Episodenliste schon im deutschen Fernsehen liefen. `h` sind Handhinweise je Folge
 * (`data/folgen-hinweise.yaml`, z. B. „nie in Deutschland ausgestrahlt").
 */
import type { Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { readJson, writeJson, log, clearDir, ROOT } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
}

type WikiListe = { titel?: Record<string, { folgen: { nr: number; ead?: string }[] }> }

/** Die Folgen mit belegter deutscher Synchro, als Bereiche. */
export function deutscheFolgen(t: Title, wiki: { nr: number; ead?: string }[] | undefined, heute: string, hoechste: number): [number, number][] {
  const nummern = new Set<number>()
  for (const s of t.streams ?? []) for (const r of s.dubRanges ?? []) if (r.dub) for (let n = r.from; n <= r.to; n++) nummern.add(n)
  if (wiki?.length && Math.max(...wiki.map((w) => w.nr)) <= hoechste) for (const w of wiki) if (w.ead && w.ead <= heute) nummern.add(w.nr)
  const bereiche: [number, number][] = []
  for (const n of [...nummern].sort((a, b) => a - b)) {
    const letzter = bereiche[bereiche.length - 1]
    if (letzter && letzter[1] === n - 1) letzter[1] = n
    else bereiche.push([n, n])
  }
  return bereiche
}

export function schreibeFolgenDateien(titel: Title[]): void {
  const roh = readJson<Record<string, { folgen?: Folge[] }>>('data/anisearch-folgen.json', {})
  const zuordnung = readJson<Record<string, { anisearchId?: number }>>('data/anisearch.json', {})
  const wiki = readJson<WikiListe>('data/wikipedia-folgen.json', {}).titel ?? {}
  const heute = todayIso()
  const hinweise = (yaml.load(readFileSync(resolve(ROOT, 'data/folgen-hinweise.yaml'), 'utf8')) ?? []) as { anilistId: number; folge: number; art: string; text: string }[]
  const jeAsId = new Map<number, number>()
  for (const t of titel) {
    const a = zuordnung[String(t.id)]?.anisearchId
    if (a) jeAsId.set(a, (jeAsId.get(a) ?? 0) + 1)
  }
  const ordner = `${OUT}/folgen`
  clearDir(ordner)
  const index: number[] = []
  let folgenGesamt = 0
  for (const t of titel) {
    const asId = zuordnung[String(t.id)]?.anisearchId
    const f = asId && jeAsId.get(asId) === 1 ? roh[String(asId)]?.folgen : undefined
    if (!f || f.length < 2) continue
    const minuten = new Set(f.map((x) => x.minuten).filter(Boolean))
    const einheitlich = minuten.size === 1 ? [...minuten][0] : undefined
    writeJson(`${ordner}/${t.id}.json`, {
      f: f.map((x) => (einheitlich ? [x.nr, x.de ?? x.en ?? x.ja ?? ''] : [x.nr, x.de ?? x.en ?? x.ja ?? '', x.minuten ?? 0])),
      de: deutscheFolgen(t, wiki[String(t.id)]?.folgen, heute, Math.max(...f.map((x) => x.nr))),
      ...(einheitlich ? { min: einheitlich } : {}),
      ...(hinweise.some((h) => h.anilistId === t.id) ? { h: hinweise.filter((h) => h.anilistId === t.id).map((h) => [h.folge, h.text]) } : {}),
    })
    index.push(t.id)
    folgenGesamt += f.length
  }
  writeJson(`${ordner}/index.json`, index.sort((a, b) => a - b))
  log(`${index.length} Folgenlisten geschrieben (${folgenGesamt} Folgen)`)
}
