#!/usr/bin/env node
/*
  Schattenlauf: Reihen aus aniSearch-Relationen gegen unsere `franchiseId`.

  Wir lösen AniList als Quelle ab; die Reihen-Struktur kommt heute aus
  AniLists `relations` (siehe `pipeline/bau/03-reihen.ts`). aniSearch führt
  eigene Relationen, und ob sie dieselben Reihen ergeben, war nie gemessen.
  Dieses Werkzeug **misst nur** — es schreibt keinen Datensatz um.

  Es liest die archivierten Seiten `data/anisearch-raw/<id>.html.gz`, zieht
  den Abschnitt `<section id="relations">` heraus, zählt die Kanten je
  Relationstyp und bildet je Variante zusammenhängende Komponenten. Dann
  vergleicht es sie mit den Gruppen aus `public/data/titles.json`
  (`franchiseId`), begrenzt auf Titel, die in beiden Quellen vorkommen.

  Ausgabe: `docs/wissen/schattenlauf-reihen.md` (Bericht) und
  `docs/wissen/schattenlauf-reihen.json` (vollständige Abweichungsliste).
  Aufruf: `node tools/archiv/schattenlauf-reihen.mjs`
*/
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RAW = resolve(ROOT, 'data/anisearch-raw')

/**
 * Welche Relationstypen heißen „gleiche Reihe"?
 *
 * Die Typen stehen als Text im `<div class="header">` der Relation — gelesen
 * aus den Daten, nicht angenommen. aniSearch mischt dabei Deutsch und
 * Englisch (`Sequel` neben `Nebengeschichte`).
 *
 * Begründung je Typ in `docs/wissen/schattenlauf-reihen.md` §3.
 */
const KERN = ['Sequel', 'Prequel', 'Hauptgeschichte', 'Nebengeschichte', 'Zusammenfassung', 'Komplette Geschichte']
const CHARAKTER = ['Charakter']
const ALTERNATIV = ['Alternative Version', 'Remake']
const LOCKER = ['Anderes', 'Gemeinsames Universum', 'Alternative Umgebung', 'Crossover', '?']

// Für den Bericht: AniList-Entsprechung je Typ (nur Erläuterung, keine Rechnung).
const ANILIST_ENTSPRECHUNG = {
  Sequel: 'SEQUEL',
  Prequel: 'PREQUEL',
  Hauptgeschichte: 'PARENT',
  Nebengeschichte: 'SIDE_STORY',
  Zusammenfassung: 'SUMMARY',
  'Komplette Geschichte': 'COMPILATION',
  Charakter: '(kein Gegenstück)',
  'Alternative Version': 'ALTERNATIVE',
  Remake: 'ALTERNATIVE',
  'Alternative Umgebung': '(kein Gegenstück)',
  Anderes: 'OTHER (bei uns nur mit Namensprüfung)',
  Crossover: '(kein Gegenstück)',
  'Gemeinsames Universum': '(kein Gegenstück)',
  '?': '(aniSearch kennt den Typ nicht)',
}

const VARIANTEN = [
  { name: 'A', titel: 'Kern', typen: KERN },
  { name: 'B', titel: 'Kern + Charakter', typen: [...KERN, ...CHARAKTER] },
  { name: 'C', titel: 'Kern + Alternative Version/Remake (wie AniLists ALTERNATIVE)', typen: [...KERN, ...ALTERNATIV] },
  { name: 'D', titel: 'alle Anime-Typen (Obergrenze)', typen: [...KERN, ...CHARAKTER, ...ALTERNATIV, ...LOCKER] },
]

const entitaet = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim()

/** Ein Relationseintrag: `<div class="header">Typ</div><a href="art/id,slug" …>`. */
const EINTRAG = /<div class="header">([^<]*)<\/div><a href="([a-z-]+)\/(\d+),([^"]*)" class="([a-z-]+)-item">/g
const FELDER = /<span class="date">([^<]*)<\/span><span class="title">([^<]*)<\/span>/

