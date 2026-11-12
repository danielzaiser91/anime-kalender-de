/**
 * Schritt „Meldungen einarbeiten“ (12.11.2026, Anlass: Handbeleg 143277 an der Prime-Seite von 155645 machte
 * `check-zuordnung-fremd-bestand` und den Bestandsbau rot): der echte Abholer `fetch-pruefungen.ts` als Prozess gegen eine
 * Wegwerf-Wurzel (`AK_ROOT`) und die Abruf-Attrappe. Eine Meldung an einer Adresse, die `prime-zugeordnet.json` einem
 * anderen Titel gibt, schreibt keinen Beleg, steht mit Meldungs-ID, Titel und Besitzer in Log und Arbeitsliste und wird
 * gezählt; die Meldung bleibt im Briefkasten. Eine Meldung an einer freien Adresse wird weiter geschrieben.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/meldung-unbekannt-mock.mjs')).href
const fehler: string[] = []
const LISTE = 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md'

const seite = (kennung: string) => `https://www.amazon.de/dp/${kennung}`
const titel = (id: number, titleDe: string, streams: unknown[] = []) => ({ id, titleDe, format: 'TV', episodes: 12, streams })
/** Die Titel 900101 und 900102 führen beide die Sammelseite B0FREMD005 (wie die JoJo-Staffeln an einer ADN-Seite). */
const GETEILT = [{ platform: 'primevideo', url: seite('B0FREMD005') }]
const BESTAND = [titel(900101, 'Fremdprobe Alpha', GETEILT), titel(900102, 'Fremdprobe Beta', GETEILT)]
/** Die Seite B0FREMD001 gehört laut Zuordnung dem Titel 900102, B0FREMD002 niemandem, B0FREMD003 dem Titel 900101 selbst. */
const ZUGEORDNET = {
  [seite('B0FREMD001')]: { titleId: 900102, plattform: 'primevideo' },
  [seite('B0FREMD003')]: { titleId: 900101, plattform: 'primevideo' },
  [seite('B0FREMD004')]: { titleId: 900102, plattform: 'primevideo' },
  [seite('B0FREMD005')]: { titleId: 900102, plattform: 'primevideo' },
}
/** Seite B0FREMD004 führt schon ein Handbeleg des Titels 900103: der Treffer (900102, B0FREMD004) steht vor der Meldung da und ist nicht ihre Schuld. */
const SAAT = `- anilistId: 900103\n  platform: primevideo\n  url: ${seite('B0FREMD004')}\n  dub: true\n  available: true\n  checkedAt: '2026-10-01'\n`

function zeile(nr: number, kennung: string, name: string) {
  return {
    id: 950000 + nr,
    plattform: 'primevideo',
    url: seite(kennung),
    sprachen: '["Deutsch"]',
    befund: 'dub',
    titel: name,
    folgen: 12,
    folge_nr: 1,
    staffel: 1,
    staffeln: null,
    serientitel: null,
    notiz: `Amazon-Seite ${kennung}: alle 12 Folgen geprüft, Abos: keine Angabe, zugang=abo`,
    teil_von: null,
    teil_bis: null,
    gemeldet_am: '2026-11-07T10:00:00.000Z',
    seiten_kennung: kennung,
    titel_id: null,
    folge: null,
  }
}

