/**
 * **Synchro-Beleg am kuratierten Termin — der Weg ohne Handeintrag in `dub-confirmed.yaml`.**
 *
 * Nennt ein Artikel die deutsche Synchro wörtlich, trägt der Termin vier Felder:
 * `dub: true`, `dubQuelle` (eine der `sources`), `dubZitat` (der Satz, wörtlich) und
 * `dubGeprueftAm` (ISO-Datum der Lesung). Daraus wird derselbe Beleg wie aus einer
 * Handprüfung — Haken an der Pille, Verweis auch bei Cartoons. Ein Handbeleg zum selben
 * Anbieter hat Vorrang (Projektregel); fehlt eines der Felder oder passt der Wortlaut nicht,
 * gilt der Termin als nicht belegt, `data:validate` meldet es.
 *
 * Nur ausdrückliche Aussagen: „deutsche Synchronisation", „auf Deutsch". Ein Artikel, der
 * bloß Untertitel oder „Start in Deutschland" nennt, belegt keine Synchro.
 *
 * Bekannte Grenze: Die Wortlaut-Prüfung ist eine Heuristik. `VERNEINT` übersieht Sätze wie „nicht nur
 * auf Englisch, auch auf Deutsch" (fällt durch), und „auf Deutsch" trifft auch „Start auf Deutsch" ohne
 * Synchro-Bezug. Abgefangen wird das nur durch den Handgriff: Das Zitat setzt ein Mensch von Hand.
 */
import type { CuratedEntry } from './curated.ts'
import type { DubCheck } from './dub-confirmed.ts'
/** Wie `dubKey()` in dub-confirmed.ts — dort nicht importiert, damit die Module keinen Kreis bilden. */
const schluessel = (id: number, plattform: string) => `${id}|${plattform}`

/** Plattformen ohne Stream-Weg: dort bedeutet ein Termin Sendung, Kino oder Kauf, nicht „läuft dort auf Deutsch". */
const KEIN_STREAM = new Set(['tv', 'kino'])

const SYNCHRO_WORTLAUT = /synchron|auf deutsch|deutsche[nrm]? (?:fassung|tonspur|sprachfassung|ton)\b/i
/** „keine deutsche Synchro", „ohne Synchronisation" — der Satz verneint, was er zu belegen scheint. */
const VERNEINT = /\b(?:keine[nrms]?|kein|ohne|nicht)\b[^.]{0,40}(?:synchron|deutsch)|(?:synchron|deutsch)[^.]{0,40}\b(?:nicht|nie|kein)/i

/** Warum ein `dub: true` am Termin nicht trägt; `undefined`, wenn der Beleg in Ordnung ist. */
export function dubFeldFehler(e: CuratedEntry): string | undefined {
  if (e.dub === undefined) return undefined
  if (e.dub !== true) return '`dub` am Termin darf nur `true` sein (ein Nein ist ein Handbeleg in dub-confirmed.yaml)'
  if (!e.anilistId) return '`dub: true` braucht `anilistId` am Termin'
  if (KEIN_STREAM.has(e.platform) || e.releaseType === 'disc') return '`dub: true` gilt nur für Stream-Termine'
  if (!e.dubQuelle || !(e.sources ?? []).includes(e.dubQuelle)) return '`dubQuelle` muss eine der `sources` sein'
  if (!e.dubZitat || !SYNCHRO_WORTLAUT.test(e.dubZitat) || VERNEINT.test(e.dubZitat)) {
    return '`dubZitat` muss die deutsche Synchro ausdrücklich und bejahend nennen'
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.dubGeprueftAm ?? ''))) return '`dubGeprueftAm` fehlt (ISO-Datum)'
  return undefined
}

/**
 * Die Belege aus den Terminen. `vorhanden` sind die Handbelege: Ein Anbieter, zu dem dort schon
 * ein Urteil (`dub` oder `available`) steht, bekommt keinen zweiten.
 */
export function dubChecksAusTerminen(termine: CuratedEntry[], vorhanden: DubCheck[]): DubCheck[] {
  const beurteilt = new Set(
    vorhanden.filter((c) => typeof c.dub === 'boolean' || typeof c.available === 'boolean').map((c) => schluessel(c.anilistId, c.platform)),
  )
  const raus: DubCheck[] = []
  for (const e of termine) {
    if (e.dub === undefined || dubFeldFehler(e) || beurteilt.has(schluessel(e.anilistId!, e.platform))) continue
    raus.push({
      anilistId: e.anilistId!,
      title: e.titleDe,
      platform: e.platform,
      dub: true,
      ...(e.platformUrl ? { url: e.platformUrl } : {}),
      checkedAt: String(e.dubGeprueftAm),
      note: `Aus dem Termin ${e.slug}: ${e.dubQuelle} — „${e.dubZitat}“`,
    })
  }
  return raus
}