/** Liest alle Relationseinträge aus allen archivierten Seiten. */
function leseRelationen() {
  const kanten = [] // { von, nach, typ, art, titel, datum }
  const seiten = new Set()
  let eintraegeGesamt = 0
  let seitenMitAbschnitt = 0
  for (const datei of readdirSync(RAW).filter((f) => f.endsWith('.html.gz'))) {
    const id = datei.replace('.html.gz', '')
    seiten.add(id)
    const html = gunzipSync(readFileSync(resolve(RAW, datei))).toString('utf8')
    const auf = html.indexOf('<section id="relations"')
    if (auf < 0) continue
    seitenMitAbschnitt++
    const zu = html.indexOf('</section>', auf)
    const block = html.slice(auf, zu < 0 ? html.length : zu)
    for (const m of block.matchAll(EINTRAG)) {
      eintraegeGesamt++
      const feld = FELDER.exec(block.slice(m.index, m.index + 1200))
      kanten.push({
        von: id,
        nach: m[3],
        typ: entitaet(m[1]),
        art: m[2],
        titel: feld ? entitaet(feld[2]) : '',
        datum: feld ? feld[1] : '',
      })
    }
  }
  return { kanten, seiten, seitenMitAbschnitt, eintraegeGesamt }
}

class UnionFind {
  constructor() {
    this.eltern = new Map()
  }
  find(x) {
    if (!this.eltern.has(x)) this.eltern.set(x, x)
    let w = x
    while (this.eltern.get(w) !== w) w = this.eltern.get(w)
    let c = x
    while (this.eltern.get(c) !== w) {
      const n = this.eltern.get(c)
      this.eltern.set(c, w)
      c = n
    }
    return w
  }
  union(a, b) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    // Die kleinere Kennung gewinnt — wie in `pipeline/bau/03-reihen.ts`.
    if (ra < rb) this.eltern.set(rb, ra)
    else this.eltern.set(ra, rb)
  }
}

/** Zusammenhängende Komponenten über die Kanten der erlaubten Typen. */
function komponenten(ids, kanten, erlaubt) {
  const uf = new UnionFind()
  for (const id of ids) uf.find(id)
  for (const k of kanten) {
    if (!erlaubt.has(k.typ)) continue
    uf.union(k.von, k.nach)
  }
  const teile = new Map()
  for (const id of ids) {
    const r = uf.find(id)
    if (!teile.has(r)) teile.set(r, [])
    teile.get(r).push(id)
  }
  return teile
}

/**
 * Vergleicht zwei Einteilungen derselben Knotenmenge.
 *
 * Klassifiziert wird **von unserer Gruppe aus** — das ist die Frage, die zählt:
 * „Was macht aniSearch aus einer Reihe, die wir kennen?"
 *
 * - `gleich`   : unsere Gruppe ist genau eine aniSearch-Gruppe
 * - `mehr`     : aniSearch führt mehr zusammen (unsere Gruppe ist echte Teilmenge)
 * - `weniger`  : aniSearch trennt, was wir zusammenhalten
 * - `kreuzen`  : beide Gruppierungen überschneiden sich nur teilweise
 */
function vergleiche(unsereIds, unsereGruppe, anisGruppe) {
  const unsereKinder = new Map()
  const kompKinder = new Map()
  for (const id of unsereIds) {
    const g = unsereGruppe.get(id)
    if (!unsereKinder.has(g)) unsereKinder.set(g, [])
    unsereKinder.get(g).push(id)
    const k = anisGruppe.get(id)
    if (!kompKinder.has(k)) kompKinder.set(k, [])
    kompKinder.get(k).push(id)
  }
  const einteilung = { gleich: [], mehr: [], weniger: [], kreuzen: [] }
  for (const [g, teile] of unsereKinder) {
    const komps = [...new Set(teile.map((id) => anisGruppe.get(id)))]
    if (komps.length === 1) {
      const komp = kompKinder.get(komps[0])
      if (komp.length === teile.length) einteilung.gleich.push({ reihe: g, teile })
      else einteilung.mehr.push({ reihe: g, teile, fremd: komp.filter((id) => !teile.includes(id)) })
    } else {
      const alleDrin = komps.every((k) => kompKinder.get(k).every((id) => teile.includes(id)))
      // Die eigene Gruppe steht in jeder Abweichung mit vorn: das größte Stück
      // zuerst, damit Beispiele lesbar bleiben.
      const stuecke = komps.map((k) => kompKinder.get(k)).sort((a, b) => b.length - a.length)
      if (alleDrin) einteilung.weniger.push({ reihe: g, teile, stuecke })
      else einteilung.kreuzen.push({ reihe: g, teile, stuecke })
    }
  }
  return einteilung
}

