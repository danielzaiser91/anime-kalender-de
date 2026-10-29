/**
 * **Zwei Regeln für den Antwort-Kasten** — ausgelagert, weil `berechneAntwort`
 * die Längengrenze reißt (`tools/umfang-pruefen.mjs`).
 */
import { anzeigeFolge, istErschienen, releaseStatus } from '@shared/logic.ts'
import { formatDate, todayIso, weekdayName } from '@shared/time.ts'
import type { Release, ReleaseEvent, Title, WatchLink } from '@shared/types.ts'
import type { Antwort } from './antwort-typ.ts'

/**
 * **Gezählt werden Folgen, nicht Termine**.
 *
 * Ein Komplettabwurf ist **ein** Termin, aber N Folgen. Vorher zählte die
 * Schleife Ereignisse — ein ADN-Block mit 12 Folgen stand nach dem Start als
 * „1 von 12 erschienen" da. Wöchentliche Termine tragen je eine Folge, dort
 * ändert die Summe nichts.
 */
export function zaehleErschienen(events: ReleaseEvent[], jetzt: Date = new Date()): number {
  const nummern = new Set<number>()
  let ohneNummer = 0
  for (const e of events) {
    if (!istErschienen(e, jetzt)) continue
    if (e.episode != null) nummern.add(e.episode)
    else ohneNummer += e.episodeCount ?? 1
  }
  return nummern.size + ohneNummer
}

/**
 * **Ein Anbieter zählt für sich, der Kasten nimmt den weitesten.** Dieselbe Folge liegt bei
 * Crunchyroll und Netflix: Beide zu addieren schrieb „27 von 24 Folgen erschienen" (Das Band der
 * Unterwelt, 10.10.2026). Mehrere Releases eines Anbieters (Folge 1 als Abwurf, 2–12 im Wochentakt)
 * addieren sich weiter.
 */
export function zaehleErschienenJeAnbieter(events: ReleaseEvent[], jetzt: Date = new Date()): number {
  const jeAnbieter = new Map<string, ReleaseEvent[]>()
  for (const e of events) jeAnbieter.set(e.platform, [...(jeAnbieter.get(e.platform) ?? []), e])
  return Math.max(0, ...[...jeAnbieter.values()].map((l) => zaehleErschienen(l, jetzt)))
}

/**
 * **„Nächste Folge" ist eine, die noch nirgends erschienen ist.** Hat Crunchyroll Folge 15 schon
 * gebracht, ist Netflix' Termin für Folge 15 keine neue Folge (Das Band der Unterwelt: „Folge 15
 * erscheint heute"). TV-Sichtungen tragen unsere Zählung, keine belegte Nummer — sie entscheiden nichts.
 */
export function ohneSchonErschienene(offen: ReleaseEvent[], alle: ReleaseEvent[], jetzt: Date = new Date()): ReleaseEvent[] {
  const da = new Set(alle.filter((e) => anzeigeFolge(e) && istErschienen(e, jetzt)).map((e) => e.episode))
  return offen.filter((e) => !anzeigeFolge(e) || !da.has(e.episode))
}

/**
 * **Ein abgeschlossenes, vollständig deutsches Werk ist die feste Wahrheit.**
 *
 * „86: Eighty Six" liegt seit 2021 vollständig auf Deutsch vor; im Oktober 2026
 * nimmt ADN dieselben Folgen als Komplettabwurf ins Angebot. Der Kasten las den
 * künftigen Termin als Sendeplan und schrieb „0 von 12 Folgen erschienen ·
 * Wöchentlich" über eine fertige Serie.
 *
 * Ein späterer Abwurf oder eine Wiederholung überschreibt das nicht. Eine
 * **laufende** Serie bleibt unberührt — dort sind die künftigen Folgen wirklich
 * noch offen.
 */
export function istBelegtAbgeschlossen(
  hatSynchro: boolean,
  vollstaendig: boolean,
  abgeschlossen: boolean,
  events: ReleaseEvent[],
  jetzt: Date = new Date(),
): boolean {
  return hatSynchro && vollstaendig && abgeschlossen && !deutscherWochentaktLaeuft(events, jetzt)
}

/**
 * **Ein wöchentlicher deutscher Release mittendrin ist keine fertige Synchro.**
 * Folge 1 erschienen, die übrigen erst angekündigt: Ein `dub: true` ohne
 * Folgenbereiche hieße sonst „alle N Folgen auf Deutsch", sobald Japan fertig
 * ist (Overgeared). Ein Komplettabwurf (86) oder eine TV-Wiederholung läuft
 * nicht im Wochentakt eines Streams und bleibt davon unberührt.
 */
