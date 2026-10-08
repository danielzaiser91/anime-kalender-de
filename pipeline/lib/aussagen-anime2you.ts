/**
 * **Anime2You-Sammelartikel → Aussagen.** Liest beide Formen, die `lib/sammelartikel.ts` (Stand
 * 08.10.2026) nur zur Hälfte kennt:
 *
 *   1. Oktober: »The Ramparts of Ice« – Staffel 2 (Simulcast)      ← Kopf mit Tag (Monatsartikel)
 *   »Aoashi« – Staffel 2                                             ← Kopf ohne Tag („Ab sofort verfügbar:")
 *   Start: 3. Oktober 2026 · Sprache: … · Stream: … · Hinweis: …     ← Felder darunter
 *   Ab 12.10.: »BLEACH: Fade to Black« (Dub + Sub)                   ← Kurzliste ohne Felder
 *
 * Ein Kopf ohne Felder zählt nur, wenn er einen Tag oder eine Sprachangabe in Klammern trägt (die
 * Kurzliste); die reine Namensliste am Anfang des Artikels wiederholt nur, was unten ausführlich steht.
 */
import { anbieterAus, datumAus, konfidenz, zeitAus, type Aussage, type Deutsch } from './aussagen.ts'

const KOPF =
  /^(?:(?:Ab\s+)?(?:(\d{1,2}\.\s*(?:[A-Za-zÄÖÜäöü]+|\d{1,2}\.)(?:\s*\d{4})?)|Ab sofort|(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)):\s*)?»(.+?)«\s*(?:[–-]\s*([^()]+?))?\s*(?:\(([^()]+)\))?\s*$/
const FELD = /^(Start|Simulcast|Episoden|Sprache|Stream|Hinweis|Laufzeit):\s*(.+)$/
/** Abschnittsüberschrift, unter der Köpfe ohne Tag den Tag der Meldung meinen. */
const SOFORT = /^Ab sofort\b.*:$/i
/** Eine Abschnittsüberschrift („Neue Katalogtitel:", „Bald auf AKIBA PASS TV:") — „Handlung:" ist keine. */
const ABSCHNITT = /^[^»]{0,60}:$/
const istAbschnitt = (z: string) => ABSCHNITT.test(z) && !/^Handlung:?$/i.test(z) && !FELD.test(z)

interface Block {
  kopf: string
  titel: string
  zusatz?: string
  klammer?: string
  tagImKopf?: string
  sofortImKopf: boolean
  felder: [string, string][]
  handlung: string[]
  unterSofort: boolean
}

function bloecke(zeilen: string[]): Block[] {
  const raus: Block[] = []
  let unterSofort = false
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!
    if (SOFORT.test(z)) unterSofort = true
    else if (istAbschnitt(z)) unterSofort = false
    const k = KOPF.exec(z)
    if (!k) continue
    const b: Block = {
      kopf: z, titel: k[2]!.trim(), zusatz: k[3]?.trim() || undefined, klammer: k[4]?.trim(),
      tagImKopf: k[1], sofortImKopf: /^Ab sofort:/i.test(z), felder: [], handlung: [], unterSofort,
    }
    let inHandlung = false
    for (let j = i + 1; j < zeilen.length && !KOPF.test(zeilen[j]!) && !istAbschnitt(zeilen[j]!); j++) {
      const f = FELD.exec(zeilen[j]!)
      if (f) { b.felder.push([f[1]!, f[2]!]); inHandlung = false; continue }
      if (/^Handlung:?$/i.test(zeilen[j]!)) { inHandlung = true; continue }
      if (inHandlung && !/^©/.test(zeilen[j]!)) b.handlung.push(zeilen[j]!)
    }
    raus.push(b)
  }
  return raus
}

function deutschAus(b: Block): { deutsch: Deutsch; grund: string } {
  const sprache = b.felder.find(([f]) => f === 'Sprache')?.[1]
  const hinweis = b.felder.filter(([f]) => f === 'Hinweis').map(([, v]) => v).join(' ')
  if (/Synchronisation angekündigt/i.test(hinweis)) return { deutsch: 'angekuendigt', grund: 'Hinweis: Synchronisation angekündigt' }
  /* Anime2Yous Spiegel des Crunchyroll-Synchro-Artikels: „Sprache: Deutsch" plus „Termin der deutschen Synchronfassung noch offen" — eine Zusage, kein Start. */
  if (/Termin der deutschen Synchron\w* noch offen/i.test(hinweis)) return { deutsch: 'angekuendigt', grund: 'Hinweis: Termin der deutschen Synchronfassung noch offen' }
  if (sprache) return /\bDeutsch\b/.test(sprache) ? { deutsch: 'ja', grund: `Sprache: ${sprache}` } : { deutsch: 'nein', grund: `Sprache: ${sprache}` }
  if (b.klammer) {
    if (/\b(Dub|Synchro)\b/i.test(b.klammer)) return { deutsch: 'ja', grund: `(${b.klammer})` }
    if (/\bSub\b/i.test(b.klammer)) return { deutsch: 'nein', grund: `(${b.klammer})` }
  }
  return { deutsch: 'unklar', grund: 'keine Sprachangabe' }
}

