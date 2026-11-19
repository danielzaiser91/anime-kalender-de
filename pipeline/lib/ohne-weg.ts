/**
 * **Warum ein Titel keinen Streaming-Weg hat — nur mit Beleg** (18.11.2026, `ohne-weg.json`). Wer kein Beleg trägt, steht als `offen` da.
 *
 * Reihenfolge: Start in der Zukunft, Handbeleg „nur Originalton“, JustWatch „nur Kauf/Leihe“, Film ohne Streaming-Angebot bei JustWatch.
 * Nicht gezählt, weil kein Beleg für „kein Stream“: ein künftiger **Disc**-Termin (Blu-ray-Bundles), JustWatch `ohneTreffer`
 * (der Titel wurde dort nicht gefunden — eine Zuordnungslücke) und ein Abo-Angebot ohne belegten deutschen Ton.
 */
import type { OhneWegEintrag } from '../../shared/ohne-weg.ts'
import { ohneStreamingWeg } from '../../shared/ohne-weg.ts'
import type { Title } from '../../shared/types.ts'
import { dubKey, neinHandbelege, urteilVon, type DubCheck } from './dub-confirmed.ts'
import { geteilteJwKennungen } from './jw-kennung-fremd.ts'
import type { JwBefund } from './jw-vertrauen.ts'
import { befundGilt } from './jw-seite.ts'

type Handbeleg = Pick<DubCheck, 'anilistId' | 'platform' | 'url' | 'dub' | 'available' | 'dubRanges' | 'juengstesUrteil' | 'checkedAt'>
type Termin = { titleId: number; platform: string; date: string }

export interface OhneWegEingabe {
  titel: Pick<Title, 'id' | 'format' | 'streams' | 'watchLinks'>[]
  termine: Termin[]
  handbelege: Handbeleg[]
  justwatch: Record<string, JwBefund>
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

const KAUF = new Set<string | undefined>(['BUY', 'RENT'])

function jeKennung<T>(liste: readonly T[], id: (x: T) => number): Map<number, T[]> {
  const m = new Map<number, T[]>()
  for (const x of liste) (m.get(id(x)) ?? m.set(id(x), []).get(id(x))!).push(x)
  return m
}

/** Der Grund eines einzelnen Titels ohne Weg. */
function grundVon(t: OhneWegEingabe['titel'][number], e: { termine: Termin[]; checks: Handbeleg[]; jw: JwBefund | undefined; heute: string }): OhneWegEintrag {
  const ab = ersterStart(e.termine, e.heute)
  if (ab) return { reason: 'angekuendigt', ab, source: 'termin' }
  const original = originaltonAm(e.checks)
  if (original) return { reason: 'kein-dub', checkedAt: original, source: 'handbeleg' }
  const jw = e.jw
  const angebote = jw?.angebote ?? []
  if (jw && angebote.length && angebote.every((a) => KAUF.has(a.art))) return { reason: 'nur-kauf', checkedAt: jw.geprueftAm, source: 'justwatch' }
  if (jw && !angebote.length && t.format === 'MOVIE') return { reason: 'film-ohne-abo', checkedAt: jw.geprueftAm, source: 'justwatch' }
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
    const b = eingabe.justwatch[t.id]
    aus[t.id] = grundVon(t, { termine: termine.get(t.id) ?? [], checks: checks.get(t.id) ?? [], jw: jwZugeordnet(b, geteilt, eingabe.heute) ? b : undefined, heute: eingabe.heute })
  }
  return aus
}

/**
 * Obergrenze der Titel mit Grund `offen` (Stand `public/data` und `data/justwatch-audio.json` auf main c64adaa17, 18.11.2026: 1.056 von 1.291, davon 94 mit einem JustWatch-Befund
 * über 28 Tage); sinkt mit jedem nachgetragenen Beleg und jeder JustWatch-Erneuerung, dann wird sie nachgezogen.
 */
export const OFFEN_HOECHSTENS = 1056
