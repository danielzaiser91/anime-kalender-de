/**
 * Zusicherung zu „Keine Anzeigestelle macht eine Adresse aus den Daten ungeprüft zum Klickziel“ (Daniel, 19.10.2026: „Originalseite“
 * auf eine API-Adresse). Jeder `href` mit nicht festem Wert in `web/src` steht mit Grund in `ERLAUBT`; ein neuer löst den Fehler aus
 * und verlangt die Entscheidung: `belegLink`/`istLink` nutzen oder mit Begründung eintragen. Ein Eintrag, den es nicht mehr gibt, ist ebenfalls ein Fehler.
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findeHrefs } from './lib/href-scan.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Datei → Ausdruck → Grund, warum dieses Ziel keine API-Adresse sein kann oder geprüft ist. */
const ERLAUBT: Record<string, Record<string, string>> = {
  'web/src/components/beleg-dialog.tsx': { original: 'belegLink(beleg): Seite des Belegs, nie eine API-Adresse' },
  'web/src/components/news-verlauf.tsx': { ziel: 'belegLink(b): wie im Beleg-Fenster' },
  'web/src/components/news-abgeloest.tsx': { 'm.ersetzt.quelle': 'nur nach istLink(m.ersetzt.quelle)' },
  'web/src/components/Quellenuebersicht.tsx': { 'r.url': 'aus terminQuellenJeHost: istLink-gefiltert' },
  'web/src/components/detail/abschnitte.tsx': { 'plot.quelle.url': 'aniSearch-/ANN-Handlungsseite' },
  'web/src/components/detail/antwort-kasten.tsx': { q: 'Quellenliste einer Antwort: Wiki-/Katalogseiten' },
  'web/src/components/detail/flaggen.tsx': { 'verweis.ziel': 'Anbieterseite (Stream, Shop), aus den Wegen des Titels' },
  'web/src/components/detail/handlung-quelle.tsx': { 'q.url': 'Handlungsquelle (aniSearch, ANN, TMDB-Seite)', lizenzSeite: 'feste Lizenzseite' },
  'web/src/components/empfehlung/Leinwand.tsx': { 'belegLink(s)': 'Anbieterseite des Wegs (Seite, sonst Adresse), nie eine API-Adresse' },
  'web/src/components/detail/kino.tsx': { suche: 'Kino-Suchseite, selbst gebaut', kinoheld: 'Kinoheld-Seite, selbst gebaut' },
  'web/src/components/detail/merken.tsx': { 'googleCalendarUrl(ev, {}, wochenserie(kuenftige))': 'selbst gebaute Kalenderadresse' },
  'web/src/components/detail/pille.tsx': { 'url || undefined': 'Anbieter-Adresse (platformUrl/Weg), keine Beleg-Quelle' },
  'web/src/components/detail/hilfen.tsx': { url: 'blob:-Adresse der ICS-Datei aus URL.createObjectURL (downloadIcs), keine Adresse aus den Daten' },
  'web/src/components/detail/termin-zeile.tsx': {
    href: 'Parameter von ProgrammLink; einziger Aufrufer übergibt tvLink.href (Eintrag daneben)',
    'tvLink.href': 'aus programmZiel: tvText.programm oder tvQuelle().url',
    'tvText.programm': 'tv.de-Programmseite',
    'quelle.url': 'tvQuelle(): nur http(s) und parsbar (istLink), sonst keine Quelle',
  },
  'web/src/components/detail/vermerk.tsx': {
    'm.quelle.url': 'Nachrichtenartikel (anime2you u. a.), keine Termin-Quelle',
    anbieterUrl: 'Anbieter-Adresse des Vermerks',
    'h.url': 'Nachrichtenartikel-Hinweis',
    'vermerk.rechercheQuelle': 'Rechercheseite des Vermerks',
  },
  'web/src/components/detail/weitere.tsx': { 'stimmen.annUrl': 'ANN-Seite' },
  'web/src/components/Header.tsx': { startHref: 'eigene Seite' },
  'web/src/components/KopfNavigation.tsx': { 'hrefFuer(ziel)': 'eigene Seite' },
  'web/src/components/NewsView.tsx': { "feedUrl('news.xml')": 'eigener Feed' },
  'web/src/components/patchnotes-teile.tsx': { 'n.link': 'Link der Patchnote (eigene Seite)' },
  'web/src/components/StaticViews.tsx': { "url.replace(/^https?:/, 'webcal:')": 'eigener Kalender-Feed', url: 'eigener Feed', teil: 'Adresse aus einem Lizenz-/Quellensatz (MitLinks), keine Beleg-Adresse', WOCHENPROGRAMM_UEBERSICHT: 'feste Übersichtsseite des Crunchyroll-Wochenprogramms, keine Beleg-Adresse' },
  'web/src/components/ui.tsx': { href: 'Parameter der Button-Komponente; Aufrufer stehen in dieser Liste' },
}

