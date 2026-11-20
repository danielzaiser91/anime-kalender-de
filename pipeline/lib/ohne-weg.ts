/**
 * **Warum ein Titel keinen Streaming-Weg hat — nur mit Beleg** (18.11.2026, `ohne-weg.json`). Wer kein Beleg trägt, steht als `offen` da.
 *
 * Reihenfolge: Start in der Zukunft, Handbeleg „nur Originalton“, JustWatch „nur Kauf/Leihe“, Film ohne Streaming-Angebot bei JustWatch,
 * Abo bei JustWatch ohne deutschen Ton, schon erschienene Disc ohne Streaming-Fund, zuletzt frischer JustWatch-Befund ohne Treffer.
 * Nie ein Grund: ein künftiger **Disc**-Termin allein (Blu-ray-Bundles) und ein veralteter oder verfehlter JustWatch-Befund.
 * `ohneTreffer` (der Titel wurde dort nicht gefunden) ist kein Beleg „laut JustWatch“, nur „bei der Prüfung nichts gefunden“: mit erschienener Disc
 * `nur-disc`, sonst (ohne gleichnamigen Kandidaten) `kein-angebot` (19.11.2026; Stichprobe: ~91 % fehlen dort wirklich, Bericht jw-kein-treffer-2026-11-19.md).
 */
import type { OhneWegEintrag } from '../../shared/ohne-weg.ts'
import { ohneStreamingWeg } from '../../shared/ohne-weg.ts'
import type { Title } from '../../shared/types.ts'
import { dubKey, neinHandbelege, urteilVon, type DubCheck } from './dub-confirmed.ts'
import { geteilteJwKennungen } from './jw-kennung-fremd.ts'
import { BEFUND_MAX_TAGE, type JwBefund } from './jw-vertrauen.ts'
import { alleAngebote, befundGilt } from './jw-seite.ts'
import { aboAndereStaffel } from './ohne-weg-staffel.ts'
import { aboOhneDeutsch, discErschienen, jwKeinTreffer, jwOhneStream, KAUF } from './ohne-weg-belege.ts'

type Handbeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges' | 'juengstesUrteil' | 'checkedAt'>
type Termin = { titleId: number; platform: string; date: string }

export interface OhneWegEingabe {
  titel: Pick<Title, 'id' | 'format' | 'streams' | 'watchLinks' | 'franchiseId' | 'jpStart'>[]
  termine: Termin[]
  handbelege: Handbeleg[]
  justwatch: Record<string, JwBefund>
  /** Die deutschen Disc-Ausgaben je Titel (`data/disc-ausgaben.json`, aniSearch); nur das Datum zählt hier. */
  discAusgaben: Record<string, { datum?: string }[]>
  /** Die Staffelnummer je Titel in seiner Reihe (`staffelDesTitels`); fehlt sie, gibt es keinen Grund `abo-andere-staffel`. */
  staffelNr?: Record<number, number | undefined>
  heute: string
}

/** Der erste künftige Starttag, wenn noch gar nichts erschienen ist (Disc-Termine zählen nicht: sie sind kein Streaming-Start). */
export function ersterStart(termine: readonly Termin[], heute: string): string | undefined {
  const stream = termine.filter((e) => e.platform !== 'disc')
  if (stream.some((e) => e.date < heute)) return undefined
  return stream.map((e) => e.date).sort()[0]
}

/**
 * Der eigene Starttag des Titels (`jpStart`), wenn er heute oder später liegt und kein Stream-Termin existiert: Cartoons tragen ihren Start nur dort
 * (Living the Dream, Netflix 18.12.2026); ohne diesen Zweig hieß ein noch nicht erschienener Titel „kein Angebot“ oder `offen`. Nur ein voller Tag zählt.
 */
export function startOhneTermin(jpStart: string | undefined, termine: readonly Termin[], heute: string): string | undefined {
  if (!jpStart || !/^\d{4}-\d\d-\d\d$/.test(jpStart) || jpStart < heute) return undefined
  return termine.some((e) => e.platform !== 'disc') ? undefined : jpStart
}

