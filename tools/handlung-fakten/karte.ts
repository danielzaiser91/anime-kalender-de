/** Faktenkarte eines Lückentitels: Stichpunkte, Quellen, Quellsätze (nur für den Stichpunkt-Schritt) und die Einordnung titel / reihe / zu dünn. */
import type { AnisearchFakten } from './anisearch-karte.ts'
import type { Fund } from './seiten.ts'
import type { Einordnung, Luecke, Quelle, Quellsaetze, Zaehlung } from './typen.ts'
import { wikiUrl } from './wikipedia.ts'
import { abschnitt, einleitung, infobox, saetze } from './wikitext.ts'
import { folgenWiderspruch, istWertung } from './zahlen.ts'
import type { FolgenWiderspruch } from './zahlen.ts'

export interface Karte {
  id: number
  name: string
  einordnung: Einordnung
  grund: string
  zaehlung: Zaehlung
  felder: { format: string[]; figuren: string[]; genreTon: string[] }
  quellen: Quelle[]
  quellsaetze: Quellsaetze[]
  abrufFehler: string[]
  /** Nennt eine Quelle eine andere Folgenzahl als der Katalog, steht sie hier; der Text lässt die Zahl weg oder nennt die belegende Quelle. */
  folgenWiderspruch?: FolgenWiderspruch
}

const MAX_PLOT = 8
const MAX_EINLEITUNG = 5
const MAX_GESCHWISTER = 2
const MIN_SAETZE = 2
const MIN_QUELLEN = 2

/** Eine Aussage über die Handlung steht erst mit zwei Sätzen aus mindestens zwei Quellen; eine einzige Quelle reicht, wenn sie mindestens zwei Plot-Sätze zum Titel selbst enthält (Dirigent, 12.10.2026). */
export function ordneEin(z: Zaehlung): { einordnung: Einordnung; grund: string } {
  if (z.quellen < MIN_QUELLEN && z.titelPlot < MIN_SAETZE) return { einordnung: 'zu dünn', grund: `nur ${z.quellen} Quelle mit Inhalt (${z.titelSaetze} Sätze über den Titel, ${z.reiheSaetze} über die Reihe)` }
  if (z.titelSaetze >= MIN_SAETZE) return { einordnung: 'titel', grund: `${z.titelSaetze} Sätze über den Titel selbst (davon ${z.titelPlot} Plot) aus ${z.quellen} Quelle(n)` }
  if (z.titelSaetze + z.reiheSaetze >= MIN_SAETZE) return { einordnung: 'reihe', grund: `${z.titelSaetze + z.reiheSaetze} Sätze, davon ${z.titelSaetze} über den Titel; der Rest gilt der Reihe` }
  return { einordnung: 'zu dünn', grund: `nur ${z.titelSaetze + z.reiheSaetze} Satz über Handlung oder Reihe` }
}

/** Wertungen, Rezensionen und Zitate sind keine freien Fakten: sie kommen nie in die Quellsätze (die Zahl der entfernten steht daneben). */
function quellsatz(quelle: string, ebene: Quellsaetze['ebene'], aus: string, roh: string[], max: number): Quellsaetze {
  const frei = roh.filter((z) => !istWertung(z))
  return { quelle, ebene, aus, saetze: frei.slice(0, max), entfernt: roh.length - frei.length }
}

function ausWikipedia(f: Fund): Quellsaetze {
  const quelle = `Wikipedia ${f.sprache.toUpperCase()} „${f.seite}“`
  const plot = saetze(abschnitt(f.text))
  if (plot.length) return quellsatz(quelle, f.ebene, 'Plot-Abschnitt', plot, MAX_PLOT)
  return quellsatz(quelle, f.ebene, 'Einleitung ohne ersten Satz', saetze(einleitung(f.text)).slice(1), MAX_EINLEITUNG)
}

export function quellsaetzeVon(l: Luecke, funde: Fund[], as?: AnisearchFakten): Quellsaetze[] {
  const raus = funde.map(ausWikipedia)
  for (const b of as?.beschreibungen ?? []) {
    raus.push(quellsatz(`aniSearch ${as!.id} (${b.sprache})`, l.geteilt ? 'reihe' : 'titel', l.geteilt ? 'Beschreibung der geteilten Seite' : 'Beschreibung der Seite', saetze(b.text), MAX_PLOT))
  }
  for (const g of l.geschwister.filter((x) => x.deText).slice(0, MAX_GESCHWISTER)) {
    raus.push(quellsatz(`aniSearch-Text zu „${g.name}“`, 'reihe', 'Reihenmitglied', saetze(g.deText!), MAX_EINLEITUNG))
  }
  return raus
}

