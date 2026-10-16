/**
 * Wege ohne eigenes Urteil bekommen „Deutsch laut JustWatch“, wenn JustWatch an genau ihrer Seite deutschen Ton nennt und die
 * Serienangabe eindeutig für unseren Titel gilt (Regeln in `lib/jw-seite.ts`). Für Anime (`11-6-jw-vertrauen.ts`) und Cartoons
 * (`cartoon-jw-seite.ts`). Eigene Messungen gehen vor; widerspricht eine JustWatch, kommt sie in die Widerspruchs-Liste, und über
 * `WAECHTER_GRENZE` zeigt der Anbieter in diesem Bau nur den Hinweis (`dubHintOnly`).
 */
import type { StreamLink, Title } from '../../shared/types.ts'
import { titelJeJustwatchKennung, type JwBefund } from '../lib/jw-vertrauen.ts'
import { abgeschalteteAnbieter, deutscheSeiten, jwTonAnSeite, nurSerie, seitenSchluessel, type NurSerie, type WaechterZahl } from '../lib/jw-seite.ts'

/** Was wir selbst über den Ton eines Wegs wissen (Handbeleg, Messurteil, Meldung der Erweiterung); `undefined` = nichts. */
export type Messung = { urteil: 'ja' | 'nein'; quelle: string } | undefined

/** Ein Nein mit Adresse, dessen Weg der Bau schon entfernt hat (Handbeleg „nur Untertitel“). */
export interface NeinAdresse {
  id: number
  platform: string
  url: string
  quelle: string
}

export interface Widerspruch {
  id: number
  titel: string
  platform: string
  url: string
  jw: string
  gemessen: string
}

export interface Kandidat {
  id: number
  titel: string
  anbieter: string
  seite: string
  /** Der Titel hat bei diesem Anbieter einen Weg, dessen Adresse keine Seitenkennung trägt (z. B. `/dp/`). */
  wegOhneKennung: boolean
}

export interface JwSeitenErgebnis {
  flaggen: number
  hinweise: number
  widersprueche: Widerspruch[]
  kandidaten: Kandidat[]
  zaehlung: Map<string, WaechterZahl>
  abgeschaltet: Set<string>
  /** Wege mit JustWatch-„de“ an der Seite, die nur die Serienangabe haben (Größe für einen späteren Abruf je Staffel). */
  nurSerie: Map<NurSerie, number>
}

const name = (t: Title): string => t.titleDe ?? t.titleRomaji ?? t.titleEn ?? String(t.id)
const geschaltet = (s: StreamLink): boolean => !s.entferntAm

function zaehle(zaehlung: Map<string, WaechterZahl>, platform: string, widerspruch: boolean): void {
  const z = zaehlung.get(platform) ?? { gemessen: 0, widerspruch: 0 }
  z.gemessen++
  if (widerspruch) z.widerspruch++
  zaehlung.set(platform, z)
}

/** Das Urteil des Wegs selbst geht vor; ohne Urteil zählt, was die Messung sagt. */
function urteilVon(s: StreamLink, messung: Messung): Messung {
  if (s.dub === true) return { urteil: 'ja', quelle: 'Urteil am Weg' }
  if (s.dub === false) return { urteil: 'nein', quelle: 'Urteil am Weg' }
  return messung
}

interface Eingabe {
  titel: Title[]
  befunde: Record<string, JwBefund>
  heute: string
  messung: (t: Title, s: StreamLink) => Messung
  neinAdressen?: NeinAdresse[]
  ausgenommen?: Set<string>
  /** Anime: Wege mit bloßer Serienangabe (kein Mehrteiler) bekommen den Hinweis. Cartoons tragen ihn schon am Titel. */
  hinweisNurSerie: boolean
}

interface Offen {
  s: StreamLink
  stand: string
  nurHinweis: boolean
}