function lauf(zeilen: unknown[]) {
  const tmp = mkdtempSync(join(tmpdir(), 'fetch-pruefungen-fremde-adresse-'))
  try {
    for (const ordner of ['data/curated', 'public/data', 'extension', 'daniel-zum-abarbeiten/listen']) mkdirSync(join(tmp, ordner), { recursive: true })
    writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify(BESTAND))
    writeFileSync(join(tmp, 'public/data/franchises.json'), '{}')
    writeFileSync(join(tmp, 'public/data/cartoons.json'), '[]')
    writeFileSync(join(tmp, 'public/data/ohne-synchro.json'), '[]')
    writeFileSync(join(tmp, 'public/data/ohne-synchro-namen.json'), '[]')
    writeFileSync(join(tmp, 'data/prime-zugeordnet.json'), JSON.stringify(ZUGEORDNET))
    writeFileSync(join(tmp, 'data/dub-confirmed.yaml'), SAAT)
    writeFileSync(join(tmp, 'meldungen.json'), JSON.stringify(zeilen))
    const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-pruefungen.ts')], {
      cwd: wurzel,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, LAUF_TOKEN: 'test', AK_ROOT: tmp, AK_MELDUNGEN: join(tmp, 'meldungen.json') },
    })
    const ausgabe = `${r.stdout}\n${r.stderr}`
    if (r.status !== 0 || !ausgabe.includes('Prüfungen abgeholt')) fehler.push(`Lauf endete mit ${r.status}, ohne Schlusszeile: ${ausgabe.slice(-400)}`)
    const lesen = (datei: string) => (existsSync(join(tmp, datei)) ? readFileSync(join(tmp, datei), 'utf8') : '')
    return { ausgabe, liste: lesen(LISTE), belege: lesen('data/dub-confirmed.yaml') }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/* Anlassfall: Meldung 950001 (Titel 900101 über den Namen) an der Seite von 900102. Daneben eine freie und eine eigene Adresse. */
const a = lauf([
  zeile(1, 'B0FREMD001', 'Fremdprobe Alpha'),
  zeile(2, 'B0FREMD002', 'Fremdprobe Alpha'),
  zeile(3, 'B0FREMD003', 'Fremdprobe Alpha'),
  zeile(5, 'B0FREMD004', 'Fremdprobe Alpha'),
  zeile(6, 'B0FREMD005', 'Fremdprobe Alpha'),
])
const schreibt = (belege: string, kennung: string) => belege.split('- anilistId:').some((b) => b.includes('900101') && b.includes(kennung))
const zeilen = a.ausgabe.split('\n')
console.log(`Beispiel Anlassfall: ${zeilen.filter((z) => z.includes('B0FREMD001')).join(' | ')}`)
if (schreibt(a.belege, 'B0FREMD001')) fehler.push('Beleg an der Adresse eines anderen Titels wurde geschrieben')
if (!schreibt(a.belege, 'B0FREMD002')) fehler.push('Beleg an freier Adresse fehlt')
if (!schreibt(a.belege, 'B0FREMD003')) fehler.push('Beleg an der eigenen Adresse (Besitzer ist der Titel selbst) fehlt')
if (!schreibt(a.belege, 'B0FREMD005')) fehler.push('Beleg an einer Seite, die der Besitzer mit dem Titel der Meldung teilt, fehlt')
if (!schreibt(a.belege, 'B0FREMD004')) fehler.push('Beleg an einer Adresse mit schon bestehendem Treffer (kein neuer Treffer) fehlt')
const warnung = zeilen.find((z) => z.includes('B0FREMD001') && z.includes('nicht geschrieben')) ?? ''
for (const teil of ['Titel 900101', 'Meldung 950001', 'Titel 900102', 'Meldung bleibt liegen']) {
  if (!warnung.includes(teil)) fehler.push(`Warnzeile ohne „${teil}“: ${warnung || '(keine)'}`)
}
if (!a.ausgabe.includes('4 Einträge geschrieben') || !a.ausgabe.includes(', 1 Beleg(e) an der Adresse eines anderen Titels nicht geschrieben')) {
  fehler.push(`Schlusszeile zählt nicht (4 geschrieben, 1 verschoben): ${zeilen.filter((z) => z.includes('Prüfungen abgeholt')).join(' | ')}`)
}
const eintrag = a.liste.split('\n').find((z) => z.includes('B0FREMD001')) ?? ''
if (!eintrag.includes('Titel 900102') || a.liste.includes('B0FREMD002') || a.liste.includes('B0FREMD003')) fehler.push(`Arbeitsliste: Zeile fehlt oder zu viele: ${eintrag}`)

