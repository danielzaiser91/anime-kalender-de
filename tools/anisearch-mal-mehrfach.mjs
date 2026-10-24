/**
 * **Eine MAL-Kennung, mehrere aniSearch-Seiten** (Durarara!! Specials, MAL 8408: Serie 5473, Bonus-Seiten 6984 und 6986, 13.10.2026).
 * Misst am Datensatz, wie oft das vorkommt, was dabei im Bestand steht und ob die Seiten den AniList-Titel Folge für Folge aufteilen
 * (Summe ihrer Folgen = Folgen des Titels: AniList fasst zusammen, aniSearch teilt). Reine Lesewerkzeug-Funktionen; kein Abruf.
 *
 * Aufruf: `node tools/anisearch-mal-mehrfach.mjs` (Liste auf stdout) oder `--schreiben` (ersetzt den Abschnitt in
 * `daniel-zum-abarbeiten/listen/anisearch-doppelte-kennung.md` zwischen den Markern).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { handKennungen } from '../pipeline/lib/hand-kennungen.ts'
import { ergebenSichZusammen } from '../pipeline/lib/mal-teilung.ts'
import { todayIso } from '../shared/time.ts'

export const BASIS = 10_000_000
export const LISTE = 'daniel-zum-abarbeiten/listen/anisearch-doppelte-kennung.md'
export const MARKE_ANFANG = '<!-- mal-mehrfach:anfang -->'
export const MARKE_ENDE = '<!-- mal-mehrfach:ende -->'

const summe = (zahlen) => zahlen.reduce((s, z) => s + (z ?? 0), 0)

/** Alle Ausgabezeilen nach Kennung; `titles.json` und `ohne-synchro.json` können dieselbe Kennung tragen. */
function zeilenIndex(titles, ohneSynchro) {
  const index = new Map()
  for (const [quelle, liste] of [['Hauptbestand', titles], ['Katalog', ohneSynchro]]) {
    for (const t of liste) index.set(t.id, { ...(index.get(t.id) ?? t), ...t, orte: [...(index.get(t.id)?.orte ?? []), quelle] })
  }
  return index
}

/** MAL-Kennung → aniSearch-Kennungen, die sie tragen; nur Gruppen mit mindestens zwei Seiten. */
function seitenJeMal(eintraege) {
  const jeMal = new Map()
  for (const [as, e] of Object.entries(eintraege)) if (e.mal) jeMal.set(e.mal, [...(jeMal.get(e.mal) ?? []), Number(as)])
  return [...jeMal].filter(([, ids]) => ids.length > 1).sort((a, b) => a[0] - b[0])
}

/**
 * Art der Gruppe, aus den Zahlen abgeleitet:
 * - `getrennt`: jede Seite hat einen eigenen AniList-Titel (AniList trennt wie aniSearch);
 * - `ohne-anilist`: kein AniList-Titel im Bestand, jede Seite steht für sich;
 * - `teilung-voll`: genau ein AniList-Titel mit dieser MAL, Summe der Seiten-Folgen = seine Folgen (AniList fasst zusammen, aniSearch teilt);
 * - `teilung-teil`: AniList-Titel da, Summe passt nicht oder mehrere Titel tragen die MAL (Special oder Bonus unter der MAL der Serie).
 */
export function artDerGruppe(seiten, anilist) {
  const ohneTraeger = seiten.filter((s) => !s.traeger.length)
  if (!ohneTraeger.length) return 'getrennt'
  const mitMal = anilist.filter((a) => a.mitMal)
  if (!mitMal.length) return 'ohne-anilist'
  return ergebenSichZusammen(seiten.map((s) => s.folgen), mitMal.map((a) => a.folgen)) ? 'teilung-voll' : 'teilung-teil'
}

/**
 * @param eintraege   `data/anisearch-eintraege.json`
 * @param titles      `public/data/titles.json`
 * @param ohneSynchro `public/data/ohne-synchro.json`
 * @param belegIds    Kennungen (auch ab 10000000), die eine Handdatei nennt (`handKennungen`)
 */
export function findeMalMehrfach(eintraege, titles, ohneSynchro, belegIds = new Set()) {
  const zeilen = zeilenIndex(titles, ohneSynchro)
  const anilistTitel = [...zeilen.values()].filter((t) => t.id < BASIS)
  return seitenJeMal(eintraege).map(([mal, ids]) => {
    const seiten = ids.map((as) => {
      const e = eintraege[String(as)]
      const zeile = zeilen.get(BASIS + as)
      const traeger = anilistTitel.filter((t) => t.anisearchId === as).map((t) => t.id)
      return { as, titel: e.t, art: e.ty, folgen: e.f, dub: e.dub, zeile: zeile?.orte.join('+') ?? null, traeger, beleg: belegIds.has(BASIS + as) }
    })
    const anilist = anilistTitel
      .filter((t) => t.malId === mal || seiten.some((s) => s.traeger.includes(t.id)))
      .map((t) => ({ id: t.id, mitMal: t.malId === mal, folgen: t.episodes, orte: t.orte.join('+'), konfidenz: t.dubConfidence, beleg: belegIds.has(t.id) }))
    const art = artDerGruppe(seiten, anilist)
    const imHaupt = [...anilist, ...seiten.filter((s) => s.zeile)].some((x) => (x.orte ?? x.zeile).includes('Hauptbestand'))
    return { mal, art, imHaupt, seiten, anilist, summe: summe(seiten.map((s) => s.folgen)) }
  })
}

