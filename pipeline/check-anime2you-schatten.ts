/**
 * Schattenlauf der Anime2You-Regel (`lib/anime2you-schatten.ts`, `lib/anime2you-schatten-lauf.ts`, `anime2you-schatten.ts`, `anime2you-schatten-auswerten.ts`):
 * Vergleich Regel gegen Claude an echten Artikeln mit Claudes Rohantwort (`tools/anime2you-schatten-faelle.json`, Lauf-Artefakte 25.10. bis 07.11.2026),
 * Rechenregeln der Bilanz an den Schwellen, Ausfälle des Schattens, und die zwei Skripte als eigener Prozess.
 * Die Erwartung der Zahlen aus echten Artikeln steht fest im Test (von Hand am Artikeltext und an Claudes Antwort gelesen), nie aus der Funktion.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Behauptung } from './lib/anime2you-regel.ts'
import {
  bilanz, ergaenzeSchatten, schattenLauf, titelGleich, vergleiche, vergleicheArtikel,
  type Lauf, type SchattenBestand,
} from './lib/anime2you-schatten.ts'
import { SCHATTEN_DATEI, schattenSchritt, leseRohAntwort, type Ablage } from './lib/anime2you-schatten-lauf.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p: string): unknown => JSON.parse(readFileSync(join(wurzel, p), 'utf8'))
interface Echt { id: string; name: string; text?: string; claude: unknown[] }
const echt = lies('tools/anime2you-schatten-faelle.json') as Echt[]
const regelFaelle = lies('tools/anime2you-regel-faelle.json') as { id: string; text: string }[]
const textVon = (e: Echt): string => e.text ?? regelFaelle.find((f) => f.id === e.id)!.text
const fall = (id: string): Echt => echt.find((e) => e.id === id)!

pruefe('Schattendatei liegt in data/proposals (dort greift tools/quellen-liste.sh)', SCHATTEN_DATEI.startsWith('data/proposals/') && SCHATTEN_DATEI.endsWith('.json'), SCHATTEN_DATEI)

/* Echte Artikel: erwartet (gleich / nurRegel / nurClaude) je Artikel. */
const ERWARTET: Record<string, [number, number, number]> = {
  // Iron Man verlässt Netflix: Claude „abgang“, deutsch – dieselbe Aussage wie die Regel; Berserk (omu) nimmt die Regel nicht an.
  '1066661': [1, 0, 0],
  // Aoashi und PSYREN: Claude setzt zusätzlich primevideo (Claudes eigener Fehlbeleg, Regel nur Crunchyroll) → Rest.
  '1064193': [2, 0, 2],
  '1064806': [1, 0, 2],
  '1065078': [0, 0, 6],
  // „soll ab Januar 2027 mit deutscher Synchronisation auf YouTube erscheinen“: Claude „ankuendigung“ und unsicher (Starttermin) – Regel und Claude sagen dasselbe.
  '1067575': [1, 0, 0],
}
for (const [id, [g, r, c]] of Object.entries(ERWARTET)) {
  const e = fall(id)
  const v = vergleicheArtikel(id, textVon(e), e.claude)
  pruefe(`${id} (${e.name}): gleich/nurRegel/nurClaude`, v.gleich === g && v.nurRegel.length === r && v.nurClaude.length === c, [v.gleich, v.nurRegel, v.nurClaude])
}
const aoashi = vergleicheArtikel('1064193', textVon(fall('1064193')), fall('1064193').claude)
pruefe('Aoashi/PSYREN: nurClaude trägt genau Prime Video', aoashi.nurClaude.map((f) => f.plattform).join() === 'primevideo,primevideo', aoashi.nurClaude)

