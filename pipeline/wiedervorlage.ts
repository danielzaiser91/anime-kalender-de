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
 * ein Kauftitel bleibt kaufbar.
 *
 * Aufruf: `npx tsx pipeline/wiedervorlage.ts [--frist TAGE]`
 *
 * `--frist` überschreibt die Tabelle für **alle** Plattformen und ist zum Prüfen
 * gedacht: Mit einer kurzen Frist lässt sich sehen, dass der Mechanismus greift,
 * ohne ein halbes Jahr zu warten.
 */
import { readFileSync } from 'node:fs'
import { log, readJson, writeJson } from './lib/util.ts'
import type { PlatformId, Title } from '../shared/types.ts'

const args = process.argv.slice(2)
const FRIST_ARG = Number(args[args.indexOf('--frist') + 1])

/**
 * Nach wie vielen Tagen ein Beleg wieder zur Frage wird.
 *
 * Crunchyroll und ADN fehlen hier: Deren Bestand wird ohnehin laufend gegen die
 * Quelle gehalten, eine zweite Wiedervorlage wäre doppelte Arbeit.
 */
const FRISTEN: Partial<Record<PlatformId, number>> = {
  primevideo: 180,
  netflix: 180,
  disneyplus: 180,
  rtlplus: 270,
  joyn: 270,
  /* YouTube prüft `check-youtube.ts` je Lauf gegen die Data API. */
}

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
  const yaml = readFileSync('data/dub-confirmed.yaml', 'utf8')

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
    for (const s of t.streams ?? []) {
      const frist = FRIST_ARG || FRISTEN[s.platform]
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
        url: s.url,
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