/**
 * Zählt, welcher Typ als Gegenkante welchen Typs auftritt.
 *
 * aniSearch führt eine Relation auf beiden Seiten — mit umgekehrtem Etikett.
 * Gemessen: Kanten zwischen zwei archivierten Seiten haben **immer** eine
 * Gegenkante; fehlt sie, fehlt die Seite des Ziels. Deshalb sehen die
 * Typzahlen in §2 paarweise gleich aus.
 */
function zaehleGegenkanten(animeKanten) {
  const nach = new Map()
  for (const k of animeKanten) nach.set(`${k.von}|${k.nach}`, k.typ)
  const gegen = new Map()
  const gesehen = new Set()
  let mit = 0
  for (const k of animeKanten) {
    const g = nach.get(`${k.nach}|${k.von}`)
    if (!g) continue
    mit++
    // Ungeordnet zählen: „Sequel → Prequel" und „Prequel → Sequel" sind dieselbe
    // Verbindung, von beiden Seiten gesehen.
    const id = [k.von, k.nach].sort().join('|')
    if (gesehen.has(id)) continue
    gesehen.add(id)
    const key = [k.typ, g].sort().join(' ↔ ')
    gegen.set(key, (gegen.get(key) ?? 0) + 1)
  }
  return { liste: [...gegen].sort((a, b) => b[1] - a[1]), mit, ohne: animeKanten.length - mit }
}

function zaehleTypen(kanten) {
  const je = { anime: new Map(), andere: new Map() }
  for (const k of kanten) {
    const ziel = k.art === 'anime' ? je.anime : je.andere
    const schluessel = k.art === 'anime' ? k.typ : `${k.art}: ${k.typ}`
    ziel.set(schluessel, (ziel.get(schluessel) ?? 0) + 1)
  }
  const sortiert = (m) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return { anime: sortiert(je.anime), andere: sortiert(je.andere) }
}

function main() {
  const { kanten, seiten, seitenMitAbschnitt, eintraegeGesamt } = leseRelationen()
  const typen = zaehleTypen(kanten)
  const animeKanten = kanten.filter((k) => k.art === 'anime')
  const gegenkanten = zaehleGegenkanten(animeKanten)
  const zieleOhneSeite = new Set(animeKanten.filter((k) => !seiten.has(k.nach)).map((k) => k.nach)).size
  console.log(`Archiv: ${seiten.size} Seiten (${seitenMitAbschnitt} mit Relations-Abschnitt), ${eintraegeGesamt} Einträge`)
  console.log(`davon Anime→Anime: ${animeKanten.length}, davon ${zieleOhneSeite} verschiedene Ziele ohne eigene Seite`)

  const titelListe = JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8'))
  const bruecke = JSON.parse(readFileSync(resolve(ROOT, 'data/anisearch.json'), 'utf8'))
  const titel = new Map()
  for (const t of titelListe) {
    titel.set(t.id, { name: t.titleDe || t.titleEn || t.titleRomaji || t.slug, franchiseId: t.franchiseId })
  }

  const { asNachAni, scope, ohneBruecke, ohneSeite } = vergleichsmenge(titelListe, bruecke, seiten)
  console.log(`Bestand: ${titelListe.length} Titel, Vergleichsmenge: ${scope.length}`)
  console.log(`  ohne aniSearch-Brücke: ${ohneBruecke}, Brücke ohne archivierte Seite: ${ohneSeite}`)

  // Kanten auf die Vergleichsmenge begrenzen — beide Enden müssen drin sein.
  const kantenScope = animeKanten
    .filter((k) => asNachAni.has(k.von) && asNachAni.has(k.nach))
    .map((k) => ({ von: String(asNachAni.get(k.von)), nach: String(asNachAni.get(k.nach)), typ: k.typ }))
  console.log(`Kanten innerhalb der Vergleichsmenge: ${kantenScope.length}`)

  const jeTypImScope = new Map()
  for (const k of kantenScope) jeTypImScope.set(k.typ, (jeTypImScope.get(k.typ) ?? 0) + 1)

  const scopeIds = scope.map(String)
  const unsereGruppe = new Map(scopeIds.map((id) => [id, titel.get(Number(id)).franchiseId]))

  const ergebnis = bewerteVarianten(scopeIds, kantenScope, unsereGruppe)

  const datenbasis = {
    seiten: seiten.size,
    seitenMitRelationsAbschnitt: seitenMitAbschnitt,
    relationseintraegeGesamt: eintraegeGesamt,
    animeKantenArchiv: animeKanten.length,
    zieleOhneEigeneSeite: zieleOhneSeite,
    animeKantenOhneZielseite: animeKanten.filter((k) => !seiten.has(k.nach)).length,
    kantenMitGegenkante: gegenkanten.mit,
    bestand: titelListe.length,
    vergleichsmenge: scope.length,
    ohneBruecke,
    brueckeOhneArchivierteSeite: ohneSeite,
    kantenInVergleichsmenge: kantenScope.length,
  }

  schreibeJson({ datenbasis, typen, gegenkanten, scopeIds, titel, ergebnis })

  writeFileSync(
    resolve(ROOT, 'docs/wissen/schattenlauf-reihen.md'),
    bericht({ titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }),
  )
  console.log('geschrieben: docs/wissen/schattenlauf-reihen.md und .json')
}

