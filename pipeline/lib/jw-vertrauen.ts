/**
 * **„Deutsch laut JustWatch": die Vertrauensregel für Prime** (11.10.2026, Bericht
 * `daniel-zum-abarbeiten/berichte/justwatch-vertrauen-2026-10-11.md`).
 *
 * Gemessen gegen Handbelege, Messurteile und Anbieter-APIs: Prime-Wege von Filmen und
 * einzeln geführten Serien, für die JustWatch `de` unter `audio` nennt, waren in 465 von 468
 * Fällen richtig (99,4 %, Wilson-Untergrenze 98,1 %). Mehrteiler (mehrere unserer Titel teilen
 * eine JustWatch-Serie) nur in 95,5 % — dort verwechselt JustWatch die Staffel; sie bleiben
 * ohne Kennzeichnung, bis die Staffelangaben (`staffeln` im Befund) eine Messung ≥ 98 % tragen.
 *
 * Das Ergebnis ist kein Beleg: `dub` bleibt unberührt, der Weg bekommt nur Herkunft und Stand.
 */
import { gtiAus, type JwAngebot } from './amazon-gti.ts'
import type { Staffel } from './jw-staffeln.ts'

/** Ein Befund, der älter ist, sagt nichts mehr über heute (28 Tage, wie die Wiedervorlage des Abrufs). */
export const BEFUND_MAX_TAGE = 28

/** Prime Video, mit Werbung und die Amazon-Kanäle; der Store („Amazon Video") ist kein Abo. */
const PRIME_ANGEBOT = /^Amazon Prime Video( with Ads)?$|Amazon Channel$/

export interface JwBefund {
  geprueftAm: string
  jwId?: string
  jwPfad?: string
  ohneTreffer?: boolean
  verfehltAm?: string
  angebote: JwAngebot[]
  /** Staffeln laut JustWatch (seit 11.10.2026); fehlt bei Filmen und älteren Befunden. */
  staffeln?: Staffel[]
}

export interface JwVertrauenEingabe {
  /** Die Adresse des Prime-Wegs im Bestand (nach der gti-Brücke). */
  url: string
  /** Bisheriges Sprachurteil des Wegs; nur ein offenes (`undefined`) wird ergänzt. */
  dub: boolean | undefined
  befund: JwBefund | undefined
  /** Wie viele Titel unseres Bestands zu derselben JustWatch-Kennung gehören. */
  titelJeJwId: number
  /** Ein Handbeleg oder Messurteil sagt Nein oder „nicht verfügbar" für diesen Titel bei Prime. */
  widerspruch: boolean
  heute: string
}

const TAG_MS = 86_400_000

function alterInTagen(von: string, bis: string): number {
  return (Date.parse(bis) - Date.parse(von)) / TAG_MS
}

/** Wie viele Titel je JustWatch-Kennung im Abrufbestand stehen (Schlüssel: `jwId`). */
export function titelJeJustwatchKennung(bestand: Record<string, JwBefund>): Map<string, number> {
  const jeKennung = new Map<string, number>()
  for (const b of Object.values(bestand)) if (b.jwId) jeKennung.set(b.jwId, (jeKennung.get(b.jwId) ?? 0) + 1)
  return jeKennung
}

/**
 * Das Datum des Befunds, wenn die Regel für diesen Prime-Weg greift, sonst `undefined`.
 * Alle Bedingungen müssen zutreffen: offenes Urteil, frischer Befund ohne Fehlgriff, Film oder
 * einzeln geführte Serie, deutscher Ton genau an der Angebotsadresse des Wegs, kein Widerspruch.
 */
export function justwatchDeutsch(e: JwVertrauenEingabe): string | undefined {
  const { befund } = e
  if (e.dub !== undefined || e.widerspruch || !befund?.jwId || befund.ohneTreffer || befund.verfehltAm) return undefined
  if (alterInTagen(befund.geprueftAm, e.heute) >= BEFUND_MAX_TAGE) return undefined
  const film = befund.jwPfad?.startsWith('/de/Film') ?? false
  if (!film && e.titelJeJwId !== 1) return undefined
  const gti = gtiAus(e.url)
  if (!gti) return undefined
  const mitDeutsch = befund.angebote.some(
    (a) => PRIME_ANGEBOT.test(a.anbieter) && gtiAus(a.url) === gti && (a.audio ?? []).includes('de'),
  )
  return mitDeutsch ? befund.geprueftAm : undefined
}