/* Fehlbeleg: die Regel behauptet, Claude nicht. */
const b = (titel: string, plattform: string): Behauptung => ({ titel, plattform, sprache: 'deutsch', zitat: titel, familie: 'satz' })
const rohV = (titel: string, plattform: string, rest: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ titel, plattform, art: 'start', sprache: 'deutsch', unsicher: null, ...rest })
const ohne = vergleiche('x', [b('Foo', 'netflix')], [])
pruefe('Claude ohne Vorschlag: Fehlbeleg ohne Widerspruch', ohne.nurRegel.length === 1 && !ohne.nurRegel[0]!.widerspruch && ohne.gleich === 0, ohne)
const omu = vergleiche('x', [b('Foo', 'netflix')], [rohV('Foo', 'netflix', { sprache: 'omu' })])
pruefe('Claude sagt OmU: Fehlbeleg mit Widerspruch', omu.nurRegel.length === 1 && omu.nurRegel[0]!.widerspruch === true, omu)
const andere = vergleiche('x', [b('Foo', 'netflix')], [rohV('Foo', 'crunchyroll')])
pruefe('Claude nennt andere Plattform: Fehlbeleg und nurClaude', andere.nurRegel.length === 1 && andere.nurClaude.length === 1 && andere.gleich === 0, andere)
const anderer = vergleiche('x', [b('Foo', 'netflix')], [rohV('Bar', 'netflix')])
pruefe('Claude nennt anderen Titel: Fehlbeleg und nurClaude', anderer.nurRegel.length === 1 && anderer.nurClaude.length === 1, anderer)
const zwei = vergleiche('x', [b('Foo', 'netflix'), b('Bar', 'netflix')], [rohV('Foo', 'netflix')])
pruefe('zwei Behauptungen, ein Claude-Vorschlag: gleich 1, nurRegel 1 (Bar)', zwei.gleich === 1 && zwei.nurRegel.map((f) => f.titel).join() === 'Bar', zwei)
for (const art of ['abgang', 'ankuendigung', 'disc', 'pause']) {
  const v = vergleiche('x', [b('Foo', 'netflix')], [rohV('Foo', 'netflix', { art })])
  pruefe(`Art ${art}: dieselbe Aussage, gleich`, v.gleich === 1 && v.nurRegel.length === 0, v)
}
const dt = vergleiche('x', [b('Foo', 'netflix')], [rohV('Foo', 'netflix', { sprache: 'deutsch+omu' })])
pruefe('deutsch+omu zählt als deutsch', dt.gleich === 1, dt)

/* nurClaude: nur belegtragende Vorschläge zählen. */
const nurC = (roh: Record<string, unknown>): number => vergleiche('x', [], [roh]).nurClaude.length
pruefe('belegtragend: deutsch, sicher, start, Stream', nurC(rohV('Foo', 'netflix')) === 1)
pruefe('unsicher als Text: kein Beleg', nurC(rohV('Foo', 'netflix', { unsicher: 'Termin offen' })) === 0)
pruefe('unsicher true: kein Beleg', nurC(rohV('Foo', 'netflix', { unsicher: true })) === 0)
pruefe('OmU: kein Beleg', nurC(rohV('Foo', 'netflix', { sprache: 'omu' })) === 0)
pruefe('Sprache unklar: kein Beleg', nurC(rohV('Foo', 'netflix', { sprache: 'unklar' })) === 0)
for (const art of ['disc', 'kino', 'ankuendigung', 'pause', 'abgang', 'rhythmus']) pruefe(`Art ${art}: kein Beleg`, nurC(rohV('Foo', 'netflix', { art })) === 0)
for (const art of ['start', 'folgen', 'sprachfassung']) pruefe(`Art ${art}: Beleg`, nurC(rohV('Foo', 'netflix', { art })) === 1)
for (const p of ['tv', 'disc', 'kino']) pruefe(`Plattform ${p}: kein Stream, kein Beleg`, nurC(rohV('Foo', p)) === 0)
pruefe('Plattform null: kein Beleg', nurC(rohV('Foo', 'x', { plattform: null })) === 0)
pruefe('Vorschlag ohne Titel: übergangen', nurC({ plattform: 'netflix', art: 'start', sprache: 'deutsch' }) === 0)
pruefe('kein Objekt: übergangen', vergleiche('x', [], [null, 'a', 3]).nurClaude.length === 0)
pruefe('doppelter Claude-Vorschlag (Start und Folgen): einmal', vergleiche('x', [], [rohV('Foo', 'netflix'), rohV('Foo', 'netflix', { art: 'folgen' })]).nurClaude.length === 1)
pruefe('doppelte Regel-Behauptung (Block und Satz): einmal', vergleiche('x', [b('Foo', 'netflix'), b('Foo', 'netflix')], [rohV('Foo', 'netflix')]).gleich === 1)