/** Der Name unserer Reihe: die Wurzel der Gruppe, sonst ihr kleinster Teil. */
function reiheName(titel, reihe, teile) {
  const wurzel = titel.get(Number(reihe))
  if (wurzel) return wurzel.name
  // Die Wurzel ist die kleinste Kennung der Vereinigung — und die kann ein
  // AniList-Eintrag sein, der nicht in unserem Bestand steht.
  const min = [...teile].map(Number).sort((a, b) => a - b)[0]
  return `${name(titel, min)} (kleinster Teil)`
}

function name(titel, id) {
  if (id === undefined) return '?'
  const t = titel.get(Number(id))
  return t ? t.name : `#${id} (nicht im Bestand)`
}

function liste(titel, ids, max = 5) {
  const n = ids.map((id) => name(titel, id))
  if (n.length <= max) return n.join(', ')
  return `${n.slice(0, max).join(', ')} … (+${n.length - max})`
}

function bericht(ctx) {
  const z = []

  z.push('# Schattenlauf: Reihen aus aniSearch-Relationen (04.10.2026)', '')
  z.push(
    'Gemessen mit `node tools/archiv/schattenlauf-reihen.mjs` — **nichts umgestellt**. Die vollständige',
    'Abweichungsliste liegt in [schattenlauf-reihen.json](schattenlauf-reihen.json).',
    '',
  )

  abschnittWasGemessen(z, ctx)

  abschnittKanten(z, ctx)

  abschnittAuswahl(z, ctx)

  abschnittVergleich(z, ctx)

  abschnittBeispiele(z, ctx)

  abschnittGrenzen(z, ctx)
  return z.join('\n')
}

function abschnittWasGemessen(z, { titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }) {
  const hol = (m, k) => m.get(k) ?? 0
  const A = ergebnis.A
  z.push('## 1. Was gemessen wurde', '')
  z.push(
    `- Archiv: **${datenbasis.seiten} aniSearch-Seiten** (alle mit Relations-Abschnitt),`,
    `  **${datenbasis.relationseintraegeGesamt} Relationseinträge**, davon **${datenbasis.animeKantenArchiv} Anime→Anime**.`,
    '  Der Rest zeigt auf Manga oder Realfilm — „Originalwerk" fast immer auf die Vorlage.',
    `- **${datenbasis.animeKantenOhneZielseite} Anime-Kanten haben keine Gegenkante** — das Ziel hat keine`,
    `  archivierte Seite (${datenbasis.zieleOhneEigeneSeite} verschiedene Einträge). Diese Relationen werden nicht gesehen.`,
    `- Bestand: **${datenbasis.bestand} Titel**, Vergleichsmenge **${datenbasis.vergleichsmenge}**`,
    `  (${datenbasis.ohneBruecke} ohne Brücke in \`data/anisearch.json\`, ${datenbasis.brueckeOhneArchivierteSeite} mit Brücke, aber ohne Seite).`,
    `- Kanten, deren **beide** Enden in der Vergleichsmenge liegen: **${datenbasis.kantenInVergleichsmenge}**.`,
    '',
  )
}

