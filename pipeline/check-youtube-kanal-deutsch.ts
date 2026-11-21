/**
 * Zusicherung: **Ein YouTube-Weg von einem Kanal der Liste `data/curated/youtube-kanaele-deutsch.yaml` gilt als Synchro-belegt** (Daniel, E89, 16.11.2026).
 * Lauf der Bauphase 09-2 (`werteLinkpruefungAus`) gegen eine Kulisse (`AK_ROOT`): gelisteter Kanal ohne Tonspur-Befund → `dub: true`;
 * fremder Kanal, fehlender Kanalbefund, Tonspur „nicht Deutsch" und Handbeleg „nein" bleiben, wie sie waren. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yaml from 'js-yaml'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'youtube-kanal-deutsch-'))
process.env.AK_ROOT = kulisse
const fehler: string[] = []
let pruefungen = 0
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  pruefungen++
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`
const DE = 'Testkanal Deutsch'

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/kino-ankuendigungen.yaml'), '[]\n')
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '# leer\n')
  writeFileSync(
    join(kulisse, 'data', 'curated', 'youtube-kanaele-deutsch.yaml'),
    `kanaele:\n  - name: ${DE}\n    handle: "@x"\n    begruendung: Test\n  - handle: "@ohnename"\n`,
  )
  const befund = (kanal: string, extra: object = {}) => ({ status: 200, lebt: true, kanal, geprueftAm: '2026-11-16', ...extra })
  writeFileSync(
    join(kulisse, 'data/youtube-befunde.json'),
    JSON.stringify({
      [yt('deutsch0001')]: befund(DE),
      [yt('fremd000001')]: befund('Fremdkanal English'),
      [yt('tonnein0001')]: befund(DE, { audio: 'Japanisch', audioDeutsch: false }),
      [yt('tonja000001')]: befund('Fremdkanal English', { audio: 'Deutsch', audioDeutsch: true }),
      [yt('handnein001')]: befund(DE),
      [yt('handja00001')]: befund('Fremdkanal English'),
    }),
  )
  const { werteLinkpruefungAus } = await import('./bau/09-2-linkpruefung.ts')
  const { dubAusDeutschemKanal, ladeDeutscheKanaele } = await import('./lib/youtube-kanal-deutsch.ts')
  const faelle: [number, string][] = [
    [1, 'deutsch0001'],
    [2, 'fremd000001'],
    [3, 'tonnein0001'],
    [4, 'tonja000001'],
    [5, 'handnein001'],
    [6, 'ohnebefund1'],
    [7, 'handja00001'],
  ]
  const titles = new Map<number, Title>(
    faelle.map(([id, v]) => [id, { id, streams: [{ platform: 'youtube', url: yt(v) }] } as unknown as Title]),
  )
  const belege: Record<number, object> = {
    5: { url: yt('handnein001'), checkedAt: '2026-11-16', dub: false },
    7: { url: yt('handja00001'), checkedAt: '2026-11-16', dub: true },
  }
  const { ytUrteileAusTonOderKanal } = werteLinkpruefungAus({
    ytKanal: {},
    ytKauf: new Set(),
    titles,
    netflixOhneKennung: 0,
    checksJePlattform: new Map(),
    youtubeBefunde: {},
    belegFuer: (id) => belege[id] as never,
    vonHandBelegtAm: new Map(),
    checks: new Map(),
    vorherTitles: [],
  })
  const dub = (id: number) => titles.get(id)?.streams[0]?.dub
  erwarte('gelisteter Kanal, kein Tonspur-Befund: dub true', dub(1), true)
  erwarte('Kanal nicht in der Liste: kein Urteil', dub(2), undefined)
  erwarte('gelisteter Kanal, Tonspur sagt nicht Deutsch: die Messung gewinnt', dub(3), false)
  erwarte('fremder Kanal mit Tonspur Deutsch: weiter true', dub(4), true)
  erwarte('gelisteter Kanal, Handbeleg „nein": Handbeleg gewinnt', dub(5), false)
  erwarte('Weg ohne Kanalbefund: kein Urteil', dub(6), undefined)
  erwarte('fremder Kanal, Handbeleg „ja": true', dub(7), true)
  erwarte('Zählung: Fälle 1, 3 und 4 kamen aus Kanal bzw. Tonspur', ytUrteileAusTonOderKanal, 3)
  const liste = ladeDeutscheKanaele()
  erwarte('Liste: nur Einträge mit Namen', [...liste], [DE])
  erwarte('Kanal gelistet', dubAusDeutschemKanal(DE, liste), true)
  erwarte('Kanal unbekannt', dubAusDeutschemKanal('Anderer', liste), undefined)
  erwarte('ohne Kanal', dubAusDeutschemKanal(undefined, liste), undefined)
  erwarte('leere Liste', dubAusDeutschemKanal(DE, new Set()), undefined)

  // Die echte Liste: leer oder ohne Namen wäre die Regel still aus.
  const echt = yaml.load(readFileSync(join(import.meta.dirname, '..', 'data', 'curated', 'youtube-kanaele-deutsch.yaml'), 'utf8')) as {
    kanaele: Record<string, unknown>[]
  }
  const voll = (k: Record<string, unknown>) => [k.name, k.handle, k.begruendung].every((f) => typeof f === 'string' && f !== '')
  erwarte('echte Liste: mindestens ein Kanal, jeder mit name, handle, begruendung', echt.kanaele.length >= 1 && echt.kanaele.every(voll), true)

  const listenPfad = join(kulisse, 'data', 'curated', 'youtube-kanaele-deutsch.yaml')
  writeFileSync(listenPfad, 'kanaele: [unfertig\n')
  let kaputtWirft = false
  try {
    ladeDeutscheKanaele()
  } catch {
    kaputtWirft = true
  }
  erwarte('kaputte Liste wirft, statt leer zu laden', kaputtWirft, true)
  rmSync(listenPfad)
  erwarte('ohne Datei: leere Liste', [...ladeDeutscheKanaele()], [])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-youtube-kanal-deutsch:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-youtube-kanal-deutsch: ${pruefungen} Prüfungen ok.`)