const ART_TEXT = {
  'teilung-voll': 'AniList fasst zusammen, aniSearch teilt (Summe der Seiten = Folgen des Titels)',
  'teilung-teil': 'Special/Bonus unter der MAL einer größeren Einheit (Summe passt nicht oder mehrere Titel)',
  'ohne-anilist': 'kein AniList-Titel mit dieser MAL im Bestand; jede Seite eine eigene Zeile',
  getrennt: 'jede Seite hat ihren eigenen AniList-Titel',
}

const kurz = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

function gruppenZeile(g) {
  const al = g.anilist.map((a) => `${a.id} (${a.folgen ?? '?'} F., ${a.orte}${a.beleg ? ', Beleg' : ''})`).join('; ') || '—'
  const seiten = g.seiten.map((s) => `${s.as}: ${s.folgen ?? '?'}${s.dub === '-' ? '' : ' dt.'}${s.zeile ? ` [${s.zeile}]` : ''}${s.traeger.length ? ` ← ${s.traeger.join(',')}` : ''}${s.beleg ? ' Beleg' : ''}`)
  const text = seiten.length > 6 ? `${seiten.slice(0, 6).join('; ')}; … (${seiten.length} Seiten)` : seiten.join('; ')
  return `| ${g.mal} | ${kurz(g.seiten[0].titel, 38)} | ${al} | ${text} | ${g.summe} |`
}

/** Der Abschnitt der Liste: Zähltabelle, dann je Art die Gruppen (Hauptbestand zuerst). */
export function listeAlsMarkdown(gruppen, stand) {
  const zeilen = [`Stand ${stand}, gemessen an \`data/anisearch-eintraege.json\`, \`public/data/titles.json\`, \`public/data/ohne-synchro.json\` (kein Abruf). Erzeugt mit \`node tools/anisearch-mal-mehrfach.mjs --schreiben\`.`, '']
  zeilen.push(`**${gruppen.length} MAL-Kennungen** tragen zwei oder mehr aniSearch-Seiten (${summe(gruppen.map((g) => g.seiten.length))} Seiten).`, '')
  zeilen.push('| Art | Gruppen | davon im Hauptbestand |', '|---|---|---|')
  for (const art of Object.keys(ART_TEXT)) {
    const g = gruppen.filter((x) => x.art === art)
    zeilen.push(`| ${art}: ${ART_TEXT[art]} | ${g.length} | ${g.filter((x) => x.imHaupt).length} |`)
  }
  for (const art of Object.keys(ART_TEXT)) {
    const g = gruppen.filter((x) => x.art === art).sort((a, b) => Number(b.imHaupt) - Number(a.imHaupt) || a.mal - b.mal)
    if (!g.length) continue
    zeilen.push('', `### ${art}`, '', '| MAL | Seite (erste) | AniList-Titel (Folgen, Ort) | aniSearch-Seiten (Folgen, dt. = Deutsch, [Zeile im Ort], ← getragen von) | Σ Folgen |', '|---|---|---|---|---|')
    zeilen.push(...g.map(gruppenZeile))
  }
  return zeilen.join('\n')
}

/** Ersetzt den Abschnitt zwischen den Markern, legt ihn hinten an, wenn er fehlt. */
export function abschnittEinsetzen(datei, abschnitt) {
  const neu = `${MARKE_ANFANG}\n${abschnitt}\n${MARKE_ENDE}`
  const von = datei.indexOf(MARKE_ANFANG)
  const bis = datei.indexOf(MARKE_ENDE)
  if (von >= 0 && bis > von) return datei.slice(0, von) + neu + datei.slice(bis + MARKE_ENDE.length)
  return `${datei.replace(/\s*$/, '')}\n\n${neu}\n`
}

if (process.argv[1]?.endsWith('anisearch-mal-mehrfach.mjs')) {
  const lies = (p) => JSON.parse(readFileSync(p, 'utf8'))
  const gruppen = findeMalMehrfach(lies('data/anisearch-eintraege.json'), lies('public/data/titles.json'), lies('public/data/ohne-synchro.json'), handKennungen())
  const abschnitt = listeAlsMarkdown(gruppen, todayIso())
  if (process.argv.includes('--schreiben')) writeFileSync(LISTE, abschnittEinsetzen(readFileSync(LISTE, 'utf8'), abschnitt))
  else console.log(abschnitt)
}