function abschnittKanten(z, { titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }) {
  const hol = (m, k) => m.get(k) ?? 0
  const A = ergebnis.A
  z.push('## 2. Kanten je Relationstyp', '')
  z.push('Nur Anime→Anime (die übrigen Medien zählen für Reihen nicht):', '')
  z.push('| Typ | Kanten | davon in der Vergleichsmenge | AniList-Entsprechung |', '|---|---:|---:|---|')
  for (const [t, n] of typen.anime) z.push(`| ${t} | ${n} | ${hol(jeTypImScope, t)} | ${ANILIST_ENTSPRECHUNG[t] ?? '—'} |`)
  z.push('')
  z.push(
    `**${datenbasis.kantenMitGegenkante} der ${datenbasis.animeKantenArchiv} Anime-Kanten haben eine Gegenkante** —`,
    'aniSearch führt jede Relation auf beiden Seiten, mit umgekehrtem Etikett. Fehlt die',
    'Gegenkante, hat das Ziel keine archivierte Seite (§6). Deshalb stehen in der Tabelle oben',
    'mehrere Typen paarweise gleich hoch. Die häufigsten Paare (je Verbindung einmal gezählt):',
    '',
    '| Typ | Gegenkante | Verbindungen |',
    '|---|---|---:|',
  )
  for (const [k, n] of gegenkanten.liste.slice(0, 8)) {
    const [von, nach] = k.split(' ↔ ')
    z.push(`| ${von} | ${nach} | ${n} |`)
  }
  z.push('')
  z.push('Nicht-anime Relationen (nur zur Einordnung):', '')
  z.push('| Ziel | Typ | Kanten |', '|---|---|---:|')
  for (const [t, n] of typen.andere) {
    const schnitt = t.indexOf(': ')
    z.push(`| ${t.slice(0, schnitt)} | ${t.slice(schnitt + 2)} | ${n} |`)
  }
  z.push('')
}

