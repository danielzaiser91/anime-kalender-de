/**
 * **Crunchyrolls Season-Artikel → Aussagen.** Zwei Artikel je Season unter `/de/news/seasonal-lineup/`:
 *
 * - Lineup („Crunchyroll Anime-Lineup der Herbst-Season 2026"): je Titel eine Überschrift, darunter
 *   `OmU: 7. Oktober` und — nur bei angekündigter Synchro — `DE: TBA` (oder ein Tag).
 * - Synchros („Crunchyroll kündigt die deutschen Synchros für Herbst 2026 an"): je Titel eine
 *   Überschrift und „Inhalt:" mit dem offiziellen Handlungstext, ohne Termin.
 *
 * Die Seiten sind serverseitig gerendert (Storyblok), aber hinter Cloudflares Prüfschritt: `curl` bekommt
 * 14 KB ohne Artikel, Playwright den ganzen Text (gemessen 08.10.2026, `scrape-crunchyroll-woche.ts` ebenso).
 * Veröffentlichungs- und Änderungsdatum stehen im JSON-LD (`datePublished`, `dateModified`).
 */
import { datumAus, konfidenz, monatAus, type Aussage } from './aussagen.ts'

/** Überschriften werden zu „## Titel"-Zeilen, alles andere zu Textzeilen. */
export function crunchyrollZeilen(html: string): string[] {
  const start = html.indexOf('<div id="app"')
  return (start >= 0 ? html.slice(start) : html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/g, ' ')
    .replace(/<h[1-6][^>]*>/gi, '\n## ')
    .replace(/<(?:br|\/p|\/li|\/h\d|\/div|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, '’')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((z) => z.trim()).filter(Boolean)
}

export function artikelDaten(html: string): { veroeffentlicht: string; aktualisiert?: string; ueberschrift: string } {
  const pub = /"datePublished":"([^"]+)"/.exec(html)?.[1]?.slice(0, 10) ?? ''
  const mod = /"dateModified":"([^"]+)"/.exec(html)?.[1]?.slice(0, 10)
  const headline = /"headline":"([^"]+)"/.exec(html)?.[1] ?? ''
  return { veroeffentlicht: pub, ...(mod ? { aktualisiert: mod } : {}), ueberschrift: headline }
}

/** Titelzeile im Lineup: „## Magic Knight Rayearth" — Vorspann-Überschriften („Herbst-Season …") tragen kein OmU. */
function titelAusUeberschrift(z: string): string | undefined {
  return z.startsWith('## ') ? z.slice(3).trim() : undefined
}

/**
 * Lineup-Aussagen. Die „Highlights" am Anfang wiederholen Titel der vollen Liste (gleicher Name, gleicher
 * OmU-Tag) — sie zählen einmal; „Weiterlaufende Shows" tragen `OmU:` ohne Tag und sind keine Starts
 * (`uebersprungen` zählt sie, damit ein stiller Formwechsel auffällt).
 */
export function aussagenAusLineup(zeilen: string[], quelle: Aussage['quelle']): Aussage[] & { uebersprungen?: number } {
  const raus: Aussage[] & { uebersprungen?: number } = []
  const gesehen = new Set<string>()
  let uebersprungen = 0
  for (let i = 0; i < zeilen.length; i++) {
    const titel = titelAusUeberschrift(zeilen[i]!)
    if (!titel) continue
    /* Der Block endet an der nächsten Überschrift — sonst erbt ein Vorspann („Highlights der Season") den OmU-Tag des ersten Titels. */
    const ende = zeilen.slice(i + 1, i + 8).findIndex((z) => z.startsWith('## '))
    const block = zeilen.slice(i + 1, ende >= 0 ? i + 1 + ende : i + 8)
    const omuZeile = block.find((z) => /^OmU\s*:/.test(z))
    if (!omuZeile) continue
    const deZeile = block.find((z) => /^DE\s*:/.test(z))
    const studio = block.find((z) => /^Studio:/.test(z))
    const omu = datumAus(omuZeile, quelle.veroeffentlicht) ?? monatAus(omuZeile, quelle.veroeffentlicht)
    if (!omu) { uebersprungen++; continue }
    const schluessel = `${titel.toLowerCase()}|${omu}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    const de = deZeile ? datumAus(deZeile, quelle.veroeffentlicht) : undefined
    const gruende: string[] = []
    /* Ohne DE-Zeile nennt der Artikel nur die Untertitelfassung — das ist „nein" zum Stand des Artikels, keine Unklarheit. */
    const deutsch: Aussage['deutsch'] = de ? 'ja' : deZeile && /TBA/i.test(deZeile) ? 'angekuendigt' : 'nein'
    if (!deZeile) gruende.push('nur OmU, keine DE-Zeile')
    else if (!de) gruende.push('DE: TBA')
    if (omu.length === 7) gruende.push('nur Monat genannt')
    const inhalt = block.find((z, k) => k > block.indexOf(omuZeile) && !/^(DE|OmU|Studio|Verfügbarkeit)\s*:/.test(z) && !z.startsWith('## ') && z.length > 15)
    const a: Aussage = {
      quelle, titel, art: de ? 'start' : 'omu-start', plattformen: ['crunchyroll'],
      ...(de ? { datum: de, datumBedeutung: 'genannt' } : omu ? { datum: omu, datumBedeutung: 'omu-start' } : {}),
      deutsch, woechentlich: true,
      ...(inhalt ? { inhalt } : {}), konfidenz: 0, gruende,
      zitat: [zeilen[i]!, studio, omuZeile, deZeile].filter(Boolean).join('\n'),
    }
    /* Ein OmU-Tag ist ein genannter Tag — nur eben für die Untertitelfassung; die Konfidenz misst die Lesung. */
    a.konfidenz = konfidenz({ ...a, datumBedeutung: 'genannt' }, gruende)
    raus.push(a)
  }
  raus.uebersprungen = uebersprungen
  return raus
}

/** Synchro-Artikel: „## Titel" … „Inhalt:" … Absätze bis zur nächsten Überschrift. */
export function aussagenAusSynchros(zeilen: string[], quelle: Aussage['quelle']): Aussage[] {
  const raus: Aussage[] = []
  for (let i = 0; i < zeilen.length; i++) {
    const titel = titelAusUeberschrift(zeilen[i]!)
    if (!titel) continue
    const inhaltAb = zeilen.slice(i + 1, i + 4).findIndex((z) => /^Inhalt\s*:?$/.test(z) || z.startsWith('## '))
    if (inhaltAb < 0 || zeilen[i + 1 + inhaltAb]!.startsWith('## ')) continue
    const absaetze: string[] = []
    for (let j = i + 2 + inhaltAb; j < zeilen.length && !zeilen[j]!.startsWith('## '); j++) absaetze.push(zeilen[j]!)
    const gruende = ['im Synchro-Artikel aufgeführt']
    const a: Aussage = {
      quelle, titel, art: 'synchro-angekuendigt', plattformen: ['crunchyroll'], deutsch: 'angekuendigt',
      ...(absaetze.length ? { inhalt: absaetze.join(' ') } : {}), konfidenz: 0, gruende,
      zitat: `${zeilen[i]!}\nInhalt: ${absaetze[0]?.slice(0, 80) ?? ''}…`,
    }
    a.konfidenz = konfidenz(a, gruende)
    raus.push(a)
  }
  return raus
}