function aussageAus(b: Block, artikel: { url: string; veroeffentlicht: string; anbieter?: string; kanal?: string }): Aussage {
  const gruende: string[] = []
  const { deutsch, grund } = deutschAus(b)
  gruende.push(grund)
  const start = b.felder.find(([f]) => f === 'Start')?.[1]
  const tagText = start ?? b.tagImKopf
  let datum = tagText ? datumAus(tagText, artikel.veroeffentlicht) : undefined
  /* „Start: 26. September 2026 (OmU)": der Tag gehört der Untertitelfassung, nicht der Synchro. */
  const omu = Boolean(start && /\(OmU\)/i.test(start))
  let datumBedeutung: Aussage['datumBedeutung'] = datum ? (omu ? 'omu-start' : 'genannt') : undefined
  if (!datum && (b.sofortImKopf || b.unterSofort)) {
    datum = artikel.veroeffentlicht.slice(0, 10)
    datumBedeutung = 'tag-der-meldung'
  }
  const stream = (b.felder.find(([f]) => f === 'Stream')?.[1] ?? '')
    .split(/,\s*/).map((s) => s.trim()).filter((s) => s && !/noch nicht verfügbar/i.test(s))
  const gelesen = stream.map(anbieterAus)
  const plattformen = [...new Set([...gelesen.map((x) => x?.platform), artikel.anbieter].filter((p): p is string => Boolean(p)))]
  const kanal = gelesen.find((x) => x?.kanal)?.kanal ?? artikel.kanal
  const simulcast = b.felder.find(([f]) => f === 'Simulcast')?.[1]
  const episoden = b.felder.find(([f]) => f === 'Episoden')?.[1]
  const komplett = episoden ? /(\d+)\s*\(komplett\)/.exec(episoden) : null
  const art: Aussage['art'] = deutsch === 'angekuendigt' && !datum ? 'synchro-angekuendigt' : omu ? 'omu-start' : 'start'
  if (omu) gruende.push('Tag ist der OmU-Start')
  const a: Aussage = {
    quelle: { url: artikel.url, veroeffentlicht: artikel.veroeffentlicht, leser: 'anime2you-sammel' },
    titel: b.titel, ...(b.zusatz ? { zusatz: b.zusatz } : {}), art, plattformen, ...(kanal ? { kanal } : {}),
    ...(datum ? { datum, datumBedeutung } : {}), deutsch,
    ...(simulcast || /simulcast|wöchentlich/i.test(b.klammer ?? '') ? { woechentlich: true } : {}),
    ...(simulcast && zeitAus(simulcast) ? { zeit: zeitAus(simulcast) } : {}),
    ...(komplett ? { folgen: Number(komplett[1]) } : {}),
    ...(b.handlung.length ? { inhalt: b.handlung.join(' ') } : {}),
    konfidenz: 0, gruende,
    zitat: [b.kopf, ...b.felder.map(([f, v]) => `${f}: ${v}`)].join('\n'),
  }
  a.konfidenz = konfidenz(a, gruende)
  return a
}

/** Anbieter aus der Überschrift („aniverse kündigt …", „Netflix: Alle …"). */
export function anbieterDerUeberschrift(ueberschrift: string): { anbieter?: string; kanal?: string } {
  for (const name of ['prime video', 'aniverse', 'netflix', 'crunchyroll', 'disney+', 'adn', 'joyn', 'rtl+', 'wow']) {
    if (ueberschrift.toLowerCase().includes(name)) {
      const x = anbieterAus(name)!
      return { anbieter: x.platform, ...(x.kanal ? { kanal: x.kanal } : {}) }
    }
  }
  return {}
}

/**
 * Alle Aussagen eines Artikels. Derselbe Titel kann im Artikel zweimal stehen (Kurzliste und ausführlich);
 * die ausführliche Fassung gewinnt, Tag und Sprache der Kurzliste bleiben, wo sie unten fehlen.
 */
export function aussagenAusAnime2You(
  zeilen: string[],
  artikel: { url: string; veroeffentlicht: string; ueberschrift: string },
): Aussage[] {
  const kopf = anbieterDerUeberschrift(artikel.ueberschrift)
  const nachTitel = new Map<string, { aussage: Aussage; felder: number }>()
  for (const b of bloecke(zeilen)) {
    if (!b.felder.length && !b.tagImKopf && !b.klammer && !b.sofortImKopf) continue
    const a = aussageAus(b, { url: artikel.url, veroeffentlicht: artikel.veroeffentlicht, ...kopf })
    const schluessel = `${a.titel.toLowerCase()}|${(a.zusatz ?? '').toLowerCase()}`
    const alt = nachTitel.get(schluessel)
    if (!alt) { nachTitel.set(schluessel, { aussage: a, felder: b.felder.length }); continue }
    const [reich, arm] = b.felder.length > alt.felder ? [a, alt.aussage] : [alt.aussage, a]
    if (!reich.datum && arm.datum) Object.assign(reich, { datum: arm.datum, datumBedeutung: arm.datumBedeutung })
    reich.gruende = []
    if (reich.deutsch === 'unklar' && arm.deutsch !== 'unklar') reich.deutsch = arm.deutsch
    /* Kurzliste „(Dub + Sub)" gegen Block „Sprache: Japanisch (UT)" (ADN Oktober 2026, Madoka Film 1): der Artikel widerspricht sich — das bleibt unklar, nicht entschieden. */
    else if (arm.deutsch !== 'unklar' && arm.deutsch !== reich.deutsch) {
      reich.deutsch = 'unklar'
      reich.gruende.push(`Artikel widerspricht sich: ${alt.aussage.gruende[0]} gegen ${a.gruende[0]}`)
    }
    reich.zitat = [...new Set([alt.aussage.zitat, a.zitat])].join('\n')
    reich.konfidenz = konfidenz(reich, reich.gruende)
    nachTitel.set(schluessel, { aussage: reich, felder: Math.max(b.felder.length, alt.felder) })
  }
  return [...nachTitel.values()].map((x) => x.aussage)
}
