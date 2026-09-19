/**
 * **Deutsche Folgentitel und Nummern aus den Episodenlisten der de.wikipedia** (19.09.2026).
 *
 * Das TV-Programm (RTL+, tv.de) nennt je Sendung nur den Folgentitel, keine Nummer.
 * Die Episodenlisten der deutschsprachigen Wikipedia führen je Folge Gesamtnummer
 * (`NR_GES`), Nummer in der Staffel (`NR_ST`), den deutschen Titel (`DT`) und die
 * deutschsprachige Erstausstrahlung (`EAD`) — über die Vorlagen `Episodenlisteneintrag`
 * und `Episodenlisteneintrag2`, beide mit denselben Feldern. Gemessen an Dragon Ball
 * Super: 131 von 131 Folgen mit deutschem Titel und Datum.
 *
 * Verglichen werden Titel über `folgenKern` aus `shared/folgen-zuordnung.ts`.
 * Hier steht nur das Zerlegen, ohne Netz — `fetch-wikipedia-folgen.ts` holt, und
 * `check-logic.ts` prüft es an einem Ausschnitt.
 */

export type WikiFolge = { nr: number; st?: number; dt: string; ead?: string }

const MONATE: Record<string, number> = {
  jan: 1, januar: 1, jän: 1, jänner: 1,
  feb: 2, februar: 2,
  mär: 3, märz: 3, mrz: 3,
  apr: 4, april: 4,
  mai: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  dez: 12, dezember: 12,
}

/** „4. Sep. 2017", „4. September 2017" → „2017-09-04"; sonst undefined. */
export function wikiDatum(roh: string): string | undefined {
  const m = /(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\.?\s+(\d{4})/.exec(bereinigen(roh))
  if (!m) return undefined
  const monat = MONATE[m[2]!.toLowerCase()]
  if (!monat) return undefined
  return `${m[3]}-${String(monat).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
}

/** Wiki-Auszeichnung weg, lesbarer Text bleibt. */
export function bereinigen(s: string): string {
  let t = s
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
  /* Vorlagen von innen nach außen entfernen; `{{lang|…|Text}}` behält den Text. */
  for (let i = 0; i < 5 && t.includes('{{'); i++)
    t = t.replace(/\{\{\s*lang\s*\|[^|{}]*\|([^{}]*)\}\}/gi, '$1').replace(/\{\{[^{}]*\}\}/g, '')
  return t
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Alle Folgen einer Seite, in Seitenreihenfolge; Einträge ohne Gesamtnummer oder Titel fallen weg. */
export function folgenAusWikitext(text: string): WikiFolge[] {
  const aus: WikiFolge[] = []
  const teile = text.split(/\{\{\s*Episodenlisteneintrag2?\s*(?=\n|\|)/).slice(1)
  for (const teil of teile) {
    const felder: Record<string, string> = {}
    for (const m of teil.matchAll(/^\s*\|\s*([A-Z_]+[0-9]?)\s*=(.*)$/gm)) felder[m[1]!] ??= m[2]!
    const nr = Number(bereinigen(felder.NR_GES ?? ''))
    const dt = bereinigen(felder.DT ?? '')
    if (!Number.isInteger(nr) || nr < 1 || !dt) continue
    const st = Number(bereinigen(felder.NR_ST ?? ''))
    const ead = wikiDatum(felder.EAD ?? '')
    aus.push({ nr, ...(Number.isInteger(st) && st > 0 ? { st } : {}), dt, ...(ead ? { ead } : {}) })
  }
  return aus
}

/**
 * **Episodenlisten als Tabelle** (Detektiv Conan, 19.09.2026): je Zeile japanische und
 * deutsche Nummer, deutscher Titel, Originaltitel, Erstausstrahlung Japan und deutschsprachig.
 * Gelesen werden nur Tabellen mit einer Spalte „Deutscher Titel". Die Nummer ist die erste
 * Zahlenzelle (japanische Zählung, wie AniList), der Titel die erste Zelle danach, die
 * deutsche Erstausstrahlung die letzte Datumszelle — nur wenn es zwei gibt, sonst ist
 * unklar, welches Land sie meint. Eine Zelle mit `rowspan` gilt für die folgenden Zeilen
 * mit (Conan teilt japanische Doppelfolgen in zwei deutsche).
 */
export function folgenAusTabellen(text: string): WikiFolge[] {
  const aus: WikiFolge[] = []
  for (const tabelle of text.split(/^\{\|/m).slice(1)) {
    const koerper = tabelle.split(/^\|\}/m)[0]!
    if (!/Deutscher Titel/i.test(koerper.split(/^\|-/m).slice(0, 3).join(''))) continue
    const offen = new Map<number, { inhalt: string; rest: number }>()
    for (const zeile of koerper.split(/^\|-.*$/m).slice(1)) {
      const roh = zeile
        .split('\n')
        .filter((l) => l.startsWith('|') && !l.startsWith('|+'))
        .flatMap((l) => l.slice(1).split('||'))
      if (!roh.length) continue
      const zellen: string[] = []
      const uebernehmen = () => {
        while (offen.has(zellen.length)) {
          const o = offen.get(zellen.length)!
          if (--o.rest <= 0) offen.delete(zellen.length)
          zellen.push(o.inhalt)
        }
      }
      for (const r of roh) {
        uebernehmen()
        const m = /^([^|[{]*=[^|[{]*)\|(?!\|)(.*)$/s.exec(r)
        const inhalt = bereinigen(m ? m[2]! : r)
        const spannt = Number(/rowspan\s*=\s*"?(\d+)/i.exec(m?.[1] ?? '')?.[1] ?? 1)
        if (spannt > 1) offen.set(zellen.length, { inhalt, rest: spannt - 1 })
        zellen.push(inhalt)
      }
      uebernehmen()
      const zahlen = zellen.findIndex((z) => !/^\d+$/.test(z))
      if (zahlen < 1) continue
      const nr = Number(zellen[0])
      const dt = zellen[zahlen]!
      const daten = zellen.slice(zahlen + 1).map(wikiDatum).filter((d): d is string => Boolean(d))
      if (!dt) continue
      aus.push({ nr, ...(zahlen > 1 ? { st: Number(zellen[1]) } : {}), dt, ...(daten.length >= 2 ? { ead: daten.at(-1)! } : {}) })
    }
  }
  return aus
}