/* Ohne fremden Besitzer läuft alles wie bisher: nichts verschoben, keine Zählung. */
const b = lauf([zeile(4, 'B0FREMD002', 'Fremdprobe Alpha')])
if (!schreibt(b.belege, 'B0FREMD002') || b.ausgabe.includes('nicht geschrieben') || b.liste.includes('B0FREMD')) fehler.push(`freie Adresse allein: ${b.ausgabe.slice(-300)}`)

if (zeilen.filter((z) => z.includes('B0FREMD001') && z.includes('bleibt liegen')).length !== 1) fehler.push('die Meldung steht nicht genau einmal in den Warnungen')
if (a.liste.split('\n').filter((z) => z.includes('B0FREMD001')).length !== 1) fehler.push('die Meldung steht nicht genau einmal in der Arbeitsliste')

/* Die Prüfung im Bestand nennt die Herkunft des Belegs (Prüfdatum, Notiz), damit das nächste Rot ohne Meldungskopie lesbar ist. */
function pruefungImBestand() {
  const tmp = mkdtempSync(join(tmpdir(), 'fremde-adresse-bestand-'))
  try {
    for (const ordner of ['data', 'public/data']) mkdirSync(join(tmp, ordner), { recursive: true })
    for (const datei of ['cartoons', 'ohne-synchro']) writeFileSync(join(tmp, `public/data/${datei}.json`), '[]')
    writeFileSync(join(tmp, 'public/data/titles.json'), JSON.stringify(BESTAND.map((t) => ({ ...t, franchiseId: t.id }))))
    writeFileSync(join(tmp, 'data/prime-zugeordnet.json'), JSON.stringify(ZUGEORDNET))
    writeFileSync(join(tmp, 'data', 'zuordnung-fremd-bekannt.json'), '[]')
    /* Davor ein Beleg einer anderen Kennung an derselben Seite und einer derselben Kennung an anderer Seite: die Herkunft muss den richtigen nehmen. */
    const beleg = (id: number, kennung: string, datum: string, notiz: string) =>
      `- anilistId: ${id}\n  platform: primevideo\n  url: ${seite(kennung)}\n  checkedAt: '${datum}'\n  note: "${notiz}"\n`
    const lang = 'Staffel 2 der Meldung, Prime-Seite, alle Folgen geprueft und gezaehlt XYZ'
    writeFileSync(
      join(tmp, 'data/dub-confirmed.yaml'),
      beleg(900199, 'B0FREMD001', '2026-01-01', 'anderer Beleg') + beleg(900101, 'B0FREMD009', '2026-02-02', 'andere Seite') + beleg(900101, 'B0FREMD001', '2026-10-16', lang),
    )
    const r = spawnSync(process.execPath, [tsx, join(wurzel, 'pipeline/check-zuordnung-fremd-bestand.ts')], {
      cwd: tmp,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, AK_ROOT: tmp },
    })
    return { status: r.status, ausgabe: `${r.stdout}\n${r.stderr}` }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}
const bestand = pruefungImBestand()
const erwartet = [
  'Handbeleg:900101 (data/dub-confirmed.yaml, checkedAt 2026-10-16, Notiz „Staffel 2 der Meldung, Prime-Seite, alle Folgen geprueft und“)',
  'Handbeleg:900199 (data/dub-confirmed.yaml, checkedAt 2026-01-01, Notiz „anderer Beleg“)',
]
if (bestand.status !== 1 || erwartet.some((e) => !bestand.ausgabe.includes(e))) {
  fehler.push(`Prüfung im Bestand: Herkunft fehlt (Exit ${bestand.status}): ${bestand.ausgabe.slice(-500)}`)
}

if (fehler.length) {
  console.error(`check-fetch-pruefungen-fremde-adresse: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-fetch-pruefungen-fremde-adresse: 1 Beleg an fremder Adresse verschoben und gezählt, freie und eigene Adresse geschrieben.')