function abschnittAuswahl(z, { titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }) {
  const hol = (m, k) => m.get(k) ?? 0
  const A = ergebnis.A
  z.push('## 3. Die Auswahl der Relationstypen', '')
  z.push(
    '**Als „gleiche Reihe" gezählt (Kern):**',
    '',
    '| Typ | Kanten | warum |',
    '|---|---:|---|',
    `| Sequel | ${hol(jeTypImScope, 'Sequel')} | Fortsetzung derselben Geschichte |`,
    `| Prequel | ${hol(jeTypImScope, 'Prequel')} | Vorgänger derselben Geschichte |`,
    `| Hauptgeschichte | ${hol(jeTypImScope, 'Hauptgeschichte')} | der Hauptteil, dem ein Special zugeordnet ist |`,
    `| Nebengeschichte | ${hol(jeTypImScope, 'Nebengeschichte')} | Side Story derselben Reihe |`,
    `| Zusammenfassung | ${hol(jeTypImScope, 'Zusammenfassung')} | Recap oder Filmschnitt derselben Reihe |`,
    `| Komplette Geschichte | ${hol(jeTypImScope, 'Komplette Geschichte')} | Zusammenschnitt der ganzen Reihe |`,
    '',
    'Diese sechs tragen denselben Sinn wie die Typen, aus denen `FRANCHISE_RELATIONS` unsere',
    '`franchiseId` baut (`SEQUEL`, `PREQUEL`, `PARENT`, `SIDE_STORY`, `SUMMARY`, `COMPILATION`).',
    'Kanten je Typ sind hier die Zahlen **in der Vergleichsmenge**, nicht im ganzen Archiv.',
    '',
    '**Bewusst nicht gezählt:**',
    '',
    '| Typ | Kanten | warum nicht |',
    '|---|---:|---|',
    `| Anderes | ${hol(jeTypImScope, 'Anderes')} | Sammelbecken. aniSearch legt dort Werbeclips und Musikvideos ab, aber auch echte Reihenkanten (siehe §5). AniList hat denselben Topf \`OTHER\` und wir zählen ihn nur bei passendem Namen (\`otherZaehlt\`). Als Variante **D** mitgemessen. |`,
    `| Charakter | ${hol(jeTypImScope, 'Charakter')} | Auftritt einer Figur, nicht Zugehörigkeit zur Reihe (Sonic taucht bei Herlock auf). Variante **B**. |`,
    `| Alternative Version | ${hol(jeTypImScope, 'Alternative Version')} | eigene Fassung, nicht dieselbe Erzählung. AniList zählt \`ALTERNATIVE\` mit — Variante **C**. |`,
    `| Remake | ${hol(jeTypImScope, 'Remake')} | Neufassung, wie oben in Variante C. |`,
    `| Alternative Umgebung | ${hol(jeTypImScope, 'Alternative Umgebung')} | andere Welt, dieselben Figuren (Touken Ranbu: Hanamaru gegen Katsugeki). Kein AniList-Gegenstück. |`,
    `| Gemeinsames Universum | ${hol(jeTypImScope, 'Gemeinsames Universum')} | lockerer Zusammenhang ohne gemeinsame Handlung (Beyblade gegen BeyWarriors). |`,
    `| Crossover | ${hol(jeTypImScope, 'Crossover')} | zwei Reihen zugleich — \`03-reihen.ts\` zieht das ausdrücklich **nicht** zusammen. |`,
    `| ? | ${hol(jeTypImScope, '?')} | aniSearch kennt den Typ nicht. Nicht geraten. |`,
    '',
    'Daraus vier Varianten: **A** Kern, **B** Kern + Charakter, **C** Kern + Alternative/Remake',
    '(entspricht AniLists Set am nächsten), **D** alle Anime-Typen als Obergrenze.',
    '',
    'Ein **Spin-Off**-Typ für Anime-Ziele fehlt: `Adaption: Spin-Off` steht nur an Kanten zu',
    'Manga- (53) und Film-Einträgen (2), nie zwischen zwei Anime. AniList führt `SPIN_OFF`',
    'dagegen als eigenen Reihentyp — hier decken sich die Quellen nicht.',
    '',
  )
}

function abschnittVergleich(z, { titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }) {
  const hol = (m, k) => m.get(k) ?? 0
  const A = ergebnis.A
  z.push('## 4. Vergleich mit unserer `franchiseId`', '')
  z.push(
    'Gezählt wird **von unserer Reihe aus**: Was macht aniSearch aus einer Reihe, die wir kennen?',
    '',
    '- **gleich** — unsere Reihe ist genau eine aniSearch-Gruppe',
    '- **aniSearch führt mehr zusammen** — unsere Reihe ist echte Teilmenge einer größeren Gruppe',
    '- **aniSearch trennt** — unsere Reihe zerfällt in mehrere Gruppen',
    '- **kreuzen** — beide Einteilungen überschneiden sich nur teilweise',
    '',
    '| Variante | aniSearch-Gruppen | gleich | aniSearch mehr | aniSearch trennt | kreuzen |',
    '|---|---:|---:|---:|---:|---:|',
  )
  for (const v of Object.values(ergebnis)) {
    z.push(`| ${v.variante.name}: ${v.variante.titel} | ${v.komponenten} | ${v.anzahl.gleich} | ${v.anzahl.mehr} | ${v.anzahl.weniger} | ${v.anzahl.kreuzen} |`)
  }
  z.push('')
  z.push(
    'Dieselbe Zählung nur für unsere Reihen mit **zwei oder mehr** Teilen — die vielen',
    'Einzeltitel verzerren das Bild sonst, weil eine einelementige Gruppe fast immer „gleich"',
    'oder „aniSearch führt mehr zusammen" ist:',
    '',
    '| Variante | gleich | aniSearch mehr | aniSearch trennt | kreuzen |',
    '|---|---:|---:|---:|---:|',
  )
  for (const v of Object.values(ergebnis)) {
    z.push(`| ${v.variante.name} | ${v.anzahlAbZwei.gleich} | ${v.anzahlAbZwei.mehr} | ${v.anzahlAbZwei.weniger} | ${v.anzahlAbZwei.kreuzen} |`)
  }
  z.push('')
  z.push(
    '**Der Abstand zwischen den Varianten ist die Antwort auf die Ausgangsfrage:**',
    `„aniSearch trennt" fällt von ${A.anzahl.weniger} Fällen im Kern auf ${ergebnis.D.anzahl.weniger}, wenn alle Anime-Typen`,
    `mitzählen — ${A.anzahl.weniger - ergebnis.D.anzahl.weniger} der ${A.anzahl.weniger} Trennungen entstehen also allein daraus, **welche`,
    'Relationstypen wir mitzählen**. Die übrigen beruhen auf Kanten zu Seiten, die nicht im',
    'Archiv liegen (§6). Umgekehrt steigt „aniSearch führt mehr zusammen" von',
    `${A.anzahl.mehr} auf ${ergebnis.D.anzahl.mehr}: Die locker gebundenen Typen verschmelzen dann Reihen, die bei uns`,
    'getrennt stehen — die Obergrenze ist keine Empfehlung.',
    '',
  )
}

