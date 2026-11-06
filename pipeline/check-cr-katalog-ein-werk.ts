/**
 * Verdrahtung: Der Katalog-Abgleich in `09-4-3-katalog.ts` (Achte Runde und „Katalog überholt ein Nein“) vergibt kein Ja, wo der Prüflauf in derselben
 * Serie einen Block ohne deutsche Folge führt und kein vollständig deutscher Block zum Titel passt (26.10.2026, Persona 5: Stars and Ours; Katalog
 * vom 09.09. „1 Staffel, de-DE“, Bestandsbau rot an `check-cr-ja-deckung-bestand`). Läuft die echte Bau-Funktion gegen eine Kulisse (`AK_ROOT` im
 * Wegwerf-Ordner); Katalogzeile, Adressen und Blöcke von Persona 5 und Josee stammen aus `data/cr-katalog-de.json` und `data/crunchyroll-dub.json`.
 *
 * Aufruf: npx tsx pipeline/check-cr-katalog-ein-werk.ts
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PERSONA = 'https://www.crunchyroll.com/de/persona5-the-animation/persona5-the-animation-stars-and-ours-782566'
const JOSEE = 'https://www.crunchyroll.com/de/josee-the-tiger-and-the-fish'
const OHNE = 'https://www.crunchyroll.com/de/series/GFREMD0001/ohne-null-block'
const NEIN_NULL = 'https://www.crunchyroll.com/de/series/GFREMD0002/nein-mit-null-block'
const NEIN_OHNE = 'https://www.crunchyroll.com/de/series/GFREMD0003/nein-ohne-null-block'
const TEILBLOCK = 'https://www.crunchyroll.com/de/series/GFREMD0004/ein-deutscher-folgenteil'
const LEER = 'https://www.crunchyroll.com/de/series/GFREMD0006/leerer-block'
const ZWEI = 'https://www.crunchyroll.com/de/series/GFREMD0005/zwei-staffeln'
const WIDER_ALT = 'https://www.crunchyroll.com/de/series/GFREMD0007/alt'
const WIDER_NEU = 'https://www.crunchyroll.com/de/series/GFREMD0007/neu'
const ANDERE_ALT = 'https://www.crunchyroll.com/de/series/GFREMD0008/alt'
const ANDERE_NEU = 'https://www.crunchyroll.com/de/series/GFREMD0008/neu'
const EINIG_ALT = 'https://www.crunchyroll.com/de/series/GFREMD0009/alt'
const EINIG_NEU = 'https://www.crunchyroll.com/de/series/GFREMD0009/neu'

const katalogZeile = (id: string, folgen: number, staffeln = 1) => ({ id, typ: 'serie', audio: ['ja-JP', 'de-DE'], folgen, staffeln })
const serie = (url: string, seriesId: string, staffeln: { name: string; folgen: number; deutsch: number; staffelId?: string }[]) => ({
  url,
  seriesId,
  katalog: 'de',
  quelle: 'api',
  deutschImAngebot: true,
  geprueftAm: '2026-09-01',
  staffeln,
})

/** Der Kindprozess: AK_ROOT ist gesetzt, bevor die Bau-Module geladen werden. */
async function kind(): Promise<void> {
  const { ordneCrKatalogZu } = await import('./bau/09-4-3-katalog.ts')
  const crDub = {
    scrapedAt: '2026-10-26',
    serien: [
      serie(PERSONA, 'G6VDWKM76', [
        { name: 'PERSONA5 the Animation', folgen: 26, deutsch: 26 },
        { name: 'PERSONA5 the Animation -THE DAY BREAKERS-', folgen: 1, deutsch: 0 },
      ]),
      serie(JOSEE, 'G3KHEVQ95', [
        { name: 'Josee, The Tiger and the Fish', folgen: 1, deutsch: 0 },
        { name: 'Josee, The Tiger and the Fish (German Dub)', folgen: 1, deutsch: 1 },
      ]),
      serie(OHNE, 'GFREMD0001', [{ name: 'Staffel', folgen: 12, deutsch: 12 }]),
      serie(NEIN_NULL, 'GFREMD0002', [{ name: 'A', folgen: 12, deutsch: 12 }, { name: 'B', folgen: 3, deutsch: 0 }]),
      serie(NEIN_OHNE, 'GFREMD0003', [{ name: 'Staffel', folgen: 12, deutsch: 12 }]),
      serie(TEILBLOCK, 'GFREMD0004', [{ name: 'A', folgen: 5, deutsch: 1 }, { name: 'B', folgen: 3, deutsch: 0 }]),
      serie(LEER, 'GFREMD0006', [{ name: 'A', folgen: 0, deutsch: 0 }, { name: 'B', folgen: 3, deutsch: 0 }]),
      serie(ZWEI, 'GFREMD0005', [{ name: 'Staffel', folgen: 12, deutsch: 12 }]),
      // Persona 5 am 04.11.2026: derselbe Block (staffelId SS) im älteren Eintrag 1/0, im neueren 1/1 — widersprüchlich, keine Deckung
      serie(WIDER_ALT, 'GFREMD0007', [{ name: 'Haupt', staffelId: 'SM', folgen: 26, deutsch: 26 }, { name: 'Special', staffelId: 'SS', folgen: 1, deutsch: 0 }]),
      serie(WIDER_NEU, 'GFREMD0007', [{ name: 'Haupt', staffelId: 'SM', folgen: 26, deutsch: 26 }, { name: 'Special', staffelId: 'SS', folgen: 1, deutsch: 1 }]),
      // Null-Block einer anderen Staffel (SB) widerspricht dem vollen Block SA nicht
      serie(ANDERE_ALT, 'GFREMD0008', [{ name: 'A', staffelId: 'SA', folgen: 1, deutsch: 1 }]),
      serie(ANDERE_NEU, 'GFREMD0008', [{ name: 'A', staffelId: 'SA', folgen: 1, deutsch: 1 }, { name: 'B', staffelId: 'SB', folgen: 3, deutsch: 0 }]),
      // Beide Einträge führen den vollen Block SA gleich, daneben ein Null-Block SB
      serie(EINIG_ALT, 'GFREMD0009', [{ name: 'A', staffelId: 'SA', folgen: 1, deutsch: 1 }, { name: 'B', staffelId: 'SB', folgen: 3, deutsch: 0 }]),
      serie(EINIG_NEU, 'GFREMD0009', [{ name: 'A', staffelId: 'SA', folgen: 1, deutsch: 1 }, { name: 'B', staffelId: 'SB', folgen: 3, deutsch: 0 }]),
    ],
  }
  const titel = (id: number, episodes: number, url: string, dub?: boolean) => ({ id, episodes, streams: [{ platform: 'crunchyroll', url, ...(dub === undefined ? {} : { dub }) }] })
  const titles = new Map([
    [1, titel(1, 1, PERSONA)],
    [2, titel(2, 1, JOSEE)],
    [3, titel(3, 12, OHNE)],
    [4, titel(4, 3, NEIN_NULL, false)],
    [5, titel(5, 12, NEIN_OHNE, false)],
    [6, titel(6, 1, TEILBLOCK)],
    [8, titel(8, 5, TEILBLOCK)],
    [7, titel(7, 12, ZWEI)],
    [9, titel(9, 0, LEER)],
    [10, titel(10, 1, WIDER_NEU)],
    [11, titel(11, 1, ANDERE_NEU)],
    [12, titel(12, 1, EINIG_NEU)],
  ])
  ordneCrKatalogZu({ titles: titles as never, crDub: crDub as never, verweiseEntfernt: [] })
  console.log(JSON.stringify([...titles.values()].map((t) => [t.id, (t.streams[0] as { dub?: boolean }).dub ?? null])))
}

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

