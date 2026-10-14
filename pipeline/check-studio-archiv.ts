/**
 * Zusicherungen zum Studio aus dem aniSearch-Archiv (14.10.2026): Titel ohne Studio bekommen das der archivierten Seite, ein Name mit Komma bleibt ganz,
 * vorhandene Studios bleiben unberührt, die Schreibweise folgt dem AniList-Bestand. Arbeitet auf Beispielseiten im Temp-Ordner (kein Abruf). Läuft in `check:logic`.
 */
import { gzipSync } from 'node:zlib'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'
import { ANISEARCH_ID_BASIS } from './bau/anisearch-titel.ts'
import { anilistSchreibweisen, archivStudios, ergaenzeStudiosAusArchiv, studiosInBestandsschreibweise } from './bau/studio-aus-archiv.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const seite = (studio: string): string =>
  `<section id="information"><div class="company"><span class="header">Studio:</span> ${studio}</div><div class="adapted"><span class="header">Adaptiert von:</span> Manga</div></section>`
const link = (name: string): string => `<a href="company/1,x">${name}</a>`
const titel = (id: number, studios?: string[]): Title => ({ id, studios }) as Title

const dir = mkdtempSync(join(tmpdir(), 'archiv-studio-'))
try {
  const seiten: Record<number, string> = {
    1: seite(`${link('TMS Entertainment Co., Ltd.')}, ${link('ネスト')}`),
    2: seite(link('studio VOLN Co., Ltd.')),
    3: '<section id="information"><div class="adapted"><span class="header">Adaptiert von:</span> Manga</div></section>',
    4: seite(`${link('A')}, ${link('B')}, ${link('C')}, ${link('D')}`),
  }
  for (const [id, html] of Object.entries(seiten)) writeFileSync(join(dir, `${id}.html.gz`), gzipSync(html))

  const namen = archivStudios(1, dir)
  pruefe('Parser: mehrere Studios in Seitenreihenfolge, Komma im Namen bleibt', namen.length === 2 && namen[0] === 'TMS Entertainment Co., Ltd.' && namen[1] === 'ネスト', JSON.stringify(namen))
  pruefe('Parser: Seite ohne Studio-Feld und fehlende Seite liefern nichts', archivStudios(3, dir).length === 0 && archivStudios(99, dir).length === 0)

  const bestand = [titel(1, ['TMS Entertainment', 'Studio Pierrot']), titel(2, ['TMS Entertainment', 'Xebec']), titel(4, ['Group TAC']), titel(ANISEARCH_ID_BASIS + 9, ['TMS Entertainment Co., Ltd.'])]
  const schreibweisen = anilistSchreibweisen(bestand)
  pruefe('Schreibweise: AniList-Form gewinnt, Katalogtitel zählen nicht', schreibweisen.get('tmsentertainment') === 'TMS Entertainment' && schreibweisen.get('pierrot') === 'Studio Pierrot', JSON.stringify([...schreibweisen]))
  const gemischt = studiosInBestandsschreibweise(['TMS Entertainment Co., Ltd.', 'ネスト', 'TMS Entertainment Inc.'], schreibweisen)
  pruefe('Schreibweise: Rechtsform fällt weg, Unbekanntes bleibt, Doppelte fallen weg', JSON.stringify(gemischt) === JSON.stringify(['TMS Entertainment', 'ネスト']), JSON.stringify(gemischt))
  const gleicheSchluessel = studiosInBestandsschreibweise(['XEBEC, Inc.', 'Group Tac Co., Ltd.'], schreibweisen)
  pruefe('Schreibweise: bekannter Schlüssel gibt die Form des Bestands, auch wo Abschneiden eine andere ergäbe', JSON.stringify(gleicheSchluessel) === JSON.stringify(['Xebec', 'Group TAC']), JSON.stringify(gleicheSchluessel))
  const ohneForm = (n: string): string => studiosInBestandsschreibweise([n], new Map())[0]!
  const erwartet: [string, string][] = [
    ['Zuiyo Co., Ltd.', 'Zuiyo'],
    ['Trinet Entertainment, Inc.', 'Trinet Entertainment'],
    ['Red Dog Culture House Co., Ltd', 'Red Dog Culture House'],
    ['SynergySP Co. ,Ltd.', 'SynergySP'],
    ['KSS Inc.', 'KSS'],
    ['saetta inc.', 'saetta'],
    ['PLUS heads inc.', 'PLUS heads'],
    ['ICHI Corporation', 'ICHI Corporation'],
  ]
  const falsch = erwartet.filter(([roh, soll]) => ohneForm(roh) !== soll).map(([roh]) => roh)
  pruefe('Schreibweise: unbekanntes Studio verliert die Rechtsform; Corporation bleibt', falsch.length === 0, falsch.join(' | '))
  pruefe('Schreibweise: höchstens drei Studios', studiosInBestandsschreibweise(['A', 'B', 'C', 'D'], new Map()).length === 3)

  const ids = [1, 2, 3, 4, 5].map((n) => ANISEARCH_ID_BASIS + n)
  const titles = new Map(ids.map((id) => [id, titel(id, id === ids[1] ? ['Eigenes Studio'] : [])]))
  const n = ergaenzeStudiosAusArchiv(titles, dir)
  pruefe('Ergänzen: Titel mit Seite und Studio bekommen es', JSON.stringify(titles.get(ids[0]!)!.studios) === JSON.stringify(['TMS Entertainment', 'ネスト']), JSON.stringify(titles.get(ids[0]!)))
  pruefe('Ergänzen: ein vorhandenes Studio wird nie ersetzt', JSON.stringify(titles.get(ids[1]!)!.studios) === JSON.stringify(['Eigenes Studio']))
  pruefe('Ergänzen: Seite ohne Studio und fehlende Seite lassen es leer', !titles.get(ids[2]!)!.studios?.length && !titles.get(ids[4]!)!.studios?.length)
  pruefe('Ergänzen: Zähler nennt die ergänzten Titel (Seite 1 und 4)', n === 2, `${n}`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log(fehler ? `\nStudio-Archiv: ${fehler} Zusicherung(en) verletzt.` : 'Studio-Archiv: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
