/**
 * Bestandsteil von `check-logic.ts`: Zusicherungen, die `public/data` lesen (Titel, Releases, Reihen, Folgen) oder an ihnen Handdateien messen.
 * Gehört deshalb in `check:bestand`, nicht in `check:logic` (der Bestand liegt hinter neueren Rohdaten zurück; PR-Ketten wurden daran rot, 12.10.2026).
 * Die Zusicherungen ohne Dateizugriff auf den Bestand stehen in `check-logic.ts`.
 */
import { ladeAkVon, uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import { readdirSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { malDubletten } from './lib/mal-dubletten.ts'
import type { Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { ladeTitelDe } from './lib/titel-de.ts'
import { ohneSynchroVonHand } from './bau/ohne-beleg.ts'
import { keinAnisearchSuchlink } from './lib/invarianten-auslieferung.ts'
import { TV_NAMEN } from './fetch-tv-programm.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) {
    console.log(`  ✓ ${name}`)
    return
  }
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nTMDB-Kennungen von Hand (gegen den Bestand)')
{
  const vomBand = (datei: string) => readFileSync(new URL('../' + datei, import.meta.url), 'utf8')
  const eintraege = (yaml.load(vomBand('data/tmdb-von-hand.yaml')) as { anilistId: number; tmdbId: number }[] | null) ?? []
  /*
    Dieselbe TMDB-Kennung an zwei Titeln ist erlaubt und kommt vor: TMDB führt „Dragon Ball Z
    Kai" und dessen „Final Chapters" als eine Serie, unser Bestand trennt sie. Erlaubt ist das
    nur innerhalb derselben Reihe — sonst wandern Wege zu einem fremden Werk.
  */
  const jeTmdb = new Map<number, number[]>()
  for (const e of eintraege) jeTmdb.set(e.tmdbId, [...(jeTmdb.get(e.tmdbId) ?? []), e.anilistId])
  /*
    **Beide Bestände zählen.** „Super Dragon Ball Heroes" hat keine deutsche Synchro und steht
    deshalb in `ohne-synchro.json` — eine TMDB-Kennung braucht es trotzdem, denn genau dort
    beantwortet sie die Frage „gibt es das irgendwo?".
  */
  const imBestand = [
    ...(JSON.parse(vomBand('public/data/titles.json')) as Title[]),
    ...(JSON.parse(vomBand('public/data/ohne-synchro.json')) as Title[]),
  ]
  const bestand = new Map(imBestand.map((t) => [t.id, t]))
  const fremdGeteilt = [...jeTmdb.values()]
    .filter((ids) => ids.length > 1)
    .filter((ids) => new Set(ids.map((id) => bestand.get(id)?.franchiseId ?? `solo-${id}`)).size > 1)
  pruefe('eine geteilte TMDB-Kennung bleibt in ihrer Reihe', fremdGeteilt.length === 0, fremdGeteilt)
  pruefe(
    'jede AniList-Kennung steht im Bestand',
    eintraege.every((e) => bestand.has(e.anilistId)),
    eintraege.filter((e) => !bestand.has(e.anilistId)).map((e) => e.anilistId),
  )
}

console.log('\nWerktitel gegen Teiltitel')

/**
 * Ein Titel traegt nie die Nummer eines seiner Teile.
 *
 * Bei Yu-Gi-Oh zeigte die Kalenderkarte "Staffel 3", das Detail-Panel
 * darunter "Staffel 2" -- dieselbe Serie, dieselbe Sekunde (Daniel,
 * 24.08.2026, mit zwei Bildern). Beide Disney+-Ausgaben gehoeren zu einer
 * AniList-Serie mit 224 Folgen; der zuerst gelesene kuratierte Eintrag
 * setzte seinen Namen als Werktitel.
 *
 * Geprueft wird am **gebauten** Datensatz, nicht an einer nachgestellten
 * Eingabe: Der Fehler entstand aus der Reihenfolge zweier Eintraege, und
 * genau die bildet nur der echte Lauf ab.
 */
{
  /** Direkt von der Platte — diese Datei zieht sonst nichts aus dem Repo. */
  const lies = (p: string) =>
    JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')) as unknown
  const roh = lies('public/data/titles.json') as Title[] | Record<string, Title>
  const alleTitel = Array.isArray(roh) ? roh : Object.values(roh)
  /*
    **Ausgenommen: Der Eintrag ist selbst der Teil** (22.09.2026). Führt AniList „Girls und Panzer das
    Finale - Part 4" oder „BEASTARS Final Season Part 2" als eigenen Eintrag, ist die Nummer der Name
    des Werks — ohne sie hießen zwei Einträge gleich (Sailor Moon Eternal Teil 1 und 2). Die Regel
    gilt dem Yu-Gi-Oh-Fall: ein Titel für die ganze Serie mit dem Namen eines Blocks.
  */
  const nummerImEintrag = (t: Title, nr: string) =>
    [t.titleEn, t.titleRomaji].some((s) => new RegExp(`(part|teil|vol\\.?|volume)\\s*${nr}\\s*$`, 'i').test(s ?? ''))
  const mitTeilnummer = alleTitel.filter((t) => {
    const m = /[–—-]\s*(staffel|season|vol\.?|teil|part)\s*(\d+)\s*$/i.exec(t.titleDe ?? '')
    return m && !nummerImEintrag(t, m[2]!)
  })
  pruefe(
    'kein Titel traegt die Nummer eines seiner Teile im Namen',
    mitTeilnummer.length === 0,
    mitTeilnummer.map((t) => t.titleDe).slice(0, 5),
  )

  /**
   * Die Gegenrichtung: Beim **Release** gehoert die Nummer hin. Sie sagt,
   * welcher Teil erscheint -- ohne sie stuenden zwei gleichnamige Termine
   * untereinander.
   */
  const rohR = lies('public/data/releases.json') as Array<{
    titleId: number
    name: string
    platform: string
  }>
  type KurzRelease = { titleId: number; name: string; platform: string }
  const releasesR: KurzRelease[] = Array.isArray(rohR)
    ? rohR
    : (Object.values(rohR) as KurzRelease[])
  const yugi = releasesR.filter((r) => r.titleId === 481 && r.platform === "disneyplus")
  pruefe(
    'die beiden Yu-Gi-Oh-Ausgaben behalten ihre Staffelnummern',
    yugi.length === 0 ||
      (yugi.some((r) => /Staffel 2/.test(r.name)) && yugi.some((r) => /Staffel 3/.test(r.name))),
    yugi.map((r) => r.name),
  )
}
/*
  **Eine Ausgabe ohne Deutsch steht nur neben einer mit Deutsch — und nie selbst als Verweis.**

  `ausgabenOhneDe` zeigt eine zweite Ausgabe beim selben Anbieter durchgestrichen
  (Digimon, 14.09.2026). Ohne deutschen Verweis daneben wäre sie ein belegtes
  Nein durch die Hintertür, und als Verweis zugleich stünde sie zweimal da, einmal
  mit „DE ?" und einmal durchgestrichen. Gilt auch für einen Datensatz ohne einen
  einzigen solchen Fall.
*/
{
  const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[] | Record<string, Title>
  const alle = Array.isArray(roh) ? roh : Object.values(roh)
  const kern =(u: string) => /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,26})/i.exec(u)?.[1] ?? u
  const falsch = alle.filter((t) =>
    (t.ausgabenOhneDe ?? []).some(
      (a) =>
        (t.streams ?? []).some((s) => kern(s.url) === kern(a.url)) ||
        !(t.streams ?? []).some((s) => s.platform === a.platform && s.dub === true),
    ),
  )
  pruefe(
    'eine Ausgabe ohne Deutsch steht nur neben einer mit Deutsch und nie selbst als Verweis',
    falsch.length === 0,
    falsch.map((t) => t.id),
  )
}