console.log('\nScanner: Fälle')
{
  const stellen = (t: string, d = 'x.tsx') => findeHrefs(t, d).map((s) => s.ausdruck)
  pruefe('JSX-Attribut mit Ausdruck wird gemeldet', stellen('const a = <a href={b.url}>x</a>').join() === 'b.url')
  pruefe('feste Zeichenkette und Vorlage mit festem Anfang sind kein Befund', stellen('const a = <a href="#/x"><a href={`#/n/${i}`}/><a href={"https://x.de"}/></a>').length === 0)
  pruefe('Vorlage, die mit einem Ausdruck beginnt, wird gemeldet', stellen('const a = <a href={`${b.url}`}/>').length === 1)
  pruefe('Spread auf <a> wird gemeldet, auf andere Elemente nicht', stellen('const a = <a {...p}/>').length === 1 && stellen('const a = <Foo {...p}/>').length === 0)
  pruefe('Objekt-Eigenschaft href (createElement) und Kurzform werden gemeldet', stellen('h("a", { href: b.url }); h("a", { href })', 'x.ts').join() === 'b.url,href')
  pruefe('Eigenschaft als Zeichenkette ("href") wird gemeldet', stellen('h("a", { "href": b.url })', 'x.ts').join() === 'b.url')
  pruefe('ein Attribut ohne Wert wird nicht gemeldet, ein anderes Attribut auch nicht', stellen('const a = <a data-href={b.url} download/>').length === 0)
  /* Umgehungen aus Prüfer 1598 A4. */
  pruefe('Zuweisung a.href = … und a["href"] = … werden gemeldet, eine feste nicht', stellen('a.href = q.url; a["href"] = q.seite; b.href = "https://x.de/"', 'x.ts').join() === 'q.url,q.seite')
  pruefe('Zuweisung an ein anderes Feld und ein Vergleich mit href sind kein Befund', stellen('a["title"] = q.x; a.title = q.y; if (a.href === q.z) f()', 'x.ts').length === 0)
  pruefe('Vorlage mit Leerzeichen am Anfang wird gemeldet', stellen('const a = <a href={` ${q.url}`}/>').join() === '` ${q.url}`')
  /* „https:///…“ liest der Browser als „https://…“: der Host käme aus den Daten. */
  pruefe('Vorlage ohne vollständigen Host wird gemeldet', stellen('const a = <a href={`https://${q.host}/x`}/><a href={`https://x.de${q.pfad}`}/><a href={`https:///${q.host}`}/>').length === 3)
  pruefe('Vorlage mit „//“ am Anfang (fremder Host) wird gemeldet, ein eigener Pfad nicht', stellen('const a = <a href={`//${q.host}`}/><a href={`/titel/${q.slug}`}/>').join() === '`//${q.host}`')
  pruefe('berechneter Schlüssel [\'href\'] wird gemeldet', stellen("h('a', { ['href']: q.url })", 'x.ts').join() === 'q.url')
  pruefe('setAttribute(\'href\', …) wird gemeldet, ein anderes Attribut nicht, ein berechneter Name als „?“', stellen("a.setAttribute('href', q.url); a.setAttribute('aria-hidden', q.x); a.setAttribute(n, q.y)", 'x.ts').join() === "q.url,?a.setAttribute(n, q.y)")
  pruefe('setAttribute(\'HREF\', …) wird gemeldet (Attributnamen ohne Groß/klein)', stellen("a.setAttribute('HREF', q.url)", 'x.ts').join() === 'q.url')
  pruefe('.ts-Datei: <T>x ist eine Typzusicherung, kein JSX', stellen('h("a", { href: <string>q.url })', 'x.ts').join() === '<string>q.url', stellen('h("a", { href: <string>q.url })', 'x.ts'))
}