function abschnittBeispiele(z, { titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }) {
  const hol = (m, k) => m.get(k) ?? 0
  const A = ergebnis.A
  z.push('## 5. Beispiele', '')
  z.push(
    'Je Abweichungsart 15 Beispiele aus **Variante A**; die vollständigen Listen aller vier',
    'Varianten stehen im JSON. Namen sind `titleDe`, sonst `titleEn`/`titleRomaji`.',
    '',
  )
  for (const [art, kopf] of [
    ['mehr', 'aniSearch führt mehr zusammen als wir'],
    ['weniger', 'aniSearch trennt, was wir zusammenhalten'],
    ['kreuzen', 'die Einteilungen kreuzen sich'],
  ]) {
    const faelle = A.abweichungen[art]
    z.push(`### ${kopf} (${faelle.length} Fälle, Variante A)`, '')
    if (!faelle.length) {
      z.push('Kein Fall.', '')
      continue
    }
    z.push('| unsere Reihe | unsere Teile | aniSearch |', '|---|---|---|')
    for (const e of faelle.slice(0, 15)) {
      let anis
      if (art === 'mehr') anis = `eine Gruppe mit ${e.teile.length + e.fremd.length}, zusätzlich: ${liste(titel, e.fremd, 4)}`
      else {
        const stuecke = e.stuecke
          .slice(0, 4)
          .map((s) => `[${liste(titel, s, 3)}]`)
          .join(' / ')
        anis = `${e.stuecke.length} Gruppen: ${stuecke}${e.stuecke.length > 4 ? ` … (+${e.stuecke.length - 4})` : ''}`
      }
      z.push(`| ${reiheName(titel, e.reihe, e.teile)} (${e.teile.length}) | ${liste(titel, e.teile, 4)} | ${anis} |`)
    }
    z.push('')
    if (art === 'weniger') {
      z.push(
        'Die kleinen Stücke sind fast immer über einen Typ verbunden, den der Kern nicht zählt —',
        'meist „Anderes", oft „Gemeinsames Universum". Beispiel aus der Pokémon-Reihe:',
        '„Pikachus Ferien" hängt an „Pokémon: Der Film – Mewtu gegen Mew" mit **Anderes**,',
        '„Pokémon Ranger: Spuren des Lichts" an „Pokémon: Diamant & Perl" mit **Gemeinsames',
        'Universum**. Beide stehen bei uns in der Reihe, weil AniList sie über andere Kanten',
        'anbindet.',
        '',
      )
    }
  }
}