if (process.argv[2] === '--kind') {
  await kind()
} else {
  const wurzel = mkdtempSync(join(tmpdir(), 'cr-katalog-ein-werk-'))
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const katalog = {
    geholtAm: '2026-09-09T17:26:33.450Z',
    eintraege: [katalogZeile('G6VDWKM76', 28), katalogZeile('G3KHEVQ95', 1), katalogZeile('GFREMD0001', 12), katalogZeile('GFREMD0002', 15), katalogZeile('GFREMD0003', 12), katalogZeile('GFREMD0004', 8), katalogZeile('GFREMD0005', 12, 2), katalogZeile('GFREMD0006', 3), katalogZeile('GFREMD0007', 27), katalogZeile('GFREMD0008', 4), katalogZeile('GFREMD0009', 4)],
  }
  const adressen = { [PERSONA]: { seriesId: 'G6VDWKM76' }, [JOSEE]: { seriesId: 'G3KHEVQ95' } }
  writeFileSync(join(wurzel, 'data', 'cr-katalog-de.json'), JSON.stringify(katalog))
  writeFileSync(join(wurzel, 'data', 'crunchyroll-series-ids.json'), JSON.stringify({ adressen }))
  writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'ankuendigungen.yaml'), 'eintraege: []\n')
  const skript = fileURLToPath(import.meta.url)
  const r = spawnSync(process.execPath, ['--import', 'tsx', skript, '--kind'], { encoding: 'utf8', windowsHide: true, env: { ...process.env, AK_ROOT: wurzel } })
  const zeile = r.stdout.split('\n').filter((z) => z.startsWith('[')).pop()
  const erg = zeile ? (JSON.parse(zeile) as [number, boolean | null][]) : undefined
  pruefe('Kindprozess lief', r.status === 0 && Boolean(erg), { status: r.status, err: r.stderr.slice(-400) })
  const dub = (id: number) => erg?.find(([i]) => i === id)?.[1]
  pruefe('Persona 5 Stars and Ours: Block ohne deutsche Folge in der Serie, kein passender Block: kein Ja', dub(1) === null, erg)
  pruefe('Josee: der vollständig deutsche Block „(German Dub)“ mit 1 Folge trägt das Ja', dub(2) === true, erg)
  pruefe('Serie ohne Null-Block: Ja vom Katalog', dub(3) === true, erg)
  pruefe('überholtes Nein in einer Serie mit Null-Block: bleibt Nein', dub(4) === false, erg)
  pruefe('überholtes Nein in einer Serie ohne Null-Block: wird Ja', dub(5) === true, erg)
  pruefe('ein Block mit nur teilweise deutschen Folgen ist kein passender Block', dub(6) === null, erg)
  pruefe('gleiche Folgenzahl, aber nur 1 von 5 Folgen deutsch: kein passender Block', dub(8) === null, erg)
  pruefe('Titel ohne Folgenzahl: ein leerer Block (0 von 0) passt nicht', dub(9) === null, erg)
  pruefe('Katalog mit zwei Staffeln: kein Ja', dub(7) === null, erg)
  pruefe('derselbe Block in einem Eintrag 1/0, im anderen 1/1 (Persona 5): kein Ja', dub(10) === null, erg)
  pruefe('Null-Block einer anderen staffelId widerspricht dem vollen Block nicht: Ja', dub(11) === true, erg)
  pruefe('voller Block in allen Einträgen gleich, daneben ein Null-Block: Ja', dub(12) === true, erg)
  console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
  process.exit(fehler ? 1 : 0)
}
