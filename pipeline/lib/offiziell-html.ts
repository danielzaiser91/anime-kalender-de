/**
 * Ein HTML-Leser für die News-Listen der offiziellen Seiten (Messlauf 13.10.2026: 53 Seiten, jede mit eigenem Gerüst, alle „Datum + verlinkte Überschrift“).
 * Ohne Fremdbibliothek: ein nachsichtiger Baum, dann je Datum der kleinste Umschlag, der genau dieses Datum und einen Link trägt.
 */
import { decodeEntities } from './feed.ts'
import { datumIn, nurDatum } from './offiziell-datum.ts'

export interface Knoten {
  name: string
  attrs: Record<string, string>
  kinder: (Knoten | string)[]
  eltern?: Knoten
}

export interface HtmlEintrag {
  titel: string
  datum: string
  url: string
}

const LEER = new Set(['br', 'img', 'hr', 'meta', 'link', 'input', 'source', 'wbr', 'area', 'col', 'base', 'embed', 'param', 'track'])
/** Öffnet dasselbe Element erneut, ohne dass das alte geschlossen wurde (HTML erlaubt das), schließt es das alte. */
const SELBST_SCHLIESSEND = new Set(['li', 'dt', 'dd', 'p', 'tr', 'td', 'th', 'option'])
const TOKEN = /<!--[\s\S]*?-->|<(script|style|svg|noscript|template|head)\b[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+|<)/gi
const ATTRIBUT = /([a-zA-Z_:][-\w:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

function attribute(roh: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of roh.matchAll(ATTRIBUT)) attrs[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return attrs
}

export function baum(html: string): Knoten {
  const wurzel: Knoten = { name: '#', attrs: {}, kinder: [] }
  let aktuell = wurzel
  for (const m of html.matchAll(TOKEN)) {
    if (m[5] !== undefined) {
      aktuell.kinder.push(m[5])
      continue
    }
    const name = m[3]?.toLowerCase()
    if (!name) continue
    if (m[2]) {
      let k: Knoten | undefined = aktuell
      while (k && k.name !== name) k = k.eltern
      if (k?.eltern) aktuell = k.eltern
      continue
    }
    if (SELBST_SCHLIESSEND.has(name) && aktuell.name === name && aktuell.eltern) aktuell = aktuell.eltern
    const knoten: Knoten = { name, attrs: attribute(m[4] ?? ''), kinder: [], eltern: aktuell }
    aktuell.kinder.push(knoten)
    if (!LEER.has(name) && !(m[4] ?? '').trimEnd().endsWith('/')) aktuell = knoten
  }
  return wurzel
}

const bereinige = (s: string): string => decodeEntities(s).replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim()

/** Alle Textstücke eines Knotens in Dokumentreihenfolge; `<time datetime>` liefert sein Datum, wenn der sichtbare Text keines trägt. */
export function texte(k: Knoten | string): string[] {
  if (typeof k === 'string') return [bereinige(k)].filter(Boolean)
  const eigene = k.name === 'time' && k.attrs.datetime && !datumIn(k.kinder.filter((c): c is string => typeof c === 'string').join(' ')) ? [k.attrs.datetime] : []
  return [...eigene, ...k.kinder.flatMap(texte)]
}

function nachfahren(k: Knoten, f: (n: Knoten) => boolean): Knoten[] {
  return k.kinder.flatMap((c) => (typeof c === 'string' ? [] : [...(f(c) ? [c] : []), ...nachfahren(c, f)]))
}

/** Auch ein Link auf „#“ (Fenster per Skript) trägt die Überschrift; seine Adresse ist dann die der Liste (`adresse`). */
const istLink = (n: Knoten): boolean => n.name === 'a' && /^(?!mailto:|tel:)\S/i.test(n.attrs.href ?? '')
const links = (k: Knoten): Knoten[] => [...(istLink(k) ? [k] : []), ...nachfahren(k, istLink)]

/** Wie viele Datumsangaben stehen unter jedem Knoten? Die Trefferliste hält den Knoten, in dem ein Textstück mit Datum steht. */
function zaehleDaten(k: Knoten, anzahl: Map<Knoten, number>, treffer: { knoten: Knoten; datum: string }[]): number {
  let summe = 0
  for (const c of k.kinder) {
    if (typeof c === 'string') {
      const d = datumIn(bereinige(c))
      if (d) {
        treffer.push({ knoten: k, datum: d })
        summe++
      }
    } else summe += zaehleDaten(c, anzahl, treffer)
  }
  const maschinell = k.name === 'time' ? datumIn(k.attrs.datetime ?? '') : undefined
  if (maschinell && !datumIn(k.kinder.filter((c): c is string => typeof c === 'string').join(' '))) {
    treffer.push({ knoten: k, datum: maschinell })
    summe++
  }
  anzahl.set(k, summe)
  return summe
}

/** Kurze Rubrikmarken („NEWS“, „お知らせ“) sind keine Überschrift. */
const RUBRIK = /^(?:[A-Z0-9 &/\-]{1,14}|お知らせ|ニュース|メディア|イベント|グッズ|新着|その他|番組情報|放送情報|ＴＶ|TV|NEW!?)$/

export function ueberschrift(link: Knoten | undefined, umschlag: Knoten[]): string {
  const aus = (ks: Knoten[]): string[] => ks.flatMap(texte).filter((s) => !nurDatum(s) && !RUBRIK.test(s))
  const imLink = link ? aus([link]).join(' ') : ''
  if (imLink.length >= 4) return imLink
  const stuecke = aus(umschlag).sort((a, b) => b.length - a.length)
  return stuecke[0] ?? ''
}

function adresse(link: Knoten | undefined, basis: string): string {
  try {
    return link && !/^(?:#|javascript:)/i.test(link.attrs.href!) ? new URL(link.attrs.href!, basis).toString() : basis
  } catch {
    return basis
  }
}

/**
 * Der Umschlag eines Datums: der kleinste Vorfahre, der genau ein Datum und einen Link trägt. Trägt erst ein Vorfahre mehrere Daten (Definitionsliste mit
 * `dt`/`dd`), gehören die Geschwister bis zum nächsten Datum dazu.
 */
function umschlagVon(start: Knoten, anzahl: Map<Knoten, number>): Knoten[] {
  let k: Knoten | undefined = start
  while (k && k.name !== '#') {
    if ((anzahl.get(k) ?? 0) > 1) return []
    if (links(k).length) return [k]
    const eltern: Knoten | undefined = k.eltern
    if (eltern && (anzahl.get(eltern) ?? 0) > 1) return geschwister(k, eltern, anzahl)
    k = eltern
  }
  return []
}

function geschwister(k: Knoten, eltern: Knoten, anzahl: Map<Knoten, number>): Knoten[] {
  const gruppe: Knoten[] = [k]
  for (const s of eltern.kinder.slice(eltern.kinder.indexOf(k) + 1)) {
    if (typeof s === 'string') continue
    if ((anzahl.get(s) ?? 0) > 0) break
    gruppe.push(s)
    if (links(s).length) return gruppe
  }
  return []
}

/** Meldungen einer HTML-Liste: Datum, Überschrift, Adresse. Seiten ohne erkennbare Liste liefern eine leere Liste (kein Fehler). */
export function leseHtml(html: string, basis: string): HtmlEintrag[] {
  const anzahl = new Map<Knoten, number>()
  const treffer: { knoten: Knoten; datum: string }[] = []
  zaehleDaten(baum(html), anzahl, treffer)
  const ergebnis: HtmlEintrag[] = []
  for (const t of treffer) {
    const umschlag = umschlagVon(t.knoten, anzahl)
    const link = umschlag.flatMap(links)[0]
    const titel = ueberschrift(link, umschlag).slice(0, 200)
    if (titel.length >= 4) ergebnis.push({ titel, datum: t.datum, url: adresse(link, basis) })
  }
  return ergebnis
}