/* Titelvergleich. */
pruefe('Titel gleich bis auf Schreibweise', titelGleich('Aoashi – Staffel 2', 'aoashi staffel 2'))
pruefe('Titel mit Zusatz gegen ohne', titelGleich('Aoashi', 'Aoashi – Staffel 2') && titelGleich('Aoashi – Staffel 2', 'Aoashi'))
pruefe('kurzer Anfang zählt nicht', !titelGleich('Re', 'Re:Zero'))
pruefe('verschiedene Titel', !titelGleich('Foo Bar', 'Foo Baz'))
pruefe('leerer Titel passt nie', !titelGleich('', '') && !titelGleich('»«', 'Foo'))

/* Lauf: Zählung, Ausfall eines Artikels, Zeit. */
const zeit = (...werte: number[]) => { let i = 0; return () => werte[Math.min(i++, werte.length - 1)]! }
const iron = fall('1066661')
const anlegion = fall('1067575')
const eingabe = (e: Echt) => ({ id: e.id, text: textVon(e), claude: e.claude })
const lauf = schattenLauf('2026-11-07', [eingabe(iron), { id: 'kaputt', text: null as unknown as string, claude: [] }, { id: 'leer', text: 'x', claude: undefined }, eingabe(anlegion)], zeit(100, 112))
pruefe('Lauf: Artikel mit Antwort 2, ohne Antwort 1, Schattenfehler 1', lauf.artikel === 2 && lauf.ohneAntwort === 1 && lauf.schattenFehler === 1, lauf)
pruefe('Lauf: gleich 2 (der kaputte Artikel in der Mitte hält die anderen nicht auf)', lauf.gleich === 2 && lauf.nurRegel === 0 && lauf.nurClaude === 0, lauf)
pruefe('Lauf: Dauer aus der eingespeisten Uhr', lauf.ms === 12, lauf.ms)
pruefe('Lauf: Uhr rückwärts gibt nie negative Dauer', schattenLauf('2026-11-07', [], zeit(50, 10)).ms === 0)
const mitAbweichung = schattenLauf('2026-11-07', [eingabe(fall('1064193'))], zeit(0, 1))
pruefe('Lauf: Abweichungen stehen einzeln mit Artikel und Seite', mitAbweichung.faelle.length === 2 && mitAbweichung.faelle.every((f) => f.seite === 'nurClaude' && f.artikelId === '1064193' && f.plattform === 'primevideo'), mitAbweichung.faelle)

/* Bestand: Aufbewahrung 30 Tage. */
const zeile = (am: string, p: Partial<Lauf> = {}): Lauf => ({ am, artikel: 1, ohneAntwort: 0, schattenFehler: 0, gleich: 0, nurRegel: 0, nurClaude: 0, ms: 1, faelle: [], ...p })
const alt: SchattenBestand = { laeufe: [zeile('2026-10-08'), zeile('2026-10-09'), zeile('2026-11-01')] }
const neu = ergaenzeSchatten(alt, zeile('2026-11-08'))
pruefe('Aufbewahren: 30 Tage bleiben, 31 gehen, neuer Lauf am Ende', neu.laeufe.map((l) => l.am).join() === '2026-10-09,2026-11-01,2026-11-08', neu.laeufe.map((l) => l.am))
pruefe('Aufbewahren: leerer Bestand', ergaenzeSchatten({ laeufe: [] }, zeile('2026-11-08')).laeufe.length === 1)
pruefe('Aufbewahren: Eingabe bleibt unverändert', alt.laeufe.length === 3)