/**
 * Der Tag, an dem ein Handbeleg „nur Originalton“ belegt hat — und nur, wenn kein Beleg desselben Titels deutsch sagt
 * und `neinHandbelege` das Nein gelten lässt (überholte Neins und Sammelseiten zählen dort nicht). Ein „nicht verfügbar“ ist kein Originalton-Beleg.
 */
export function originaltonAm(checks: readonly Handbeleg[]): string | undefined {
  if (checks.some((c) => urteilVon(c) === 'ja')) return undefined
  const gilt = neinHandbelege([...checks])
  /* Eine verschmolzene Zeile mit `dub: false` und jüngerem `available: false` (Goblin Slayer, Prime) trägt den Tag der Seitenprüfung, nicht den des Originalton-Belegs: sie zählt nicht. */
  const tage = checks
    .filter((c) => c.dub === false && c.available !== false && urteilVon(c) === 'nein' && gilt.has(dubKey(c.anilistId, c.platform)))
    .map((c) => c.checkedAt ?? '')
    .filter(Boolean)
  return tage.sort().at(-1)
}

/**
 * Ein JustWatch-Befund, der dem Titel wirklich zugeordnet ist und etwas über heute sagt: `befundGilt` (gefunden, nicht verfehlt, jünger als `BEFUND_MAX_TAGE`,
 * wie der Bau ihn überall liest) und die Kennung gehört keinem zweiten Titel. Ein älterer Befund trägt keinen Grund, der Titel bleibt `offen`.
 */
export function jwZugeordnet(b: JwBefund | undefined, geteilt: ReadonlySet<string>, heute: string): b is JwBefund {
  return befundGilt(b, heute) && !geteilt.has(b.jwId!)
}

function jeKennung<T>(liste: readonly T[], id: (x: T) => number): Map<number, T[]> {
  const m = new Map<number, T[]>()
  for (const x of liste) (m.get(id(x)) ?? m.set(id(x), []).get(id(x))!).push(x)
  return m
}