function quellenVon(l: Luecke, funde: Fund[], as?: AnisearchFakten): Quelle[] {
  const raus: Quelle[] = funde.map((f) => ({
    art: 'wikipedia',
    ebene: f.ebene,
    name: `Wikipedia ${f.sprache.toUpperCase()} „${f.seite}“`,
    url: wikiUrl(f.sprache, f.seite),
    lizenz: 'CC BY-SA 4.0, Autoren: Versionsgeschichte des Artikels',
    hinweis: f.hinweis,
    sprache: f.sprache,
    seite: f.seite,
  }))
  if (as) {
    raus.push({ art: 'anisearch', ebene: l.geteilt ? 'reihe' : 'titel', name: `aniSearch-Archiv (Seite ${as.id}, lokal)`, url: `https://www.anisearch.de/anime/${as.id}`, lizenz: 'Strukturdaten (Genre, Tags, Figuren, Format); Quellenangabe wie bei den bestehenden Handlungen', anisearchId: as.id })
  }
  for (const g of l.geschwister.filter((x) => x.deText).slice(0, MAX_GESCHWISTER)) {
    raus.push({ art: 'geschwister', ebene: 'reihe', name: `aniSearch-Text zu „${g.name}“`, url: g.anisearchSeite ? `https://www.anisearch.de/anime/${g.anisearchSeite}` : 'https://www.anisearch.de', lizenz: 'wie die bestehende Handlung dieses Titels', titelId: g.id, anisearchId: g.anisearchSeite })
  }
  return raus
}

function zaehle(qs: Quellsaetze[], quellen: Quelle[], as?: AnisearchFakten): Zaehlung {
  const summe = (e: string) => qs.filter((q) => q.ebene === e).reduce((n, q) => n + q.saetze.length, 0)
  const plot = qs.filter((q) => q.ebene === 'titel' && !q.aus.startsWith('Einleitung')).reduce((n, q) => n + q.saetze.length, 0)
  const hatStruktur = !!as && (as.hauptgenres.length + as.nebengenres.length + as.tags.length + as.figuren.length > 0 || as.beschreibungen.length > 0)
  const mitInhalt = quellen.filter((q) => (q.art === 'anisearch' ? hatStruktur : true)).length
  return { titelSaetze: summe('titel'), titelPlot: plot, reiheSaetze: summe('reihe'), quellen: mitInhalt }
}

function formatFelder(l: Luecke, funde: Fund[], as?: AnisearchFakten): string[] {
  const namen = [l.titleDe && `Deutsch: ${l.titleDe}`, l.titleEn && `Englisch: ${l.titleEn}`, l.titleRomaji && `Romaji: ${l.titleRomaji}`].filter(Boolean)
  const eigen = `${l.format ?? '?'}${l.episodes ? `, ${l.episodes} Folgen` : ''}${l.jpYear ? `, Japan ${l.jpYear}` : ''}`
  const raus = [`Titel: ${namen.join(' | ')}`, `Format (Bestand): ${eigen}`]
  if (l.studios.length) raus.push(`Studio (Bestand): ${l.studios.join(', ')}`)
  for (const [k, v] of Object.entries(as?.info ?? {})) raus.push(`aniSearch ${k}: ${v}`)
  for (const f of funde) {
    const ib = Object.entries(infobox(f.text)).map(([k, v]) => `${k} = ${v}`)
    if (ib.length) raus.push(`Wikipedia ${f.sprache.toUpperCase()} (${f.ebene}), Infobox: ${ib.join('; ')}`)
  }
  for (const b of as?.beziehungen ?? []) raus.push(`aniSearch Beziehung: ${b}`)
  return raus
}

/** Folgenzahl laut aniSearch (Typ-Zeile „TV-Serie, 12 …“) und laut Wikipedia-Infobox gegen den Katalog. */
function folgenZeile(w?: FolgenWiderspruch): string[] {
  if (!w) return []
  return [`ACHTUNG Folgenzahl: Katalog ${w.katalog}, aber ${w.quellen.map((q) => `${q.name}: ${q.wert}`).join('; ')} — Zahl weglassen oder die belegende Quelle nennen`]
}

