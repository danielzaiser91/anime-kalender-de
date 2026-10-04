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
 * (`data/folgen-hinweise.yaml`, z. B. „nie in Deutschland ausgestrahlt"). `zaehlung.json` führt je Titel `[alle, deutsche]`
 * für die Überschrift des Antwortkastens, wo AniList keine Folgenzahl kennt (One Piece).
 */
import type { Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { readJson, writeJson, log, clearDir, ROOT } from '../lib/util.ts'
import { OUT } from './grundlagen.ts'
import { crFolgentitel, ladeCrArchiv, mitCrTiteln, type CrSerie } from './folgentitel-cr.ts'

interface Folge {
  nr: number
  minuten?: number
  de?: string
  en?: string
  ja?: string
  datum?: string
}

type WikiListe = { titel?: Record<string, { folgen: { nr: number; ead?: string }[] }> }

/**
 * Nur Folgen, die schon erschienen sind. aniSearch führt auch Ankündigungen (One Piece: 1.200 Einträge, Folge 1.174 bis
 * 1.200 ohne Datum); die deutsche Wikipedia-Liste nennt 1.180 (Daniel, 04.10.2026). Die Obergrenze ist die höchste
 * Nummer mit Datum bis heute oder die höchste Wikipedia-Nummer, je nachdem was größer ist. Ohne ein einziges Datum
 * gilt die Liste, wie sie ist.
 */
export function erschieneneFolgen(f: Folge[], wikiHoechste: number, heute: string): Folge[] {
  const gedatet = f.filter((x) => x.datum && x.datum <= heute).map((x) => x.nr)
  if (!gedatet.length && f.some((x) => x.datum)) return []
  const bis = Math.max(gedatet.length ? Math.max(...gedatet) : Math.max(...f.map((x) => x.nr)), wikiHoechste)
  return f.filter((x) => x.nr <= bis)
}

/** Die Folgen mit belegter deutscher Synchro, als Bereiche. */
export function deutscheFolgen(t: Title, wiki: { nr: number; ead?: string }[] | undefined, heute: string, hoechste: number): [number, number][] {
  const nummern = new Set<number>()
  /* Wo es eine Wikipedia-Liste gibt, gilt sie bis zu ihrer letzten Nummer; die Wege füllen nur darüber hinaus (Daniel, 04.10.2026: „wikipedia ist mehr vertrauenswürdig", One Piece 492). */
  const wikiBis = wiki?.length && Math.max(...wiki.map((w) => w.nr)) <= hoechste ? Math.max(...wiki.map((w) => w.nr)) : 0
  /*
    **Dieselbe Regel wie der Antwortkasten** (Daniel, 04.10.2026: „Alle 12 Folgen auf Deutsch" über einer Liste, in der nur
    Folge 12 eine Flagge trug): Ein Weg mit `dub: true` und **ohne Bereiche** sagt „deutsch auf Serienebene" und deckt alle
    erschienenen Folgen. Nennt ein anderer Weg Bereiche, gelten bei einer noch laufenden Serie nur diese — sie stammen
    aus einer Prüfung je Folge (Kill Blue, 07.09.2026).
  */
  const mitDub = (t.streams ?? []).filter((s) => s.dub === true)
  const abgeschlossen = t.jpEnd ? t.jpEnd < heute : Boolean(t.jpYear && t.jpYear < Number(heute.slice(0, 4)))
  const mitBereichen = mitDub.filter((s) => s.dubRanges?.length)
  const beteiligt = mitBereichen.length && !abgeschlossen ? mitBereichen : mitDub
  for (const s of beteiligt) {
    if (!s.dubRanges?.length) for (let n = Math.max(1, wikiBis + 1); n <= hoechste; n++) nummern.add(n)
    for (const r of s.dubRanges ?? []) if (r.dub) for (let n = Math.max(r.from, wikiBis + 1); n <= r.to; n++) nummern.add(n)
  }
  if (wikiBis) for (const w of wiki!) if (w.ead && w.ead <= heute) nummern.add(w.nr)
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
  /* Deutsche Crunchyroll-Serien nach Adresse — Quelle der Folgentitel, wo aniSearch keine hat (`folgentitel-cr.ts`). */
  const crSerien = new Map(readJson<{ serien: (CrSerie & { url: string; katalog?: string })[] }>('data/crunchyroll-dub.json', { serien: [] }).serien.filter((s) => s.katalog === 'de').map((s) => [s.url, s]))
  const hinweise = (yaml.load(readFileSync(resolve(ROOT, 'data/folgen-hinweise.yaml'), 'utf8')) ?? []) as { anilistId: number; folge: number; art: string; text: string }[]
  const jeAsId = new Map<number, number>()
  for (const t of titel) {
    const a = zuordnung[String(t.id)]?.anisearchId
    if (a) jeAsId.set(a, (jeAsId.get(a) ?? 0) + 1)
  }
  const ordner = `${OUT}/folgen`
  clearDir(ordner)
  const index: number[] = []
  const zaehlung: Record<number, [number, number]> = {}
  let folgenGesamt = 0
  for (const t of titel) {
    const asId = zuordnung[String(t.id)]?.anisearchId
    const wikiFolgen = wiki[String(t.id)]?.folgen
    const ausAs = asId && jeAsId.get(asId) === 1 ? erschieneneFolgen(roh[String(asId)]?.folgen ?? [], wikiFolgen?.length ? Math.max(...wikiFolgen.map((w) => w.nr)) : 0, heute) : undefined
    /* Das Archiv wird nur geöffnet, wo aniSearch Titel schuldig bleibt. */
    const fehlt = !ausAs || ausAs.length < 2 || ausAs.some((x) => !(x.de ?? x.en ?? x.ja))
    const crUrl = t.streams.find((s) => s.platform === 'crunchyroll')?.url
    const crSerie = fehlt && crUrl ? crSerien.get(crUrl) : undefined
    const f = mitCrTiteln(ausAs, crFolgentitel(t, crSerie, ladeCrArchiv(crSerie?.seriesId)))
    if (!f || f.length < 2) continue
    const minuten = new Set(f.map((x) => x.minuten).filter(Boolean))
    const einheitlich = minuten.size === 1 ? [...minuten][0] : undefined
    const de = deutscheFolgen(t, wikiFolgen, heute, Math.max(...f.map((x) => x.nr)))
    zaehlung[t.id] = [f.length, f.filter((x) => de.some(([von, bis]) => x.nr >= von && x.nr <= bis)).length]
    writeJson(`${ordner}/${t.id}.json`, {
      f: f.map((x) => (einheitlich ? [x.nr, x.de ?? x.en ?? x.ja ?? ''] : [x.nr, x.de ?? x.en ?? x.ja ?? '', x.minuten ?? 0])),
      de,
      ...(einheitlich ? { min: einheitlich } : {}),
      ...(hinweise.some((h) => h.anilistId === t.id) ? { h: hinweise.filter((h) => h.anilistId === t.id).map((h) => [h.folge, h.text]) } : {}),
    })
    index.push(t.id)
    folgenGesamt += f.length
  }
  writeJson(`${ordner}/index.json`, index.sort((a, b) => a - b))
  writeJson(`${ordner}/zaehlung.json`, zaehlung)
  log(`${index.length} Folgenlisten geschrieben (${folgenGesamt} Folgen)`)
}