/* Bilanz: Schwellen an der Grenze, eins darüber und darunter. */
const stand = (laeufe: Lauf[]): ReturnType<typeof bilanz> => bilanz({ laeufe })
const sieben = (p: Partial<Lauf>, anzahl = 1): Lauf[] => [zeile('2026-11-01', p), ...Array.from({ length: anzahl }, () => zeile('2026-11-08'))]
pruefe('leerer Bestand: offen', stand([]).urteil === 'offen' && stand([]).behauptungen === 0)
const genau = stand([zeile('2026-11-01', { gleich: 50 }), zeile('2026-11-08', { gleich: 50 })])
pruefe('genau 100 Behauptungen, genau 7 Tage, Rest 0: ja', genau.urteil === 'ja' && genau.tage === 7 && genau.behauptungen === 100, genau)
pruefe('99 Behauptungen: offen', stand([zeile('2026-11-01', { gleich: 50 }), zeile('2026-11-08', { gleich: 49 })]).urteil === 'offen')
pruefe('6 Tage: offen', stand([zeile('2026-11-02', { gleich: 50 }), zeile('2026-11-08', { gleich: 50 })]).urteil === 'offen')
pruefe('ein einziger Lauf mit 200 Behauptungen: offen (0 Tage)', stand([zeile('2026-11-08', { gleich: 200 })]).urteil === 'offen')
const einFehl = stand(sieben({ gleich: 200 }, 1).map((l, i) => (i ? { ...l, nurRegel: 1 } : l)))
pruefe('genau 1 Fehlbeleg: nein', einFehl.urteil === 'nein' && einFehl.fehlbelege === 1, einFehl)
pruefe('Fehlbeleg wird als Grund genannt', einFehl.gruende.some((g) => g.includes('1 Fehlbelege')), einFehl.gruende)
const rest15 = stand([zeile('2026-11-01', { gleich: 170 }), zeile('2026-11-08', { nurClaude: 30 })])
pruefe('Rest genau 15 %: ja', rest15.urteil === 'ja' && Math.abs(rest15.restquote - 0.15) < 1e-9, rest15)
const rest16 = stand([zeile('2026-11-01', { gleich: 50 }), zeile('2026-11-08', { gleich: 50, nurClaude: 20 })])
pruefe('Rest über 15 % (20 von 120): nein', rest16.urteil === 'nein' && rest16.restquote > 0.15, rest16)
pruefe('Rest ohne gleich und ohne nurClaude: Quote 0', stand([zeile('2026-11-08')]).restquote === 0)
const viel = stand([zeile('2026-11-01', { gleich: 60, schattenFehler: 2, ohneAntwort: 3, ms: 7 }), zeile('2026-11-08', { gleich: 60, ms: 90 })])
pruefe('Schattenfehler, Artikel ohne Antwort und längster Schritt werden summiert/gemeldet', viel.schattenFehler === 2 && viel.ohneAntwort === 3 && viel.maxMs === 90, viel)
const widFaelle: Lauf['faelle'] = [
  { artikelId: 'a', seite: 'nurRegel', titel: 'T', plattform: 'netflix', widerspruch: true },
  { artikelId: 'a', seite: 'nurRegel', titel: 'U', plattform: 'netflix' },
  { artikelId: 'a', seite: 'nurClaude', titel: 'V', plattform: 'netflix', widerspruch: true },
]
const wid = stand([zeile('2026-11-08', { nurRegel: 2, faelle: widFaelle })])
pruefe('Widersprüche zählen nur auf der Seite nurRegel', wid.widersprueche === 1, wid)