function folgenPruefung(l: Luecke, funde: Fund[], as?: AnisearchFakten): FolgenWiderspruch | undefined {
  const zahl = (t?: string) => Number(/(\d+)/.exec(t ?? '')?.[1]) || undefined
  const ausTyp = zahl(/,\s*(\d+)/.exec(as?.info.Typ ?? '')?.[1])
  const quellen = [{ name: `aniSearch ${as?.id}`, wert: l.geteilt ? undefined : ausTyp }]
  for (const f of funde) {
    const ib = infobox(f.text)
    quellen.push({ name: `Wikipedia ${f.sprache.toUpperCase()} „${f.seite}“ (${f.ebene})`, wert: f.ebene === 'titel' ? zahl(ib.episodes ?? ib.episoden ?? ib.folgen) : undefined })
  }
  return folgenWiderspruch(l.episodes, quellen)
}

export function baueKarte(l: Luecke, funde: Fund[], fehler: string[], as?: AnisearchFakten): Karte {
  const quellen = quellenVon(l, funde, as)
  const quellsaetze = quellsaetzeVon(l, funde, as)
  const zaehlung = zaehle(quellsaetze, quellen, as)
  const folgen = folgenPruefung(l, funde, as)
  const genre = [...l.genres, ...(as?.hauptgenres ?? []), ...(as?.nebengenres ?? []), ...(as?.tags ?? [])]
  return {
    id: l.id,
    name: l.titleDe ?? l.titleEn ?? l.titleRomaji ?? String(l.id),
    ...ordneEin(zaehlung),
    zaehlung,
    felder: { format: [...formatFelder(l, funde, as), ...folgenZeile(folgen)], figuren: as?.figuren ?? [], genreTon: [...new Set(genre)] },
    quellen,
    quellsaetze,
    abrufFehler: fehler,
    folgenWiderspruch: folgen,
  }
}

/** Die Karte für den Schreiber: Stichpunkte ohne Quellsätze. Die Prämisse füllt der Stichpunkt-Schritt aus `quellsaetzeMarkdown`. */
export function kartenMarkdown(k: Karte): string {
  const liste = (zs: string[]) => (zs.length ? zs.map((z) => `- ${z}`).join('\n') : '- –')
  return [
    `# ${k.name} (${k.id})`,
    `Einordnung: **${k.einordnung}** (${k.grund})`,
    k.einordnung === 'reihe' ? 'Kennzeichnung im Text: Die Handlung gilt für die Reihe, nicht für diesen Titel (nicht mit „Die Reihe handelt von“ beginnen: das Panel zeigt darüber schon „Zur Reihe – gilt für alle Teile“).' : '',
    'Regeln: nur Fakten aus den genannten Quellen (keine Wertung, Rezension, Presse, kein Zitat, auch nicht übersetzt); jede Zahl im Text muss in der Karte oder in einer Quelle stehen (`tools/handlung-naehe.ts` prüft das).',
    k.abrufFehler.length ? `Abruf unvollständig, nächster Lauf holt nach: ${k.abrufFehler.join(', ')}` : '',
    '## Format und Einordnung',
    liste(k.felder.format),
    '## Prämisse',
    '- (offen: Stichpunkt-Schritt aus den Quellsätzen, eigene Worte, ohne Satzbau der Quelle)',
    '## Hauptfiguren',
    liste(k.felder.figuren),
    '## Schauplatz und Zeit',
    '- (offen: Stichpunkt-Schritt)',
    '## Genre-Ton',
    liste(k.felder.genreTon),
    '## Quellen',
    '(Wikipedia-Seiten sind aus dem Namen geraten und auf Animation und Jahr geprüft; „reihe“ = Seite gilt der Reihe oder ist weitergeleitet.)',
    liste(k.quellen.map((q) => `${q.ebene}: [${q.name}](${q.url}) – ${q.lizenz}${q.hinweis ? `; ${q.hinweis}` : ''}`)),
  ]
    .filter((z) => z !== '')
    .join('\n')
}

/** Nur für den Stichpunkt-Schritt: Sätze der Quellen. Der Schreiber des Textes bekommt sie nie zu sehen. */
export function quellsaetzeMarkdown(k: Karte): string {
  const teile = k.quellsaetze.map((q) => `## ${q.quelle} (${q.ebene}, ${q.aus}${q.entfernt ? `; ${q.entfernt} Sätze mit Wertung oder Zitat nicht übernommen` : ''})\n${q.saetze.length ? q.saetze.map((s) => `- ${s}`).join('\n') : '- –'}`)
  return [`# Quellsätze zu ${k.name} (${k.id}) – nicht an den Schreiber weitergeben`, ...teile].join('\n\n')
}
