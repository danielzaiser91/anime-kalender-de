/**
 * **Warum ein Titel keinen Streaming-Weg hat — nur mit Beleg** (18.11.2026, `ohne-weg.json`). Wer kein Beleg trägt, steht als `offen` da.
 *
 * Reihenfolge: Start in der Zukunft, Handbeleg „nur Originalton“, JustWatch „nur Kauf/Leihe“, Film ohne Streaming-Angebot bei JustWatch,
 * Abo bei JustWatch ohne deutschen Ton, schon erschienene Disc ohne Streaming-Fund.
 * Nie ein Grund: ein künftiger **Disc**-Termin allein (Blu-ray-Bundles) und ein veralteter oder verfehlter JustWatch-Befund.
 * `ohneTreffer` (der Titel wurde dort nicht gefunden — eine Zuordnungslücke) ist kein Beleg „laut JustWatch“; es trägt nur zusammen mit einer
 * erschienenen Disc den Grund `nur-disc`, dessen Satz JustWatch nicht nennt.
 */
import type { OhneWegEintrag } from '../../shared/ohne-weg.ts'
import { ohneStreamingWeg } from '../../shared/ohne-weg.ts'
import type { Title } from '../../shared/types.ts'
import { dubKey, neinHandbelege, urteilVon, type DubCheck } from './dub-confirmed.ts'
import { geteilteJwKennungen } from './jw-kennung-fremd.ts'
import type { JwBefund } from './jw-vertrauen.ts'
import { befundGilt } from './jw-seite.ts'
import { aboOhneDeutsch, discErschienen, jwOhneStream, KAUF } from './ohne-weg-belege.ts'

type Handbeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges' | 'juengstesUrteil' | 'checkedAt'>
type Termin = { titleId: number; platform: string; date: string }

export interface OhneWegEingabe {
  titel: Pick<Title, 'id' | 'format' | 'streams' | 'watchLinks'>[]
  termine: Termin[]
  handbelege: Handbeleg[]
  justwatch: Record<string, JwBefund>
  /** Die deutschen Disc-Ausgaben je Titel (`data/disc-ausgaben.json`, aniSearch); nur das Datum zählt hier. */
  discAusgaben: Record<string, { datum?: string }[]>
  heute: string
}

/** Der erste künftige Starttag, wenn noch gar nichts erschienen ist (Disc-Termine zählen nicht: sie sind kein Streaming-Start). */
export function ersterStart(termine: readonly Termin[], heute: string): string | undefined {
  const stream = termine.filter((e) => e.platform !== 'disc')
  if (stream.some((e) => e.date < heute)) return undefined
  return stream.map((e) => e.date).sort()[0]
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
  e: { termine: Termin[]; checks: Handbeleg[]; roh: JwBefund | undefined; geteilt: ReadonlySet<string>; ausgaben: { datum?: string }[]; heute: string },
): OhneWegEintrag {
  const ab = ersterStart(e.termine, e.heute)
  if (ab) return { reason: 'angekuendigt', ab, source: 'termin' }
  const original = originaltonAm(e.checks)
  if (original) return { reason: 'kein-dub', checkedAt: original, source: 'handbeleg' }
  const jw = jwZugeordnet(e.roh, e.geteilt, e.heute) ? e.roh : undefined
  const angebote = jw?.angebote ?? []
  if (jw && angebote.length && angebote.every((a) => KAUF.has(a.art))) return { reason: 'nur-kauf', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jw && !angebote.length && t.format === 'MOVIE') return { reason: 'film-ohne-abo', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jw && aboOhneDeutsch(jw)) return { reason: 'abo-ohne-ton', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jwOhneStream(e.roh, e.geteilt, e.heute) && discErschienen(e.ausgaben, e.termine, e.heute)) return { reason: 'nur-disc', checkedAt: e.roh.geprueftAm, source: 'disc' }
  return { reason: 'offen' }
}

/** Kennung → Grund, für jeden Titel ohne Streaming-Weg genau einer. */
export function baueOhneWeg(eingabe: OhneWegEingabe): Record<number, OhneWegEintrag> {
  const termine = jeKennung(eingabe.termine, (x) => x.titleId)
  const checks = jeKennung(eingabe.handbelege, (x) => x.anilistId)
  const geteilt = new Set(geteilteJwKennungen(eingabe.justwatch).keys())
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
    })
  }
  return aus
}

/**
 * Obergrenze der Titel mit Grund `offen` (Stand `public/data` und `data/justwatch-audio.json` auf main 8a0a57694, 19.11.2026: 537 von 1.056 Titeln ohne Weg, vor `abo-ohne-ton` und `nur-disc` 913;
 * Luft 63, weil ein JustWatch-Befund nach 28 Tagen ohne Erneuerung den Grund wieder verliert); sinkt mit jedem nachgetragenen Beleg, dann wird sie nachgezogen.
 */
export const OFFEN_HOECHSTENS = 600