/** Kennzeichnet die Wege und gibt Zählung, Widersprüche und Kandidaten zurück; `dub` bleibt unberührt. */
export function kennzeichneJwSeiten(e: Eingabe): JwSeitenErgebnis {
  const jeKennung = titelJeJustwatchKennung(e.befunde)
  const zaehlung = new Map<string, WaechterZahl>()
  const nurSerieZahl = new Map<NurSerie, number>()
  const widersprueche: Widerspruch[] = []
  const offen: Offen[] = []
  for (const t of e.titel) {
    const befund = e.befunde[String(t.id)]
    if (!befund || e.ausgenommen?.has(String(t.id))) continue
    const grund = nurSerie(befund, jeKennung.get(befund.jwId ?? '') ?? 0, t.staffeln?.length ?? 0)
    for (const s of (t.streams ?? []).filter(geschaltet)) {
      const ton = jwTonAnSeite(befund, s.url, e.heute)
      if (!ton?.deutsch) continue
      const m = urteilVon(s, e.messung(t, s))
      if (grund) {
        nurSerieZahl.set(grund, (nurSerieZahl.get(grund) ?? 0) + 1)
        if (!m && e.hinweisNurSerie && grund !== 'Mehrteiler') offen.push({ s, stand: ton.stand, nurHinweis: true })
        continue
      }
      if (m) zaehle(zaehlung, s.platform, m.urteil === 'nein')
      if (m?.urteil === 'nein') widersprueche.push({ id: t.id, titel: name(t), platform: s.platform, url: s.url, jw: ton.stand, gemessen: m.quelle })
      else if (s.dub === undefined) offen.push({ s, stand: ton.stand, nurHinweis: false })
    }
  }
  widersprueche.push(...entfernteWidersprueche(e, jeKennung, zaehlung))
  const abgeschaltet = abgeschalteteAnbieter(zaehlung)
  for (const { s, stand, nurHinweis } of offen) {
    s.dubQuelle = 'justwatch'
    s.dubStand = stand
    if (nurHinweis || abgeschaltet.has(s.platform)) s.dubHintOnly = true
  }
  const hinweise = offen.filter(({ s }) => s.dubHintOnly).length
  const kandidaten = kandidatenFuerNeueWege(e, jeKennung)
  return { flaggen: offen.length - hinweise, hinweise, widersprueche, kandidaten, zaehlung, abgeschaltet, nurSerie: nurSerieZahl }
}

/** Gilt die Serienangabe eindeutig für diesen Titel (Film oder eine Staffel, kein Mehrteiler)? */
function eindeutig(t: Title, befund: JwBefund | undefined, jeKennung: Map<string, number>): befund is JwBefund {
  return Boolean(befund) && !nurSerie(befund!, jeKennung.get(befund!.jwId ?? '') ?? 0, t.staffeln?.length ?? 0)
}

/** Ein Nein, dessen Weg schon entfernt ist, widerspricht JustWatch an derselben Seite genauso. */
function entfernteWidersprueche(e: Eingabe, jeKennung: Map<string, number>, zaehlung: Map<string, WaechterZahl>): Widerspruch[] {
  const nachId = new Map(e.titel.map((t) => [t.id, t]))
  const out: Widerspruch[] = []
  for (const n of e.neinAdressen ?? []) {
    const t = nachId.get(n.id)
    const befund = e.befunde[String(n.id)]
    if (!t || !eindeutig(t, befund, jeKennung) || (t.streams ?? []).some((s) => seitenSchluessel(s.url) === seitenSchluessel(n.url))) continue
    const ton = jwTonAnSeite(befund, n.url, e.heute)
    if (!ton?.deutsch) continue
    zaehle(zaehlung, n.platform, true)
    out.push({ id: n.id, titel: name(t), platform: n.platform, url: n.url, jw: ton.stand, gemessen: n.quelle })
  }
  return out
}

const FAMILIE: Record<string, string> = { amazon: 'primevideo', crunchyroll: 'crunchyroll', disney: 'disneyplus' }

/** JustWatch nennt deutschen Ton an einer Seite, zu der der Titel keinen Weg hat: nur zählen und listen, kein neuer Weg. */
function kandidatenFuerNeueWege(e: Eingabe, jeKennung: Map<string, number>): Kandidat[] {
  const abgelehnt = new Set((e.neinAdressen ?? []).map((n) => `${n.id}|${seitenSchluessel(n.url)}`))
  const out: Kandidat[] = []
  for (const t of e.titel) {
    const befund = e.befunde[String(t.id)]
    if (e.ausgenommen?.has(String(t.id)) || !eindeutig(t, befund, jeKennung)) continue
    const wege = (t.streams ?? []).filter(geschaltet)
    const eigene = new Set(wege.map((s) => seitenSchluessel(s.url)))
    for (const [seite, anbieter] of deutscheSeiten(befund, e.heute)) {
      if (eigene.has(seite) || abgelehnt.has(`${t.id}|${seite}`)) continue
      const platform = FAMILIE[seite.split(':')[0]!]
      const wegOhneKennung = wege.some((s) => s.platform === platform && !seitenSchluessel(s.url))
      out.push({ id: t.id, titel: name(t), anbieter, seite, wegOhneKennung })
    }
  }
  return out
}