/* Ein von Hand geprüfter deutscher Titel zeigt auf einen Titel im Bestand und wird dort nicht überschrieben (der Rest steht in check-logic.ts). */
{
  const hand = ladeTitelDe()
  const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[] | Record<string, Title>
  const alle = Array.isArray(roh) ? roh : Object.values(roh)
  const nachId = new Map(alle.map((t) => [t.id, t]))
  const unbekannt = hand.filter((e) => !nachId.has(e.id))
  pruefe('jeder Handtitel zeigt auf einen Titel im Bestand', unbekannt.length === 0, unbekannt.map((e) => e.id))
  const ueberschrieben = hand.filter((e) => {
    const vorhanden = nachId.get(e.id)?.titleDe
    return vorhanden !== undefined && vorhanden !== e.titleDe
  })
  pruefe('kein Handtitel wurde im Datensatz durch eine Datenbank ersetzt', ueberschrieben.length === 0, ueberschrieben.map((e) => `${e.id}: ${nachId.get(e.id)?.titleDe} statt ${e.titleDe}`))
}

{
  const titelIds = new Set((JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as { id: number }[]).map((t) => t.id))
  pruefe('TV-Handnamen: jede Kennung gibt es im Bestand (sonst hängt eine Sendung an einem toten Titel)', Object.values(TV_NAMEN).every((id) => titelIds.has(id)))
}
{
  const lies = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as { id: number }[]
  const ids = new Set([...lies('public/data/titles.json'), ...lies('public/data/ohne-synchro.json')].map((t) => t.id))
  const nein = ohneSynchroVonHand()
  pruefe('Ohne Synchro von Hand: jeder Eintrag hat eine Quelle und gehört zu einem Titel des Bestands (sonst wirkt er nirgends)', nein.size >= 7 && [...nein].every((id) => ids.has(id)), [...nein].filter((id) => !ids.has(id)).join(','))
}
{
  // Jedes Handurteil „nein" steht nicht im Hauptbestand und trägt hinter dem Toggle `ohneSynchro:true`.
  // Ausnahme: ein Titel mit Release (belegter deutscher Termin) bleibt im Hauptbestand — `10-termine.ts` überspringt ihn vor dem Handurteil.
  const lies = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as { id: number; ohneSynchro?: boolean }[]
  const haupt = new Set(lies('public/data/titles.json').map((t) => t.id))
  const hinter = new Map(lies('public/data/ohne-synchro.json').map((t) => [t.id, t]))
  const mitRelease = new Set((JSON.parse(readFileSync('public/data/releases.json', 'utf8')) as { titleId: number }[]).map((r) => r.titleId))
  const fehler = [...ohneSynchroVonHand()].filter((id) => !mitRelease.has(id) && (haupt.has(id) || hinter.get(id)?.ohneSynchro !== true))
  pruefe('Ohne Synchro von Hand: jedes Handurteil „nein" steht nicht im Hauptbestand und trägt hinter dem Toggle ohneSynchro:true (außer mit belegtem deutschem Release)', fehler.length === 0, fehler.map((id) => `${id} ${haupt.has(id) ? 'im Hauptbestand' : hinter.has(id) ? 'ohne ohneSynchro-Marke' : 'fehlt hinter dem Toggle'}`).join('; '))
}
{
  /* Gegenprobe am echten Bestand: Jede Folgendatei steht nach der Übersetzung auch im Verzeichnis, und umgekehrt. */
  const { akVon } = ladeAkVon('data/kennungen.json')
  const dateien = readdirSync('public/data/folgen').filter((f) => /^\d+\.json$/.test(f)).map((f) => akVon(Number(f.slice(0, -5))))
  const index = new Set(uebersetzeDatei('folgen/index.json', JSON.parse(readFileSync('public/data/folgen/index.json', 'utf8')) as number[], akVon) as number[])
  pruefe('Folgenverzeichnis deckt jede Folgendatei (nach Übersetzung)', dateien.length === index.size && dateien.every((k) => index.has(k)), `${dateien.length} Dateien, ${index.size} im Verzeichnis`)
}
{
  const hier = readFileSync('public/data/releases.json', 'utf8')
  pruefe('Zusicherung: releases.json enthält keinen aniSearch-Suchlink', keinAnisearchSuchlink([{ datei: 'releases.json', text: hier }]).length === 0)
}
{
  const lies = (f: string) => JSON.parse(readFileSync(f, 'utf8')) as Title[]
  /* Geprüft wird der Hauptbestand (aniSearch- und AniList-Titel) gegen alle AniList-Titel; die aniSearch-Katalogtitel hinter dem Toggle zählt der Befund nicht. */
  const alle = [...lies('public/data/titles.json'), ...lies('public/data/ohne-synchro.json').filter((t) => t.id < 10_000_000)]
  const eintraege = JSON.parse(readFileSync('data/anisearch-eintraege.json', 'utf8')) as Record<string, { mal?: number }>
  const meldungen = malDubletten(alle, eintraege, todayIso())
  pruefe('MAL-Dublette: im ausgelieferten Datensatz trägt kein aniSearch-Titel die MAL eines AniList-Titels ohne dokumentierte Ausnahme', meldungen.length === 0, meldungen)
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
