/**
 * **Das Netz unter „Sprache offen“** (16.10.2026, Daniel): Ein Anbieter-Eintrag ohne Sprachbeleg darf nie durch beide Netze fallen,
 * also weder belegt sein (Handbeleg, Urteil, „Deutsch laut JustWatch“) noch auf der Prüfliste der Erweiterung stehen. Die Prüfliste ist
 * der letzte Ausweg: erst wenn keine Quelle für Deutsch bei diesem Anbieter voll vertrauenswürdig ist.
 *
 * Die Zählung folgt der Oberfläche (`web/src/components/detail/legende-zeilen.ts`, `streamStatus`): offen ist ein Weg ohne `dub` und ohne
 * JustWatch-Stand, der nicht „nur Untertitel“ ist. Gezählt wird je Titel und Anbieter einmal.
 */
import { streamNurOmu } from '../../shared/ankuendigung.ts'
import type { Release, StreamLink, Title } from '../../shared/types.ts'

/** Die Anbieter, für die die Erweiterung eine Prüfliste führt (`extension/offene-*.js`). */
export const ANBIETER_MIT_PRUEFLISTE = ['netflix', 'primevideo', 'disneyplus'] as const

export type NetzKlasse = 'liste' | 'geprueft' | 'wartet' | 'ohne-liste' | 'ohne-adresse' | 'luecke'

/** Was eine Prüfliste kennt: Schlüssel, Adressen und Titelkennungen der noch offenen Einträge. */
export interface Pruefliste {
  schluessel: Set<string>
  adressen: Set<string>
  ids: Set<number>
}

export interface NetzKontext {
  /** Je Anbieter die Prüfliste; ein Anbieter ohne Eintrag hat keine. */
  listen: Record<string, Pruefliste>
  /** `Titel|Anbieter`, zu denen ein Handbeleg oder Urteil vorliegt (die manuelle Prüfung ist gelaufen, die Frage blieb offen). */
  geprueft: Set<string>
  /** Kennungen von Seiten, die Daniel angesehen und gemeldet hat — auch wenn das Urteil bei einem anderen Titel landete (Prime-Seiten mit mehreren Staffeln). */
  geprueftSeiten: Set<string>
  /** Gibt es bei diesem Weg noch nichts zu prüfen (nicht genug Folgen erschienen)? */
  wartet: (t: Title, s: StreamLink) => boolean
  releasesJeTitel: Map<number, Release[]>
}

export interface OffenerWeg {
  t: Title
  s: StreamLink
}

/** Die Kennung in einer Anbieteradresse, unter der die Prüfliste den Eintrag führt (Netflix-Titel, Amazon-ASIN/gti). */
export function kennungAusAdresse(url: string): string | undefined {
  return (
    /netflix\.com\/title\/(\d+)/.exec(url)?.[1] ??
    /\/(?:dp|detail)\/([A-Z0-9]{10,32}|amzn1\.dv\.gti\.[a-z0-9-]+)/i.exec(url)?.[1] ??
    /[?&]gti=(amzn1\.dv\.gti\.[a-z0-9-]+)/i.exec(url)?.[1]
  )
}

type ListenEintrag = { url?: string; id?: number; eintraege?: { id?: number; offen?: boolean }[]; staffeln?: { id?: number; offen?: boolean }[] }

/** Eine Prüfliste aus dem Objekt der Erweiterung (`AK_OFFENE_AMAZON`, `AK_PRIME_SUCHE`, `AK_OFFENE_TITEL`, `AK_OFFENE_DISNEY`). */
export function pruefliste(objekt: Record<string, ListenEintrag>): Pruefliste {
  const liste: Pruefliste = { schluessel: new Set(), adressen: new Set(), ids: new Set() }
  for (const [schluessel, wert] of Object.entries(objekt)) {
    liste.schluessel.add(schluessel)
    if (wert.url) liste.adressen.add(wert.url)
    if (wert.id !== undefined) liste.ids.add(wert.id)
    for (const e of [...(wert.eintraege ?? []), ...(wert.staffeln ?? [])]) {
      if (e.id !== undefined && e.offen !== false) liste.ids.add(e.id)
    }
  }
  return liste
}

/** Zwei Listen eines Anbieters zu einer (Prime: Titelseiten und Suchaufträge). */
export function vereinige(a: Pruefliste, b: Pruefliste): Pruefliste {
  return {
    schluessel: new Set([...a.schluessel, ...b.schluessel]),
    adressen: new Set([...a.adressen, ...b.adressen]),
    ids: new Set([...a.ids, ...b.ids]),
  }
}

/** Alle Wege, die die Oberfläche als „Sprache offen“ zeigt, je Titel und Anbieter einer. */
export function offeneWege(titel: Title[], releasesJeTitel: Map<number, Release[]>): OffenerWeg[] {
  const wege = new Map<string, OffenerWeg>()
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      if (s.dub || (s.dubQuelle === 'justwatch' && s.dubStand)) continue
      if (streamNurOmu(t, s, releasesJeTitel.get(t.id) ?? [])) continue
      const schluessel = `${t.id}|${s.platform}`
      /* Ein Weg mit Adresse ist der bessere Vertreter: nur er lässt sich auf eine Liste setzen. */
      if (!wege.has(schluessel) || (s.url && !wege.get(schluessel)!.s.url)) wege.set(schluessel, { t, s })
    }
  }
  return [...wege.values()]
}

function aufListe({ t, s }: OffenerWeg, liste: Pruefliste | undefined): boolean {
  if (!liste) return false
  if (liste.ids.has(t.id)) return true
  if (!s.url) return false
  const kennung = kennungAusAdresse(s.url)
  return liste.adressen.has(s.url) || (kennung !== undefined && liste.schluessel.has(kennung))
}

/** In welchem Netz hängt dieser offene Weg? `luecke` ist der Fehlerfall: weder Beleg noch Liste, obwohl eine Liste möglich wäre. */
export function netzKlasse(weg: OffenerWeg, kontext: NetzKontext): NetzKlasse {
  const { t, s } = weg
  if (aufListe(weg, kontext.listen[s.platform])) return 'liste'
  if (kontext.geprueft.has(`${t.id}|${s.platform}`)) return 'geprueft'
  const seite = s.url ? kennungAusAdresse(s.url) : undefined
  if (seite && kontext.geprueftSeiten.has(seite)) return 'geprueft'
  if (kontext.wartet(t, s)) return 'wartet'
  if (!(ANBIETER_MIT_PRUEFLISTE as readonly string[]).includes(s.platform)) return 'ohne-liste'
  return s.url ? 'luecke' : 'ohne-adresse'
}

/** Zähler `Klasse|Anbieter` über alle offenen Wege. */
export function netzZaehlung(wege: OffenerWeg[], kontext: NetzKontext): Map<string, number> {
  const zaehler = new Map<string, number>()
  for (const w of wege) {
    const k = `${netzKlasse(w, kontext)}|${w.s.platform}`
    zaehler.set(k, (zaehler.get(k) ?? 0) + 1)
  }
  return zaehler
}