/* Antwortdatei lesen. */
const tmp = mkdtempSync(join(tmpdir(), 'a2y-schatten-'))
const schreibe = (pfad: string, inhalt: string): string => {
  mkdirSync(dirname(pfad), { recursive: true })
  writeFileSync(pfad, inhalt, 'utf8')
  return pfad
}
try {
  pruefe('Antwort fehlt: undefined', leseRohAntwort(join(tmp, 'gibt-es-nicht.json')) === undefined)
  pruefe('Antwort kaputt: undefined', leseRohAntwort(schreibe(join(tmp, 'k.json'), '{ kaputt')) === undefined)
  pruefe('Antwort ohne gelesen: undefined', leseRohAntwort(schreibe(join(tmp, 'n.json'), '{"gelesen":false,"vorschlaege":[]}')) === undefined)
  pruefe('Antwort ohne Liste: undefined', leseRohAntwort(schreibe(join(tmp, 'o.json'), '{"gelesen":true}')) === undefined)
  pruefe('Antwort gelesen und leer: leere Liste', leseRohAntwort(schreibe(join(tmp, 'l.json'), '{"gelesen":true,"vorschlaege":[]}'))?.length === 0)
  // Anders als die Übernahme kürzt der Schatten die Liste nicht (der Vergleich soll alles sehen).
  const lang = JSON.stringify({ gelesen: true, vorschlaege: Array.from({ length: 20 }, (_, i) => ({ titel: `T${i}` })) })
  pruefe('Antwort mit 20 Vorschlägen: alle 20', leseRohAntwort(schreibe(join(tmp, 'm.json'), lang))?.length === 20)

  /* Schritt mit echter Ordnerstruktur. */
  const ordner = join(tmp, 'a2y')
  const ids = [iron, anlegion]
  schreibe(join(ordner, 'auswahl.json'), JSON.stringify({ kandidaten: [...ids.map((e) => ({ id: e.id })), { id: '5' }], uebersprungen: [] }))
  for (const e of ids) {
    schreibe(join(ordner, 'artikel', `${e.id}.txt`), textVon(e))
    schreibe(join(ordner, 'ergebnis', `${e.id}.json`), JSON.stringify({ gelesen: true, vorschlaege: e.claude }))
  }
  schreibe(join(ordner, 'artikel', '5.txt'), 'x')
  schreibe(join(ordner, 'ergebnis', '5.json'), '{ kaputt')
  const speicher = { b: { laeufe: [] } as SchattenBestand }
  const ablage: Ablage = { lies: () => speicher.b, schreibe: (x) => { speicher.b = x } }
  const meldungen: string[] = []
  const gelaufen = schattenSchritt(ordner, ablage, '2026-11-07', zeit(0, 5), (t) => meldungen.push(t))
  pruefe('Schritt: Zeile geschrieben (2 Artikel, 1 ohne Antwort)', speicher.b.laeufe.length === 1 && gelaufen?.artikel === 2 && gelaufen.ohneAntwort === 1 && gelaufen.gleich === 2, gelaufen)
  pruefe('Schritt: Meldezeile nennt Zahlen und Zeit', meldungen.length === 1 && /^Schatten: 2 Artikel, gleich 2, nur Regel 0, nur Claude 0, ohne Antwort 1, Schattenfehler 0, 5 ms$/.test(meldungen[0]!), meldungen)
  schattenSchritt(ordner, ablage, '2026-11-07', zeit(0, 5), () => undefined)
  pruefe('Schritt: zweiter Lauf hängt an (zwei Zeilen)', speicher.b.laeufe.length === 2)

  const leer: string[] = []
  const ohneAuswahl = { b: { laeufe: [] } as SchattenBestand }
  const r1 = schattenSchritt(join(tmp, 'gibt-es-nicht'), { lies: () => ohneAuswahl.b, schreibe: (x) => { ohneAuswahl.b = x } }, '2026-11-07', zeit(0, 1), (t) => leer.push(t))
  pruefe('Ausfall beim Lesen: wirft nicht, Zeile mit Schattenfehler 1', ohneAuswahl.b.laeufe.length === 1 && ohneAuswahl.b.laeufe[0]!.schattenFehler === 1 && r1?.schattenFehler === 1, ohneAuswahl.b)
  pruefe('Ausfall beim Lesen: Meldung „Ausfall beim Lesen“', leer.some((t) => t.startsWith('Schatten: Ausfall beim Lesen')), leer)
  const speichern: string[] = []
  const r2 = schattenSchritt(ordner, { lies: () => ({ laeufe: [] }), schreibe: () => { throw new Error('Platte voll') } }, '2026-11-07', zeit(0, 1), (t) => speichern.push(t))
  pruefe('Ausfall beim Speichern: wirft nicht, gibt undefined zurück, meldet', r2 === undefined && speichern.length === 1 && speichern[0] === 'Schatten: Ausfall beim Speichern – Platte voll', speichern)
  const r3 = schattenSchritt(ordner, { lies: () => { throw new Error('Datei kaputt') }, schreibe: () => undefined }, '2026-11-07', zeit(0, 1), () => undefined)
  pruefe('Ausfall beim Lesen der Schattendatei: wirft nicht', r3 === undefined)

  /* Die Skripte als eigener Prozess: Exit-Code, Schlusszeile, geschriebene Datei. */
  const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
  const starte = (skript: string, ak: string, ...args: string[]) => {
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline', skript), ...args], { cwd: ak, env: { ...process.env, AK_ROOT: ak, LAUF_TOKEN: '' }, encoding: 'utf8', timeout: 120_000, windowsHide: true })
    return { status: r.status, aus: `${r.stdout}${r.stderr}` }
  }
  const akA = join(tmp, 'wurzel-a')
  mkdirSync(akA, { recursive: true })
  const ok = starte('anime2you-schatten.ts', akA, '--verzeichnis', ordner)
  const datei = join(akA, SCHATTEN_DATEI)
  const geschrieben = JSON.parse(readFileSync(datei, 'utf8')) as SchattenBestand
  pruefe('Prozess: Exit 0, Zeile im Log, Datei mit einem Lauf', ok.status === 0 && /Schatten: 2 Artikel, gleich 2, nur Regel 0, nur Claude 0, ohne Antwort 1, Schattenfehler 0, [\d.]+ ms/.test(ok.aus) && geschrieben.laeufe.length === 1 && !ok.aus.includes('Abbruch (') && /^\d{4}-\d{2}-\d{2}$/.test(geschrieben.laeufe[0]!.am), { ...ok, geschrieben })
  const akB = join(tmp, 'wurzel-b')
  mkdirSync(akB, { recursive: true })
  const aus = starte('anime2you-schatten.ts', akB, '--verzeichnis', join(tmp, 'gibt-es-nicht'))
  const ausDatei = JSON.parse(readFileSync(join(akB, SCHATTEN_DATEI), 'utf8')) as SchattenBestand
  pruefe('Prozess: Ordner fehlt → Exit 0, Ausfall im Log, Schattenfehler 1 in der Datei', aus.status === 0 && aus.aus.includes('Schatten: Ausfall beim Lesen') && aus.aus.includes('Abbruch (anime2you-schatten): Schatten: Ausfall beim Lesen') && ausDatei.laeufe[0]?.schattenFehler === 1, aus)
  const ohneArg = starte('anime2you-schatten.ts', akB)
  pruefe('Prozess: ohne Argument → Exit 0 und Aufrufhinweis', ohneArg.status === 0 && ohneArg.aus.includes('Aufruf: anime2you-schatten.ts --verzeichnis') && ohneArg.aus.includes('Abbruch (anime2you-schatten)'), ohneArg)
  const akC = join(tmp, 'wurzel-c-datei')
  writeFileSync(akC, 'keine Wurzel', 'utf8')
  const speicherFehler = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/anime2you-schatten.ts'), '--verzeichnis', ordner], { cwd: tmp, env: { ...process.env, AK_ROOT: akC, LAUF_TOKEN: '' }, encoding: 'utf8', timeout: 120_000, windowsHide: true })
  pruefe('Prozess: Speichern scheitert (Wurzel ist eine Datei) → Exit 0 und Meldung', speicherFehler.status === 0 && `${speicherFehler.stdout}${speicherFehler.stderr}`.includes('Abbruch (anime2you-schatten): Schatten: Ausfall beim Speichern') && `${speicherFehler.stdout}`.includes('Schatten: Ausfall beim Speichern'), `${speicherFehler.stdout}${speicherFehler.stderr}`)

  /* Auswertungsskript: Urteil und Exit-Code. */
  const werte = (name: string, b: SchattenBestand): { status: number | null; aus: string } => {
    const d = schreibe(join(tmp, name), JSON.stringify(b))
    return starte('anime2you-schatten-auswerten.ts', tmp, d)
  }
  const ja = werte('ja.json', { laeufe: [zeile('2026-11-01', { gleich: 50 }), zeile('2026-11-08', { gleich: 50 })] })
  pruefe('Auswertung ja: Exit 0 und „Urteil: ja“', ja.status === 0 && ja.aus.includes('Urteil: ja') && ja.aus.includes('100 Behauptungen'), ja)
  const offen = werte('offen.json', { laeufe: [zeile('2026-11-08', { gleich: 5 })] })
  pruefe('Auswertung offen: Exit 0, Gründe genannt', offen.status === 0 && offen.aus.includes('Urteil: offen – erst 5 von 100 Behauptungen; erst 0 von 7 Tagen'), offen)
  const nein = werte('nein.json', { laeufe: [zeile('2026-11-01', { gleich: 99 }), zeile('2026-11-08', { nurRegel: 1, faelle: [{ artikelId: '77', seite: 'nurRegel', titel: 'Foo', plattform: 'netflix', widerspruch: true }] })] })
  pruefe('Auswertung nein: Exit 1, Fehlbeleg einzeln mit Artikel', nein.status === 1 && nein.aus.includes('Fehlbeleg? 2026-11-08 Artikel 77: Foo / netflix (Claude widerspricht)') && nein.aus.includes('Urteil: nein – 1 Fehlbelege'), nein)
  const fehlt = starte('anime2you-schatten-auswerten.ts', tmp, join(tmp, 'gibt-es-nicht.json'))
  pruefe('Auswertung ohne Datei: offen mit Exit 0', fehlt.status === 0 && fehlt.aus.includes('Urteil: offen'), fehlt)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler) {
  console.error(`✖ ${fehler} Fehler`)
  process.exit(1)
}
console.log(`✓ Anime2You-Schatten: ${echt.length} echte Artikel (${Object.keys(ERWARTET).length} mit festem Soll), Vergleich, Bilanz an den Schwellen, Ausfälle, Prozesse gegen Wegwerf-Wurzeln`)