export function deutscherWochentaktLaeuft(events: ReleaseEvent[], jetzt: Date = new Date()): boolean {
  const jeRelease = new Map<string, ReleaseEvent[]>()
  for (const e of events) {
    if (e.releaseType !== 'weekly' || e.platform === 'tv' || e.platform === 'disc') continue
    jeRelease.set(e.releaseSlug, [...(jeRelease.get(e.releaseSlug) ?? []), e])
  }
  return [...jeRelease.values()].some((l) => l.some((e) => istErschienen(e, jetzt)) && l.some((e) => !istErschienen(e, jetzt)))
}

/**
 * **Hat die deutsche Fassung schon begonnen?** Ein Stream mit belegter Tonspur, eine erschienene deutsche Folge oder eine
 * deutsche Erstausgabe mit Tagesdatum bis heute. Ohne eines davon ist ein künftiger Termin eine Premiere, kein Nachschlag
 * (Yaiba: Sprecher belegt, erste TV-Folge am 05.11.2026 — der Kasten sagte „Alle 24 Folgen auf Deutsch“, 21.10.2026).
 */
export function deutschBegonnen(title: Title, erschieneneFolgen: number, heute: string, releases: Release[] = []): boolean {
  if ((title.streams ?? []).some((s) => s.dub === true) || erschieneneFolgen > 0) return true
  const von = title.deErstausgabe?.von
  const aniSearchTag = Boolean(title.deErstausgabe?.synchro && von && /^\d{4}-\d{2}-\d{2}$/.test(von) && von <= heute)
  return aniSearchTag && !ersteDiscNochOffen(releases, heute)
}

/**
 * **Der aniSearch-Tag der deutschen Fassung ist veraltet, wenn Band 1 noch aussteht.** Virgin Road: aniSearch 11.04.2026,
 * die Blu-ray Vol. 1 wurde auf 30.10.2026 verschoben (anime2you), der Kasten sagte „Auf Deutsch“. Ohne erschienene Disc und mit
 * einem künftigen „Vol. 1“ ist der erste deutsche Termin der des Bandes. Ein Box-Neuauflage-Termin (kein „Vol. 1“) zählt nicht.
 */
export function ersteDiscNochOffen(releases: Release[], heute: string): boolean {
  const discs = releases.filter((r) => r.platform === 'disc')
  const datum = (r: Release) => r.schedule?.firstEpisodeDate ?? ''
  return discs.every((r) => datum(r) > heute) && discs.some((r) => /\bVol\.?\s*1\b/.test(r.name))
}

/**
 * **Welche Releases beantworten die Kopffrage?** Streams ohne Disc und Kino-Banner; gibt es keine, fällt der Kopf auf die Disc
 * zurück — außer die deutsche Fassung hat nachweislich begonnen (dann ist die Disc nur eine Kaufausgabe). Ohne Beleg der Synchro
 * zählt alles; mit Synchro-Hinweis, aber ohne begonnene Fassung (Bocchi: nur Sprecher, Vol. 1 am 06.11.), antwortet die Disc.
 */
export function kopfReleases(
  { ohneDisc, releases, imKino, hatSynchro, title, heute }: { ohneDisc: Release[]; releases: Release[]; imKino: (r: Release) => boolean; hatSynchro: boolean; title: Title; heute: string },
): Release[] {
  if (ohneDisc.length) return ohneDisc
  const ohneKino = releases.filter((r) => !imKino(r))
  if (!hatSynchro) return ohneKino
  /* Filme haben ihren eigenen Zweig („film“, Kino); dort bleibt der Kopf wie er war. */
  if (title.format === 'MOVIE' || deutschBegonnen(title, 0, heute, releases)) return []
  return ohneKino.filter((r) => r.releaseType === 'disc')
}

/**
 * **Der Terminsatz im Kopf** — „erscheint am …" bzw. beim Komplettabwurf
 * „im Angebot ab …". Ausgelagert, damit `AntwortKasten` die Längengrenze hält.
 */