function abschnittGrenzen(z, { titel, typen, jeTypImScope, gegenkanten, ergebnis, datenbasis }) {
  const hol = (m, k) => m.get(k) ?? 0
  const A = ergebnis.A
  z.push('## 6. Was dieser Lauf nicht sagt', '')
  z.push(
    `- **${datenbasis.animeKantenOhneZielseite} Anime-Kanten haben keine Gegenkante** (${datenbasis.zieleOhneEigeneSeite} verschiedene Ziele).`,
    '  Da Relationen paarweise gespeichert werden, heißt das: Zu diesen Zielen liegt keine',
    '  archivierte Seite vor. Fehlt die Seite, fehlt die Kante — und ein Titel kann getrennt',
    '  erscheinen, obwohl aniSearch ihn anbindet.',
    '- Ein Relationsabschnitt ist eine Aussage von aniSearch; ob sie stimmt, prüft dieser Lauf nicht.',
    '- Die Variantenwahl ist eine Entscheidung, keine Messung. Die Zahlen dazu stehen in §4.',
    '- „Gleich" bei einelementigen Reihen heißt nur, dass beide Seiten nichts verbinden — nicht,',
    '  dass beide dasselbe über den Titel wissen.',
    '',
  )
}

function schreibeJson({ datenbasis, typen, gegenkanten, scopeIds, titel, ergebnis }) {
  const json = {
    erzeugt: '2026-10-04',
    werkzeug: 'tools/archiv/schattenlauf-reihen.mjs',
    datenbasis,
    typen: { anime: typen.anime, andere: typen.andere },
    gegenkanten: gegenkanten.liste,
    titel: Object.fromEntries(scopeIds.map((id) => [id, titel.get(Number(id)).name])),
    varianten: Object.fromEntries(
      Object.entries(ergebnis).map(([k, v]) => [
        k,
        {
          titel: v.variante.titel,
          typen: v.variante.typen,
          komponenten: v.komponenten,
          anzahl: v.anzahl,
          anzahlAbZwei: v.anzahlAbZwei,
          abweichungen: v.abweichungen,
        },
      ]),
    ),
  }
  writeFileSync(resolve(ROOT, 'docs/wissen/schattenlauf-reihen.json'), JSON.stringify(json, null, 1) + '\n')
}

function bewerteVarianten(scopeIds, kantenScope, unsereGruppe) {
  const ergebnis = {}
  for (const variante of VARIANTEN) {
    const anisGruppe = new Map()
    const komps = komponenten(scopeIds, kantenScope, new Set(variante.typen))
    let nr = 0
    for (const [, teile] of komps) {
      const k = `K${++nr}`
      for (const id of teile) anisGruppe.set(id, k)
    }
    const einteilung = vergleiche(scopeIds, unsereGruppe, anisGruppe)
    for (const art of ['mehr', 'weniger', 'kreuzen']) {
      einteilung[art].sort((a, b) => b.teile.length - a.teile.length || a.reihe - b.reihe)
    }
    const anzahl = {
      gleich: einteilung.gleich.length,
      mehr: einteilung.mehr.length,
      weniger: einteilung.weniger.length,
      kreuzen: einteilung.kreuzen.length,
    }
    ergebnis[variante.name] = {
      variante,
      komponenten: komps.size,
      anzahl,
      anzahlAbZwei: {
        gleich: einteilung.gleich.filter((e) => e.teile.length >= 2).length,
        mehr: einteilung.mehr.filter((e) => e.teile.length >= 2).length,
        weniger: einteilung.weniger.filter((e) => e.teile.length >= 2).length,
        kreuzen: einteilung.kreuzen.filter((e) => e.teile.length >= 2).length,
      },
      abweichungen: einteilung,
    }
    console.log(
      `Variante ${variante.name}: ${anzahl.gleich} gleich, ${anzahl.mehr} aniSearch mehr, ` +
        `${anzahl.weniger} aniSearch weniger, ${anzahl.kreuzen} kreuzen (${komps.size} Gruppen)`,
    )
  }
  return ergebnis
}

function vergleichsmenge(titelListe, bruecke, seiten) {
  // Brücke AniList-ID ↔ aniSearch-ID, begrenzt auf Titel, deren Seite archiviert ist.
  const asNachAni = new Map() // aniSearch-ID -> AniList-ID
  const scope = []
  let ohneBruecke = 0
  let ohneSeite = 0
  for (const t of titelListe) {
    const asId = bruecke[String(t.id)]?.anisearchId
    if (!asId) {
      ohneBruecke++
      continue
    }
    if (!seiten.has(String(asId))) {
      ohneSeite++
      continue
    }
    asNachAni.set(String(asId), t.id)
    scope.push(t.id)
  }
  return { asNachAni, scope, ohneBruecke, ohneSeite }
}


main()