/** Gefundene Ausdrücke je Datei (mit Anzahl) gegen die Liste: `neu` = ohne Eintrag oder öfter als einmal, `weg` = Eintrag ohne Fundstelle. */
function abweichungen(gefunden: Map<string, Map<string, number>>, erlaubt: Record<string, Record<string, string>>): { neu: string[]; weg: string[] } {
  const neu = [...gefunden].flatMap(([d, as]) =>
    [...as].filter(([a, n]) => !(a in (erlaubt[d] ?? {})) || n > 1).map(([a, n]) => `${d}: ${a}${n > 1 ? ` (${n}×, je Eintrag 1×)` : ''}`),
  )
  const weg = Object.entries(erlaubt).flatMap(([d, as]) => Object.keys(as).filter((a) => !gefunden.get(d)?.has(a)).map((a) => `${d}: ${a}`))
  return { neu, weg }
}

console.log('\nVergleich mit der Liste: Fälle')
{
  const gefunden = new Map([['a.tsx', new Map([['x', 1], ['y', 1]])]])
  const a = abweichungen(gefunden, { 'a.tsx': { x: 'g', z: 'g' } })
  pruefe('ein Ausdruck ohne Eintrag ist `neu`, einer ohne Fundstelle `weg`', a.neu.join() === 'a.tsx: y' && a.weg.join() === 'a.tsx: z', a)
  pruefe('eine Datei ohne Liste: alles ist `neu`', abweichungen(gefunden, {}).neu.length === 2)
  pruefe('deckungsgleich: keine Abweichung', abweichungen(gefunden, { 'a.tsx': { x: 'g', y: 'g' } }).neu.length === 0)
  const zweimal = abweichungen(new Map([['a.tsx', new Map([['x', 2]])]]), { 'a.tsx': { x: 'g' } })
  pruefe('zwei Fundstellen desselben Ausdrucks, einer erlaubt: `neu` (Prüfer 1598 A5a)', zweimal.neu.join() === 'a.tsx: x (2×, je Eintrag 1×)', zweimal)
}

function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dateien(join(ordner, e.name)) : /\.tsx?$/.test(e.name) ? [join(ordner, e.name)] : []))
}

console.log('\nDateiauswahl: .ts und .tsx, auch in Unterordnern')
{
  const ordner = mkdtempSync(join(tmpdir(), 'beleg-href-'))
  try {
    mkdirSync(join(ordner, 'lib'))
    for (const d of ['lib/a.ts', 'b.tsx', 'c.css', 'd.d.json', 'e.tsx.snap']) writeFileSync(join(ordner, d), '')
    const namen = dateien(ordner).map((d) => relative(ordner, d).replaceAll('\\', '/')).sort()
    pruefe('lib/a.ts und b.tsx, nichts sonst (Prüfer 1598 A5c)', namen.join() === 'b.tsx,lib/a.ts', namen)
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

console.log('\nweb/src: jeder href mit nicht festem Wert ist entschieden')
{
  const wurzel = fileURLToPath(new URL('..', import.meta.url))
  const gefunden = new Map<string, Map<string, number>>()
  for (const d of dateien(join(wurzel, 'web/src'))) {
    const stellen = findeHrefs(readFileSync(d, 'utf8'), d)
    const anzahl = new Map<string, number>()
    for (const s of stellen) anzahl.set(s.ausdruck, (anzahl.get(s.ausdruck) ?? 0) + 1)
    if (stellen.length) gefunden.set(relative(wurzel, d).replaceAll('\\', '/'), anzahl)
  }
  const { neu, weg } = abweichungen(gefunden, ERLAUBT)
  pruefe('kein neuer href ohne Eintrag in ERLAUBT', neu.length === 0, neu)
  pruefe('kein Eintrag in ERLAUBT ohne href', weg.length === 0, weg)
}

if (fehler) {
  console.error(`\n${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nbeleg-href: alle Zusicherungen halten')
