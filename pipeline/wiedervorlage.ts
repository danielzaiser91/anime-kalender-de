/**
 * Was länger nicht geprüft wurde, gehört wieder auf die Liste.
 *
 * **Der Fall.** Verliert ein Anbieter die Lizenz, nimmt er die deutsche Fassung
 * aus dem Angebot — Crunchyroll führt aus diesem Grund keine erste Staffel von
 * „Attack on Titan" mehr. Unser Bestand behauptet sie dann weiter, und zwar für
 * immer: Eine Handprüfung vom August 2026 gilt ohne Wiedervorlage bis in alle
 * Ewigkeit.
 *
 * Für zwei Anbieter ist das gelöst — Crunchyroll (`data:cr-dub`, 28 Tage
 * Wiedervorlage) und ADN (`vde` je Folge, alle sechs Stunden). Für Prime,
 * Netflix und Disney+ gibt es keine automatische Quelle; dort ist die
 * Handprüfung der einzige Beleg, und sie altert.
 *
 * **Was diese Datei nicht tut.** Sie entfernt nichts und ändert keinen Befund.
 * Sie schreibt eine Liste: `data/wiedervorlage.json`, die die Prüflisten der
 * Erweiterung mit aufnehmen. Ein alter Beleg bleibt gültig, bis ihn jemand
 * widerlegt — er wird nur wieder zur Frage.
 *
 * **Die Frist ist nach Anbieter verschieden**, weil sich die Angebote
 * verschieden schnell ändern. Wer ein Abo-Angebot führt, verliert Lizenzen;
 * ein Kauftitel bleibt kaufbar. Eine kurze Frist gilt für Belege, die einer
 * **laufenden** Serie eine Folge ohne deutschen Ton bescheinigen — die
 * Begründung steht in `lib/wiedervorlage-frist.ts`.
 *
 * Aufruf: `npx tsx pipeline/wiedervorlage.ts [--frist TAGE]`
 *
 * `--frist` überschreibt die Tabelle für **alle** Plattformen und ist zum Prüfen
 * gedacht: Mit einer kurzen Frist lässt sich sehen, dass der Mechanismus greift,
 * ohne ein halbes Jahr zu warten.
 */
import { readFileSync } from 'node:fs'
import { log, readJson, writeJson } from './lib/util.ts'
import { titleStatus } from '../shared/logic.ts'
import { fristFuer } from './lib/wiedervorlage-frist.ts'
import type { PlatformId, Release, Title } from '../shared/types.ts'

const args = process.argv.slice(2)
const FRIST_ARG = Number(args[args.indexOf('--frist') + 1])

interface Fällig {
  id: number
  titel: string
  plattform: PlatformId
  url: string
  geprueftAm: string
  tageAlt: number
}

function main(): void {
  const titles = readJson<Title[]>('public/data/titles.json', [])
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const yaml = readFileSync('data/dub-confirmed.yaml', 'utf8')

  const jeTitel = new Map<number, Release[]>()
  for (const r of releases) {
    const bisher = jeTitel.get(r.titleId)
    if (bisher) bisher.push(r)
    else jeTitel.set(r.titleId, [r])
  }

  /*
    Aus der YAML wird je Titel und Plattform das jüngste Prüfdatum gelesen.
    Ein eigener Parser genügt: Die Datei ist maschinell geschrieben, ein Block
    beginnt immer mit `- anilistId:`.
  */
  const geprueft = new Map<string, string>()
  for (const block of yaml.split(/\n(?=- anilistId:)/)) {
    const id = /anilistId:\s*(\d+)/.exec(block)?.[1]
    const plattform = /platform:\s*(\S+)/.exec(block)?.[1]
    const datum = /checkedAt:\s*'?(\d{4}-\d{2}-\d{2})/.exec(block)?.[1]
    if (!id || !plattform || !datum) continue
    const schluessel = `${id}|${plattform}`
    const alt = geprueft.get(schluessel)
    if (!alt || alt < datum) geprueft.set(schluessel, datum)
  }

  const heute = Date.now()
  const faellig: Fällig[] = []

  for (const t of titles) {
    /* Der Status kommt aus `shared/logic.ts` — nie selbst nachgebaut (CLAUDE.md). */
    const laeuft = titleStatus(jeTitel.get(t.id) ?? [], undefined, t) === 'airing'
    for (const s of t.streams ?? []) {
      const frist = FRIST_ARG || fristFuer(s.platform, laeuft, s.dubRanges)
      if (!frist) continue
      const datum = geprueft.get(`${t.id}|${s.platform}`)
      /*
        Ohne Prüfdatum ist der Verweis nicht alt, sondern ungeprüft — dafür gibt
        es die reguläre Prüfliste. Hier geht es allein um Belege, die veralten.
      */
      if (!datum) continue
      const tageAlt = Math.floor((heute - Date.parse(datum)) / 86_400_000)
      if (tageAlt < frist) continue
      faellig.push({
        id: t.id,
        titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
        plattform: s.platform,
        url: s.seite ?? s.url,
        geprueftAm: datum,
        tageAlt,
      })
    }
  }

  /* Das Älteste zuerst — es ist am wahrscheinlichsten überholt. */
  faellig.sort((a, b) => b.tageAlt - a.tageAlt)
  writeJson('data/wiedervorlage.json', faellig)

  const jePlattform: Record<string, number> = {}
  for (const f of faellig) jePlattform[f.plattform] = (jePlattform[f.plattform] ?? 0) + 1

  log(
    faellig.length
      ? `${faellig.length} Belege fällig: ` +
          Object.entries(jePlattform)
            .map(([p, n]) => `${p} ${n}`)
            .join(', ')
      : 'keine Belege fällig — alle Prüfungen innerhalb ihrer Frist',
  )
}

main()
