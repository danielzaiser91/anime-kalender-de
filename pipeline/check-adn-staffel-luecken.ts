/**
 * ADN-Serien, die je Staffel neu zählen, ohne Eintrag in der Staffelzuordnung: Rechenregel (`adnStaffelLuecken`) und der Bestandswächter als eigener
 * Prozess gegen einen Wegwerf-Ordner (`AK_ROOT`): Zeile, Exit 0, Fälle mit und ohne Eintrag, über Stream und über Handbeleg. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { adnStaffelLuecken, rohZaehltJeStaffel, type AdnRohSerie } from './lib/adn-staffel-luecken.ts'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/** Folgen 1 bis n je Staffel, wie ADN sie liefert (Zahlen als Zeichenketten). */
const serie = (showId: number, staffeln: { season: number; von: number; bis: number }[], art = 'EPS'): AdnRohSerie => ({
  showId,
  videos: staffeln.flatMap((s) => Array.from({ length: s.bis - s.von + 1 }, (_, i) => ({ type: art, season: String(s.season), shortNumber: String(s.von + i) }))),
})
/* Wie Reincarnated as a Sword (12 und 6, je ab 1) und Dorohedoro (12, dann ab 13 durchgezählt). */
const jeStaffel = serie(900970, [{ season: 1, von: 1, bis: 12 }, { season: 2, von: 1, bis: 6 }])
const durchgezaehlt = serie(900971, [{ season: 1, von: 1, bis: 12 }, { season: 2, von: 13, bis: 24 }])
const nurEine = serie(900972, [{ season: 1, von: 1, bis: 12 }])
const nurFilme = serie(900973, [{ season: 1, von: 1, bis: 1 }, { season: 2, von: 1, bis: 1 }], 'MOV')
const nurStaffel2 = serie(900974, [{ season: 2, von: 1, bis: 12 }])

const adnStream = (showId: number) => ({ platform: 'adn', url: `https://animationdigitalnetwork.com/de/video/${showId}-x` })
const titel = [
  { id: 900001, titleRomaji: 'Erster', streams: [adnStream(900970)] },
  { id: 900002, titleRomaji: 'Zweiter', streams: [adnStream(900970)] },
  { id: 900003, titleRomaji: 'Durchgezählt', streams: [adnStream(900971)] },
  { id: 900004, titleRomaji: 'Eine Staffel', streams: [adnStream(900972)] },
  { id: 900005, titleRomaji: 'Film', streams: [adnStream(900973)] },
  { id: 900006, titleRomaji: 'Nur Beleg', streams: [] },
  { id: 900007, titleRomaji: 'Anderer Anbieter', streams: [{ platform: 'netflix', url: 'https://animationdigitalnetwork.com/de/video/900970-x' }] },
  { id: 900008, titleRomaji: 'Staffel 2 allein', streams: [adnStream(900974)] },
]
const alle = [jeStaffel, durchgezaehlt, nurEine, nurFilme, nurStaffel2, serie(900975, [{ season: 1, von: 1, bis: 2 }, { season: 2, von: 1, bis: 2 }])]

console.log('\nRohantwort zählt je Staffel?')
pruefe('Staffel 2 beginnt bei Folge 1: ja', rohZaehltJeStaffel(jeStaffel))
pruefe('Staffel 2 beginnt bei Folge 13 (durchgezählt): nein', !rohZaehltJeStaffel(durchgezaehlt))
pruefe('nur eine Staffel: nein', !rohZaehltJeStaffel(nurEine))
pruefe('nur Filme (keine EPS) zählen nicht', !rohZaehltJeStaffel(nurFilme))
pruefe('nur Staffel 2 ab Folge 1 (ADN führt Staffel 1 nicht): ja', rohZaehltJeStaffel(nurStaffel2))

