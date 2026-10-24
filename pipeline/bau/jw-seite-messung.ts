/**
 * Unsere eigene Messung je Weg für die JustWatch-Seitenregel (`jw-seite-ton.ts`): Handbeleg vor Meldung der Erweiterung vor
 * Messurteil (Reihenfolge wie in `build.ts`: Handbelege haben Vorrang). „Nicht verfügbar“ sagt nichts über den Ton und zählt nicht.
 */
import type { StreamLink, Title } from '../../shared/types.ts'
import { hatDeutschenTon } from '../../shared/sprachen-ton.ts'
import type { DubCheck } from '../lib/dub-confirmed.ts'
import { seitenSchluessel } from '../lib/jw-seite.ts'
import { ohneStaffelMarke } from '../../shared/adresse-kern.ts'
import type { Messung, NeinAdresse } from './jw-seite-ton.ts'

export interface MeldungRoh {
  titleId: number
  plattform: string
  folgen: { sprachen?: string[] }[]
}

/** Gilt ein Beleg mit Adresse für diesen Weg? Ohne Adresse gilt er dem ganzen Anbieter. */
function trifft(roh: string | undefined, s: StreamLink): boolean {
  const url = roh === undefined ? roh : ohneStaffelMarke(roh)
  if (!url) return true
  return url === s.url || url === s.seite || (seitenSchluessel(url) !== undefined && seitenSchluessel(url) === seitenSchluessel(s.url))
}

function ausHandbelegen(checks: DubCheck[], s: StreamLink): Messung {
  const passend = checks.filter((c) => trifft(c.url, s))
  const ja = passend.find((c) => c.dub === true || (c.dubRanges ?? []).some((r) => r.dub))
  if (ja) return { urteil: 'ja', quelle: `Handbeleg ${ja.checkedAt}` }
  const nein = passend.find((c) => c.dub === false)
  return nein ? { urteil: 'nein', quelle: `Handbeleg ${nein.checkedAt}` } : undefined
}

function ausMeldungen(meldungen: [string, MeldungRoh][], s: StreamLink): Messung {
  const passend = meldungen.filter(([url]) => trifft(url, s) && url !== '')
  const mitTon = passend.filter(([, m]) => m.folgen.some((f) => (f.sprachen ?? []).length))
  if (!mitTon.length) return undefined
  const ja = mitTon.some(([, m]) => m.folgen.some((f) => hatDeutschenTon(f.sprachen ?? [])))
  return { urteil: ja ? 'ja' : 'nein', quelle: `Meldung der Erweiterung ${mitTon[0]![0]}` }
}

/** Messurteile je Folge (`id|plattform|folge`): ein „deutsch“ reicht für ja, sonst sagt jedes „kein deutsch“ nein. */
function urteilsZahlen(urteile: Record<string, { urteil?: string }>): Map<string, { ja: number; nein: number }> {
  const je = new Map<string, { ja: number; nein: number }>()
  for (const [schluessel, u] of Object.entries(urteile)) {
    const [id, plattform] = schluessel.split('|')
    const z = je.get(`${id}|${plattform}`) ?? { ja: 0, nein: 0 }
    if (u.urteil === 'deutsch') z.ja++
    if (u.urteil === 'kein deutsch') z.nein++
    je.set(`${id}|${plattform}`, z)
  }
  return je
}

function gruppiere<T>(liste: T[], schluessel: (x: T) => string): Map<string, T[]> {
  const je = new Map<string, T[]>()
  for (const x of liste) {
    const k = schluessel(x)
    const vorhanden = je.get(k)
    if (vorhanden) vorhanden.push(x)
    else je.set(k, [x])
  }
  return je
}

/** Die Messung je Weg aus Handbelegen, Meldungen (`prime-zugeordnet.json`, auch Netflix und Disney+) und Messurteilen. */
export function messungAusBelegen(
  checks: DubCheck[],
  urteile: Record<string, { urteil?: string }>,
  meldungen: Record<string, MeldungRoh>,
): (t: Title, s: StreamLink) => Messung {
  const checksJe = gruppiere(checks, (c) => `${c.anilistId}|${c.platform}`)
  const meldungenJe = gruppiere(Object.entries(meldungen), ([, m]) => `${m.titleId}|${m.plattform}`)
  const urteilJe = urteilsZahlen(urteile)
  return (t, s) => {
    const k = `${t.id}|${s.platform}`
    const hand = ausHandbelegen(checksJe.get(k) ?? [], s)
    if (hand) return hand
    const meldung = ausMeldungen(meldungenJe.get(k) ?? [], s)
    if (meldung) return meldung
    const z = urteilJe.get(k)
    if (z?.ja) return { urteil: 'ja', quelle: `Messurteil (${z.ja} Folgen deutsch)` }
    return z?.nein ? { urteil: 'nein', quelle: `Messurteil (${z.nein} Folgen kein deutsch)` } : undefined
  }
}

/** Handbelege „nur Untertitel“ mit Adresse: Der Bau entfernt ihren Weg, der Widerspruch zu JustWatch bleibt sichtbar. */
export function neinAdressenAus(checks: DubCheck[]): NeinAdresse[] {
  return checks
    .filter((c) => c.dub === false && c.url)
    .map((c) => ({ id: c.anilistId, platform: c.platform, url: c.url!, quelle: `Handbeleg ${c.checkedAt}` }))
}
