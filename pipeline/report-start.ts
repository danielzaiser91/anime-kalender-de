/**
 * Die Einstiegsseite von `daniel-zum-abarbeiten/` — erzeugt, nicht gepflegt.
 *
 * **Warum sie erzeugt werden muss.** Sie stand bis zum 29.08.2026 von Hand
 * geschrieben da, mit dem Stand vom 24.08. — und war damit das teuerste
 * veraltete Dokument im Projekt: Sie ist die **erste Seite, die Daniel öffnet**,
 * und sie gibt die Reihenfolge vor. Die Zahlen darin lagen um Größenordnungen
 * daneben:
 *
 * | dort | wirklich |
 * |---|---|
 * | „Prime Video: 384 Adressen" | 166 Suchen, 19 Titelseiten |
 * | „Netflix-Rest: 4 Adressen" | 42 Titel |
 * | „Disney+: 40 Verweise" | 1 |
 *
 * Eine Übersicht, die zur größten Aufgabe schickt, ist nur so gut wie ihre
 * Zahlen. Sie entstehen jetzt bei jedem Lauf aus dem ausgelieferten Datensatz
 * und den Listen der Erweiterung.
 *
 * Aufruf: `npm run data:start-liste`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { log } from './lib/util.ts'
import type { Title } from '../shared/types.ts'

/** `globalThis.X = {…}` einlesen, ohne den Code auszuführen. */
function ausListe(pfad: string): Record<string, unknown> {
  try {
    const roh = readFileSync(pfad, 'utf8')
    return JSON.parse(roh.slice(roh.indexOf('= ') + 2)) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** „1 Verweis" statt „1 Verweise" — die Liste liest ein Mensch. */
const zaehl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`

const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as Title[]

/** Offene Verweise je Anbieter — die Arbeit, die ein Urteil braucht. */
const offen = new Map<string, number>()
for (const t of titles) {
  for (const s of t.streams ?? []) {
    if (s.dub === undefined) offen.set(s.platform, (offen.get(s.platform) ?? 0) + 1)
  }
}

const primeSuchen = Object.keys(ausListe('extension/offene-amazon-suche.js')).length
const primeSeiten = Object.keys(ausListe('extension/offene-amazon.js')).length
const netflixListe = Object.keys(ausListe('extension/offene-netflix.js')).length
const disneyListe = Object.keys(ausListe('extension/offene-disney.js')).length

const ohneWeg = titles.filter((t) => !(t.streams ?? []).length && !(t.watchLinks ?? []).length)
const ohneWegMitSynchro = ohneWeg.filter((t) => t.hasVoices).length

/**
 * Was eine Aufgabe wert ist: offene Verweise mal Aufwand je Stück.
 *
 * Sortiert wird nach Ertrag, nicht nach Anbietergröße — bei Netflix kostet ein
 * Titel einen Klick je Folge, bei Prime liest die Erweiterung selbst.
 */
const aufgaben = [
  {
    nr: 1,
    titel: 'Prime Video — Suchseiten',
    datei: null,
    umfang: `${primeSuchen} Suchen`,
    zeit: '~20 s je Titel',
    loest: 'Titel ohne bekannte Produktseite',
    wie: 'Erweiterung: Übersicht öffnen, Zeile anklicken, richtigen Treffer wählen',
  },
  {
    nr: 2,
    titel: 'Prime Video — Titelseiten',
    datei: 'daniel-zum-abarbeiten/07-primevideo.md',
    umfang: `${zaehl(primeSeiten, 'Adresse', 'Adressen')}, ${zaehl(offen.get('primevideo') ?? 0, 'Verweis', 'Verweise')}`,
    zeit: '~15 s je Titel',
    loest: 'die Erweiterung liest die Tonspuren selbst',
    wie: 'Adresse öffnen, warten, melden',
  },
  {
    nr: 3,
    titel: 'Netflix',
    datei: 'daniel-zum-abarbeiten/06-netflix-rest.md',
    umfang: `${zaehl(netflixListe, 'Titel', 'Titel')}, ${zaehl(offen.get('netflix') ?? 0, 'Verweis', 'Verweise')}`,
    zeit: '~1 min je Titel',
    loest: 'die einzige Quelle für Netflix-Tonspuren',
    wie: 'Titelseite öffnen, **Abspielen**, warten, zurück',
  },
  {
    nr: 4,
    titel: 'Crunchyroll',
    datei: 'daniel-zum-abarbeiten/07-crunchyroll.md',
    umfang: zaehl(offen.get('crunchyroll') ?? 0, 'Verweis', 'Verweise'),
    zeit: '~15 s je Titel',
    loest: 'Specials und Filme, die in keinem Block stehen',
    wie: 'Seite ansehen, Kurzschrift in die Liste',
  },
  {
    nr: 5,
    titel: 'YouTube',
    datei: 'daniel-zum-abarbeiten/09-youtube-liste.md',
    umfang: zaehl(offen.get('youtube') ?? 0, 'Verweis', 'Verweise'),
    zeit: '~30 s je Video',
    loest: 'der Videotitel nennt oft schon die Fassung',
    wie: 'Video öffnen, Tonspur hören',
  },
  {
    nr: 6,
    titel: 'Disney+',
    datei: 'daniel-zum-abarbeiten/07-disneyplus.md',
    umfang: `${disneyListe} Titel, ${zaehl(offen.get('disneyplus') ?? 0, 'Verweis', 'Verweise')}`,
    zeit: '~30 s je Titel',
    loest: 'der Playback-Aufruf liest die Sprachen ohne Wiedergabe',
    wie: 'Seite öffnen, Knopf drücken',
  },
].filter((a) => /\d/.test(a.umfang) && !/^0 /.test(a.umfang))

const md: string[] = [
  '# Was zu tun ist',
  '',
  `Stand: ${new Date().toISOString().slice(0, 10)} — **erzeugt aus dem ausgelieferten Datensatz**,`,
  'nicht von Hand gepflegt. Wer hier eine Zahl ändert, ändert sie am',
  'falschen Ort; sie kommt beim nächsten Lauf zurück.',
  '',
  '| # | Aufgabe | Umfang | Zeit je Stück | wozu |',
  '|---|---|---|---|---|',
]
for (const a of aufgaben) {
  const name = a.datei ? `[${a.titel}](${a.datei.replace('daniel-zum-abarbeiten/', '')})` : a.titel
  md.push(`| ${a.nr} | ${name} | ${a.umfang} | ${a.zeit} | ${a.loest} |`)
}
md.push(
  '',
  '**Alles außer Nummer 4 und 5 läuft über die Browser-Erweiterung** aus `extension/`.',
  'Sie zeigt auf jeder Anbieterseite, was dort noch offen ist, liest die Tonspuren und',
  'schickt die Meldung ab. Die Listen hier sind zum Nachschlagen, nicht zum Abtippen.',
  '',
  '## Was das bringt',
  '',
  `Von ${titles.length} Titeln zeigen **${ohneWeg.length}** keinen einzigen Bezugsweg,`,
  `**${ohneWegMitSynchro}** davon mit belegter deutscher Synchro. Für die ist die`,
  'Antwort auf „wo kann ich das sehen?" heute: nirgends bekannt. Jede Meldung von hier',
  'macht eine davon weniger.',
  '',
  '## Zum Nachschlagen, nicht zum Abarbeiten',
  '',
  '- [07-alle-anbieter.md](07-alle-anbieter.md) — die Kurzschrift zum Antworten',
  '- [08-arbeitspakete.md](08-arbeitspakete.md) — dieselbe Arbeit in Blöcken',
  '- [10-kinostarts.md](10-kinostarts.md) — Kinotermine, die eine Fassung brauchen',
  '- [12-verpasste-termine.md](12-verpasste-termine.md) — Termine, die ein Anbieter hat verstreichen lassen',
  '- [13-tonspur-verdacht.md](13-tonspur-verdacht.md) — Verweise, denen eine zweite Quelle widerspricht',
  '',
  /*
    **Der Ordner sieht nach mehr Arbeit aus, als darin steckt.**

    Daniel am 31.08.2026: „liest sich als wäre da mehr arbeit für mich." Die
    je-Anbieter-Listen und die Sammelliste zeigen **dieselben** Verweise, nur
    anders geschnitten — wer alle zusammenzählt, zählt jeden mehrfach.

    Fünf Anleitungen, deren Aufgabe erledigt ist, liegen seit dem 31.08.2026
    unter `archiv/`: die alte Prime-Liste mit 385 Adressen (heute sind es zwei),
    die Crunchyroll- und ADN-Stichproben (beide Quellen lesen wir inzwischen je
    Folge), der YouTube-Schlüssel (geprüft, bringt nichts) und die
    Disney+-Handanleitung (die Erweiterung deckt es ab).
  */
  '## Warum hier weniger steht, als es aussieht',
  '',
  'Die Zeilen 2 bis 6 oben sind **eine** Menge Verweise, geschnitten nach Anbieter.',
  'Die Sammelliste und die Arbeitspakete zeigen dieselben noch einmal am Stück —',
  'wer alles zusammenzählt, zählt jeden Verweis mehrfach.',
  '',
  'Erledigte Anleitungen stehen unter [archiv/](archiv/) und sind kein offener Punkt.',
  '',
)

writeFileSync('daniel-zum-abarbeiten/00-START-HIER.md', md.join('\n'))
log(`00-START-HIER.md geschrieben: ${aufgaben.length} Aufgaben, ${ohneWeg.length} Titel ohne Weg`)