export function terminSatz(
  komplett: boolean | undefined,
  rel: string,
  datum: string,
  T: (k: string, v?: Record<string, string | number>) => string,
  mehrzahl = false,
): string {
  if (komplett) {
    return rel
      ? T('antwort.angebotRelativ', { rel, tag: weekdayName(datum), datum: formatDate(datum) })
      : T('antwort.angebotDatum', { tag: weekdayName(datum), datum: formatDate(datum) })
  }
  const verb = mehrzahl ? 'erscheinen' : 'erscheint'
  return rel
    ? T(`antwort.${verb}Relativ`, { rel, tag: weekdayName(datum), datum: formatDate(datum) })
    : T(`antwort.${verb}Datum`, { tag: weekdayName(datum), datum: formatDate(datum) })
}

/**
 * **Japans Ende ist nicht das deutsche.** AniList führt für Slime Staffel 4 das Ende 25.09.2026, Crunchyroll
 * zeigt die Folgen bis 16.10. und hatte am 03.10. erst 22 von 24. Die Prime-Pille schrieb dort „24 Fg.",
 * weil der Titel nach Japans Ende als abgeschlossen galt. Abgeschlossen ist er erst, wenn auch kein
 * deutscher Wochentermin mehr läuft.
 */
export function deutschAbgeschlossen(title: Title, releases: Release[], today: string): boolean {
  const japan = title.jpEnd ? title.jpEnd < today : Boolean(title.jpYear && title.jpYear < Number(today.slice(0, 4)))
  if (!japan) return false
  return !releases.some((r) => r.releaseType === 'weekly' && r.platform !== 'disc' && r.platform !== 'tv' && releaseStatus(r, today) === 'airing')
}

/**
 * **Die abgeleitete Folgenzahl einer Pille ohne Bereiche am Weg**: bei deutsch abgeschlossener Serie die
 * Folgenzahl des Werks (AniList `episodes`). Kein Beleg für diesen Weg, nur die Annahme „alles liegt dort".
 */
export function abgeleiteteFolgen(title: Title, releases: Release[], today: string): number | undefined {
  return deutschAbgeschlossen(title, releases, today) ? title.episodes : undefined
}

/** Der Kopf, wenn keine Zeile die Sprache belegt: dieselbe Aussage wie die Blase „Deutsch laut Anbieter“ an der Pille. */
export function kopfSchluesselOhneBeleg(art: true | 'omu' | 'anbieter'): 'antwort.nurUntertitel' | 'detail.statusAnbieter' | 'antwort.sprachOffen' {
  return art === 'omu' ? 'antwort.nurUntertitel' : art === 'anbieter' ? 'detail.statusAnbieter' : 'antwort.sprachOffen'
}

/** Der Tooltip an „Auf Deutsch seit …“: woher das Datum stammt. */
export function deSeitQuelleSchluessel(quelle: 'wikipedia' | 'disc' | undefined): 'antwort.deSeitWikipedia' | 'antwort.deSeitDisc' | 'antwort.deSeitQuelle' {
  return quelle === 'wikipedia' ? 'antwort.deSeitWikipedia' : quelle === 'disc' ? 'antwort.deSeitDisc' : 'antwort.deSeitQuelle'
}

/** Letzte Folgennummer einer angenommenen Folgenzahl (0 ohne Annahme). */
function angenommeneLetzte(r: Release | undefined): number {
  const s = r?.schedule
  return s?.episodeCountAssumed && s.episodeCount ? (s.firstEpisodeNumber ?? 1) + s.episodeCount - 1 : 0
}

/**
 * **Kündigt eine Plattform mehr Folgen an, als die Datenbank für Japan kennt, gilt für die deutsche Fassung die
 * Ankündigung** (Villainess, 18.10.2026: AniList 11, Wochenplan Folge 12) — als Annahme, `gesamtGeschaetzt` kennzeichnet sie.
 */
export function angekuendigteLaenge(title: Title, releases: Release[]): number {
  return Math.max(0, ...releases.map(angenommeneLetzte).filter((n) => n > (title.episodes ?? Infinity)))
}

/** Stammt die Gesamtzahl nur aus der fortgeschriebenen Folgenzahl des laufenden Release? */
export function gesamtGeschaetzt(title: Title, releases: Release[], n: ReleaseEvent): boolean {
  const r = releases.find((x) => x.slug === n.releaseSlug)
  return Boolean(r?.schedule.episodeCountAssumed) && (!title.episodes || angenommeneLetzte(r) > title.episodes)
}