console.log('\nLücken:')
const ohne = adnStaffelLuecken(alle, titel, {})
pruefe('ohne Eintrag: je Staffel gezählte Serien mit Titel, sortiert, ohne Serie ohne Titel (900975)', ohne.map((l) => l.showId).join() === '900970,900974', ohne)
pruefe('Name ist der des kleinsten Titels, Titel aufsteigend', ohne[0]?.name === 'Erster' && ohne[0]?.titel.join() === '900001,900002', ohne[0])
pruefe('ein Stream bei einem anderen Anbieter hängt den Titel nicht an die Serie', !ohne[0]?.titel.includes(900007), ohne[0])
pruefe('ein Eintrag für einen der zwei Titel genügt', adnStaffelLuecken(alle, titel, { 900002: '1' }).map((l) => l.showId).join() === '900974')
pruefe('ein Eintrag für den anderen Titel genügt ebenso', adnStaffelLuecken(alle, titel, { 900001: '2' }).map((l) => l.showId).join() === '900974')
pruefe('Eintrag eines Titels an einer anderen Serie entlastet nicht', adnStaffelLuecken(alle, titel, { 900003: '1' }).map((l) => l.showId).join() === '900970,900974')
const beleg = [{ anilistId: 900006, platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/900972-y' }]
pruefe('Handbeleg ohne Stream hängt den Titel an die Serie; eine Staffel zählt trotzdem nicht', adnStaffelLuecken(alle, titel, {}, beleg).map((l) => l.showId).join() === '900970,900974')
const beleg2 = [{ anilistId: 900006, platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/900974-y' }]
const mitBeleg = adnStaffelLuecken(alle, titel, { 900008: '2' }, beleg2)
pruefe('Handbeleg an einer Serie, deren Stream-Titel schon einen Eintrag hat: Serie bleibt gedeckt', mitBeleg.map((l) => l.showId).join() === '900970', mitBeleg)
const nurBeleg = adnStaffelLuecken([jeStaffel], [titel[5]], {}, [{ anilistId: 900006, platform: 'adn', url: 'https://animationdigitalnetwork.com/de/video/900970-y' }])
pruefe('Titel nur über Handbeleg (kein Stream) taucht auf', nurBeleg.length === 1 && nurBeleg[0].titel.join() === '900006', nurBeleg)
pruefe('Handbeleg eines anderen Anbieters zählt nicht', adnStaffelLuecken([jeStaffel], [titel[5]], {}, [{ anilistId: 900006, platform: 'netflix', url: 'https://animationdigitalnetwork.com/de/video/900970-y' }]).length === 0)
pruefe('Handbeleg ohne Adresse oder unbekannter Titel bricht nichts', adnStaffelLuecken([jeStaffel], titel, {}, [{ anilistId: 1, platform: 'adn' }, { anilistId: 900006, platform: 'adn' }]).length === 1)

console.log('\nBestandswächter als Prozess:')
const wurzel = mkdtempSync(join(tmpdir(), 'adn-staffel-luecken-'))
try {
  const rohOrdner = join(wurzel, 'data', 'adn-raw')
  mkdirSync(rohOrdner, { recursive: true })
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  for (const s of alle) writeFileSync(join(rohOrdner, `${s.showId}.json.gz`), gzipSync(JSON.stringify(s)))
  writeFileSync(join(rohOrdner, 'kein-archiv.txt'), 'x')
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titel))
  const lauf = (): { status: number | null; aus: string } => {
    const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('./check-adn-staffel-luecken-bestand.ts', import.meta.url))], {
      cwd: wurzel,
      env: { ...process.env, AK_ROOT: wurzel },
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    })
    return { status: r.status, aus: r.stdout + r.stderr }
  }
  const erst = lauf()
  pruefe('ohne Eintrag: Exit 0, Schlusszeile, Zählzeile (6 Serien), Warnung nennt beide Serien samt Namen', erst.status === 0 && /VERSTÖSSE: 0/.test(erst.aus) && /im Archiv: 6, .* ohne Eintrag in der Staffelzuordnung: 2/.test(erst.aus) && /WARNUNG ADN-Staffelzuordnung: 2 Serien.*900970 Erster; 900974 Staffel 2 allein/.test(erst.aus), erst)
  writeFileSync(join(wurzel, 'data', 'adn-staffelzuordnung.yaml'), '900002: 1\n900008: 2\n')
  const gedeckt = lauf()
  pruefe('mit Einträgen für beide: Exit 0, Zählzeile 0, keine Warnung', gedeckt.status === 0 && /ohne Eintrag in der Staffelzuordnung: 0/.test(gedeckt.aus) && !/WARNUNG/.test(gedeckt.aus), gedeckt)
  writeFileSync(join(wurzel, 'data', 'dub-confirmed.yaml'), '- anilistId: 900006\n  platform: adn\n  url: https://animationdigitalnetwork.com/de/video/900974-y\n  dub: false\n  checkedAt: \'2026-11-11\'\n')
  writeFileSync(join(wurzel, 'data', 'adn-staffelzuordnung.yaml'), '900002: 1\n')
  const ueberBeleg = lauf()
  pruefe('Handbeleg liest der Prozess: Titel 900006 hängt an Serie 900974 (dort 900008 ohne Eintrag, 900006 ebenso)', ueberBeleg.status === 0 && /Staffelzuordnung: 1\n.*verteilt: 900974 Nur Beleg\n/.test(ueberBeleg.aus), ueberBeleg)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nADN-Staffelzuordnung-Lücken: ${faelle} Zusicherungen grün (Rohantwort, Lücken über Stream und Handbeleg, Wächter-Prozess).`)