/** Der Grund eines einzelnen Titels ohne Weg. */
function grundVon(
  t: OhneWegEingabe['titel'][number],
  e: { termine: Termin[]; checks: Handbeleg[]; roh: JwBefund | undefined; geteilt: ReadonlySet<string>; ausgaben: { datum?: string }[]; heute: string; staffelNr?: number; geschwisterMitWeg?: boolean },
): OhneWegEintrag {
  const ab = ersterStart(e.termine, e.heute)
  if (ab) return { reason: 'angekuendigt', ab, source: 'termin' }
  const start = startOhneTermin(t.jpStart, e.termine, e.heute)
  if (start) return { reason: 'angekuendigt', ab: start, source: 'start' }
  const original = originaltonAm(e.checks)
  if (original) return { reason: 'kein-dub', checkedAt: original, source: 'handbeleg' }
  /* Ein Handbeleg „deutsch“ widerspricht „kein Stream gefunden“ und „Stream ohne deutschen Ton“. */
  const handbelegJa = e.checks.some((c) => urteilVon(c) === 'ja')
  const jw = jwZugeordnet(e.roh, e.geteilt, e.heute) ? e.roh : undefined
  const angebote = jw?.angebote ?? []
  if (jw && angebote.length && angebote.every((a) => KAUF.has(a.art))) return { reason: 'nur-kauf', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jw && !angebote.length && t.format === 'MOVIE') return { reason: 'film-ohne-abo', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (handbelegJa) return { reason: 'offen' }
  if (jw && aboOhneDeutsch(jw)) return { reason: 'abo-ohne-ton', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jw && aboAndereStaffel(jw, e.staffelNr, !!e.geschwisterMitWeg)) return { reason: 'abo-andere-staffel', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jwOhneStream(e.roh, e.geteilt, e.heute) && discErschienen(e.ausgaben, e.termine, e.heute)) return { reason: 'nur-disc', checkedAt: e.roh.geprueftAm, source: 'disc' }
  /* Schwächer als jede Disc und jeder Befund mit Angebot: JustWatch kennt den Titel nicht (`ohneTreffer`) oder führt ihn ohne jedes Angebot (auch ohne Staffel-Angebote), das heißt „nichts gefunden“. */
  if (jw && !jw.namenTreffer && !alleAngebote(jw).length) return { reason: 'kein-angebot', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jwKeinTreffer(e.roh, e.heute)) return { reason: 'kein-angebot', checkedAt: e.roh.geprueftAm, source: 'justwatch' }
  return { reason: 'offen' }
}

/** Kennung → Grund, für jeden Titel ohne Streaming-Weg genau einer. */
export function baueOhneWeg(eingabe: OhneWegEingabe): Record<number, OhneWegEintrag> {
  const termine = jeKennung(eingabe.termine, (x) => x.titleId)
  const checks = jeKennung(eingabe.handbelege, (x) => x.anilistId)
  const geteilt = new Set(geteilteJwKennungen(eingabe.justwatch).keys())
  /* Reihen, in denen ein Titel einen Streaming-Weg trägt; der Titel selbst hat keinen (sonst käme er hier nicht an). */
  const reihenMitWeg = new Set(eingabe.titel.filter((t) => t.franchiseId !== undefined && !ohneStreamingWeg(t)).map((t) => t.franchiseId))
  const aus: Record<number, OhneWegEintrag> = {}
  for (const t of eingabe.titel) {
    if (!ohneStreamingWeg(t)) continue
    aus[t.id] = grundVon(t, {
      termine: termine.get(t.id) ?? [],
      checks: checks.get(t.id) ?? [],
      roh: eingabe.justwatch[t.id],
      geteilt,
      ausgaben: eingabe.discAusgaben[t.id] ?? [],
      heute: eingabe.heute,
      staffelNr: eingabe.staffelNr?.[t.id],
      geschwisterMitWeg: reihenMitWeg.has(t.franchiseId),
    })
  }
  return aus
}

/**
 * Titel, die `offen` bleiben, obwohl eine Disc erschienen ist und ein (nicht verfehlter) JustWatch-Befund vorliegt, der nur wegen seines Alters
 * (ab `BEFUND_MAX_TAGE`) nichts mehr trägt — für die Logzeile: so wird die stille Rückkehr nach `offen` sichtbar.
 */
export function zaehleVeralteteBefunde(eingabe: OhneWegEingabe, eintraege: Record<number, OhneWegEintrag>): number {
  const termine = jeKennung(eingabe.termine, (x) => x.titleId)
  const alt = (b: JwBefund | undefined) => !!b && !b.verfehltAm && !b.namenTreffer && (Date.parse(eingabe.heute) - Date.parse(b.geprueftAm)) / 86_400_000 >= BEFUND_MAX_TAGE
  return Object.entries(eintraege).filter(
    ([id, x]) => x.reason === 'offen' && alt(eingabe.justwatch[id]) && discErschienen(eingabe.discAusgaben[id] ?? [], termine.get(Number(id)) ?? [], eingabe.heute),
  ).length
}

/**
 * Obergrenze der Titel mit Grund `offen` (Stand `public/data` und `data/justwatch-audio.json` nach main 86903e13d, `heute` 2026-11-19: 569 von 1.056 Titeln ohne Weg, vor `abo-ohne-ton` und `nur-disc` 913;
 * Luft 31). Ohne Erneuerung der JustWatch-Befunde (Wochenlauf, eigener PR) steigt `offen`, weil jeder Befund nach 28 Tagen den Grund verliert: gemessen mit `heute`
 * 2026-11-23 764, 2026-12-05 822. Die Warnzeile ist dann gewollt; die Grenze wird nicht angehoben, sondern sinkt mit jedem nachgetragenen Beleg.
 */
export const OFFEN_HOECHSTENS = 600