/** Eine Zahl oder ein Datum, das auf einer geschätzten Folgenzahl beruht, trägt „≈“. */
export function ungefaehr(wert: string | number, geschaetzt: boolean | undefined): string {
  return geschaetzt ? `≈ ${wert}` : String(wert)
}

/**
 * **Die Zahl im „fertig"-Kasten hat denselben Beleg wie die Pille** (11.10.2026): deutsche Bereiche, die das Werk
 * decken, oder der Wochenplan eines Anbieters. Sonst ist „Alle N" nur die Folgenzahl des Werks (Cowboy Bebop) und
 * der Kasten sagt „≈ N" wie die Pille („≈ N Fg.").
 */
export function fertigAntwort(
  raus: number | undefined,
  gesamt: number | undefined,
  belegteFolgen: number,
  events: ReleaseEvent[],
): { art: 'fertig'; raus?: number; gesamt?: number; gesamtAbgeleitet: boolean } {
  const wochenplan = events.some((e) => e.releaseType === 'weekly' && e.platform !== 'tv' && e.platform !== 'disc')
  const belegt = Boolean(gesamt && belegteFolgen >= gesamt) || wochenplan
  return { art: 'fertig', raus, gesamt, gesamtAbgeleitet: !belegt }
}

/** Bis zu welcher Folge die Folgenliste „erschienen" kennt: Nur bei laufender Ausstrahlung ist `raus` eine Folgennummer; bei `fertig` ist es die Zahl der Ereignisse (One Piece: 10) und ließ ab Folge 11 alles ohne Flagge als „noch nicht erschienen" stehen. */
export const erschieneneFuerFolgenliste = (a: { art: string; raus?: unknown } | undefined): number | undefined =>
  a?.art === 'laeuft' && typeof a.raus === 'number' ? a.raus : undefined

/**
 * **Die deutsche Erstausgabe steht in den Neuigkeiten, nicht unter „Auf Deutsch verfügbar"** (Daniel, 07.10.2026: „Text kann weg, der Trenner rückt nach oben;
 * das Datum wandert in die Neuigkeiten, zurückdatiert"). Gilt nur mit Tagesdatum und Synchro-Marke — ohne Datum bleibt die Zeile im Kasten die einzige Spur.
 */
export function erstausgabeAlsNeuigkeit(title: Pick<Title, 'deErstausgabe'> & Partial<Pick<Title, 'angebotSeit' | 'streams'>>, heute = todayIso()): boolean {
  const von = title.deErstausgabe?.von
  if (!title.deErstausgabe?.synchro || !von || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(von) || von > heute) return false
  /* Liegt das Angebot eines Anbieters mit deutscher Tonspur davor, ist die Ausgabe nicht die erste Gelegenheit (wie in `deSeitZeile`). */
  const angebot = title.angebotSeit
  return !(angebot?.date && angebot.date < von && (title.streams ?? []).some((x) => x.platform === angebot.platform && x.dub === true))
}

/** Die Überschrift des „fertig“-Kastens mit Zahl; abgeleitet ohne „Alle“, mit „≈“ (siehe `fertigAntwort`). */
export function fertigZahlText(
  gesamt: number,
  abgeleitet: boolean | undefined,
  T: (k: string, v?: Record<string, string | number>) => string,
): string {
  return abgeleitet ? T('antwort.fertigUngefaehr', { count: ungefaehr(gesamt, true) }) : T('antwort.fertigZahl', { count: gesamt })
}

/** Die Nebenzeile eines „teilweise“-Kastens: die Quelle der deutschen Folgenzahl, sonst der Hinweis auf fehlende Angaben. */
export function teilweiseNeben(
  antwort: Extract<Antwort, { art: 'teilweise' }>,
  T: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (antwort.deFolgen) return T('antwort.deFolgenQuelle', { quelle: antwort.deFolgen.quelle.name, zitat: antwort.deFolgen.zitat })
  return antwort.restBelegt ? '' : T('antwort.teilweiseNeben')
}

/**
 * Die Bereiche eines Kaufwegs, die als **Beleg** zählen (13.10.2026): Videoload und MagentaTV tragen `dubRanges` aus der
 * Annahme (`pipeline/lib/telekom-annahme.ts`), und die ist kein Beleg — sonst zeigt der Kasten bei Devil May Cry „12 von 12“.
 */
export const belegteBereiche = (w: WatchLink): NonNullable<WatchLink['dubRanges']> =>
  w.dubAbgeleitet === 'telekom-annahme' ? [] : (w.dubRanges ?? [])
