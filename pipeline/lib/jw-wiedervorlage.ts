/**
 * Welche JustWatch-Befunde der Abruf vor der 28-Tage-Frist wieder holt (Wiedervorlage), zusätzlich zu `alterNachholen`
 * in `fetch-justwatch-audio.ts`.
 */
import type { Title } from '../../shared/types.ts'
import { deutscheSeiten, nurSerie, seitenSchluessel } from './jw-seite.ts'
import { BEFUND_MAX_TAGE, titelJeJustwatchKennung, type JwBefund } from './jw-vertrauen.ts'

/** Wie viele Tage vor seinem Ablauf (`BEFUND_MAX_TAGE`) ein Befund erneuert wird (ein Wochenlauf Vorlauf). */
export const ERNEUERN_VORLAUF_TAGE = 7

interface BefundKurz {
  geprueftAm: string
  jwId?: string
  jwPfad?: string
  ohneTreffer?: boolean
  staffeln?: unknown[]
  altersangabe?: string | null
}

/** Eine Serie, zu der noch keine Staffelangaben gesammelt sind (Befunde aus der Zeit vor dem 11.10.2026). */
export function staffelnFehlen(e: BefundKurz | undefined): boolean {
  return Boolean(e?.jwId && !e.ohneTreffer && e.jwPfad?.startsWith('/de/Serie') && e.staffeln === undefined)
}

/**
 * Altersangabe nachholen (08.10.2026): Treffer aus der Zeit vor dem Feld haben keine `altersangabe`;
 * für Titel ohne FSK werden sie vorgezogen — dieselbe Abfrage, nur früher als die 28-Tage-Frist.
 */
function alterNachholen(t: Title, bestand: Record<string, BefundKurz>): boolean {
  const e = bestand[String(t.id)]
  return t.fsk === undefined && Boolean(e?.jwId && !e.ohneTreffer && e.altersangabe === undefined)
}

/** Was vor der 28-Tage-Frist wieder an die Reihe kommt: Altersangabe, Staffelangaben, Befunde hinter „Deutsch laut JustWatch". */
export function vorgezogen(t: Title, bestand: Record<string, BefundKurz>, heute: string, mitFlagge: Set<string>): boolean {
  const e = bestand[String(t.id)]
  return alterNachholen(t, bestand) || staffelnFehlen(e) || vertrauensBefundAlt(mitFlagge.has(String(t.id)), e, heute)
}

/**
 * Titel, deren „Deutsch laut JustWatch“ (Flagge oder Hinweis, `bau/jw-seite-ton.ts`) am Befund hängt: ein Weg ohne eigenes Urteil, dessen Seite
 * JustWatch mit deutschem Ton nennt. Das Alter des Befunds zählt nicht — auch eine schon abgelaufene Flagge kommt mit einem neuen Befund
 * zurück. Anime: Filme, Einzelstaffeln und Serien mit Hinweis, nur Mehrteiler fallen weg. Cartoons (`cartoonIds`) nur ohne Serien-Grund
 * (`nurSerie` mit eigenen Staffeln): `kennzeichneCartoonJwSeiten` gibt solchen Wegen weder Flagge noch Hinweis.
 */
export function titelMitJwFlagge(titel: Title[], bestand: Record<string, JwBefund>, cartoonIds: Set<number>): Set<string> {
  const jeKennung = titelJeJustwatchKennung(bestand)
  const mit = new Set<string>()
  for (const t of titel) {
    const befund = bestand[String(t.id)]
    if (!befund) continue
    const grund = nurSerie(befund, jeKennung.get(befund.jwId ?? '') ?? 0, t.staffeln?.length ?? 0)
    if (grund === 'Mehrteiler' || (grund && cartoonIds.has(t.id))) continue
    const seiten = deutscheSeiten(befund, befund.geprueftAm)
    const haengtDran = (t.streams ?? []).some((s) => !s.entferntAm && s.dub === undefined && seiten.has(seitenSchluessel(s.url) ?? ''))
    if (haengtDran) mit.add(String(t.id))
  }
  return mit
}

/**
 * Ein Weg mit „Deutsch laut JustWatch" (jeder Anbieter, `jw-seite.ts`) gilt nur bei einem Befund unter 28 Tagen. Der Abruf holt Befunde ab dem
 * 28. Tag — dazwischen wäre die Kennzeichnung tagelang weg. Deshalb wird der Befund eines Titels mit Flagge (`titelMitJwFlagge`) einen
 * Wochenlauf früher erneuert. Nicht an `dubQuelle` hängen: Die Marke gibt es nur, solange die Flagge gilt (Your Name, 17.10.2026).
 */
export function vertrauensBefundAlt(mitFlagge: boolean, e: BefundKurz | undefined, heute: string): boolean {
  if (!e || !mitFlagge) return false
  const alterTage = (Date.parse(heute) - Date.parse(e.geprueftAm)) / 86_400_000
  return alterTage >= BEFUND_MAX_TAGE - ERNEUERN_VORLAUF_TAGE
}
