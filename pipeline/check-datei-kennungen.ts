import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NACH_DEM_BAU_UMGESCHRIEBEN, dateiKennungen, schreibeDateienInMeta } from '../tools/daten-kennungen.ts'
import { uebersetzteKopie } from '../tools/vite-kennungen.ts'
import { vorladeSkript } from '../tools/vite-vorladen.ts'
import { datenAdresse } from '../web/src/lib/daten-adresse.ts'

/** Zusicherung: Eine Datendatei ändert ihre Adresse genau dann, wenn sich ihr Inhalt (bzw. der ihres Ordners) ändert. */
const fehler: string[] = []
const pruefe = (text: string, ok: boolean) => {
  if (!ok) fehler.push(text)
}

const ordner = mkdtempSync(join(tmpdir(), 'datei-kennungen-'))
const schreibe = (name: string, inhalt: string) => writeFileSync(join(ordner, name), inhalt)
mkdirSync(join(ordner, 'voices'))
mkdirSync(join(ordner, 'voices', 'tief'))
mkdirSync(join(ordner, 'disc'))
schreibe('events.json', '[1]')
schreibe('meta.json', '{"generatedAt":"x","titleCount":1}')
schreibe('titles.json', '[3]')
schreibe('releases.json', '[2]')
schreibe('notiz.txt', 'keine Datendatei')
schreibe('voices/1.json', '{}')
schreibe('voices/0.json', '{"z":0}')
schreibe('voices/a.json', 'a')
schreibe('voices/B.json', 'B')
schreibe('voices/tief/2.json', '{}')
schreibe('disc/0.json', '{}')

const vorher = dateiKennungen(ordner)
pruefe('Schlüssel: jede Datei und jeder Ordner, sonst nichts', Object.keys(vorher).join() === 'disc/,events.json,meta.json,releases.json,titles.json,voices/')
pruefe('Kennung ist sha256, 8 Zeichen', Object.values(vorher).every((k) => /^[0-9a-f]{8}$/.test(k)))
pruefe('Kennung ist deterministisch', JSON.stringify(dateiKennungen(ordner)) === JSON.stringify(vorher))
const sha = (...teile: string[]) => teile.reduce((h, t) => h.update(t), createHash('sha256')).digest('hex').slice(0, 8)
pruefe('Kennung einer Datei = sha256 ihres Inhalts', vorher['events.json'] === sha('[1]'))
pruefe('Kennung eines Ordners = sha256 über Pfad und Inhalt in Namensreihenfolge (Linux sortiert nicht von selbst)', vorher['voices/'] === sha('voices/0.json', '{"z":0}', 'voices/1.json', '{}', 'voices/B.json', 'B', 'voices/a.json', 'a', 'voices/tief/2.json', '{}'))
pruefe('ausgenommene Dateien fehlen, die übrigen bleiben gleich', Object.keys(dateiKennungen(ordner, ['meta.json', 'titles.json'])).join() === 'disc/,events.json,releases.json,voices/' && dateiKennungen(ordner, ['meta.json'])['events.json'] === vorher['events.json'])
pruefe('der Bau nimmt meta.json und patchnotes.json aus', NACH_DEM_BAU_UMGESCHRIEBEN.join() === 'meta.json,patchnotes.json')
pruefe('verschiedener Inhalt, verschiedene Kennung', new Set([vorher['events.json'], vorher['titles.json'], vorher['releases.json']]).size === 3)

schreibe('releases.json', '[2,2]')
const nachRelease = dateiKennungen(ordner)
const geaendert = (a: Record<string, string>, b: Record<string, string>) => Object.keys(a).filter((k) => a[k] !== b[k]).join()
pruefe(`nur die geänderte Datei bekommt eine neue Kennung (war: ${geaendert(vorher, nachRelease)})`, geaendert(vorher, nachRelease) === 'releases.json')

schreibe('voices/tief/2.json', '{"a":1}')
const nachVoice = dateiKennungen(ordner)
pruefe(`eine Datei tief im Ordner ändert nur die Kennung des Ordners (war: ${geaendert(nachRelease, nachVoice)})`, geaendert(nachRelease, nachVoice) === 'voices/')

schreibe('voices/tief/2.json', '{}')
schreibe('voices/tief/3.json', '{}')
pruefe('eine neue Datei im Ordner ändert die Ordnerkennung', dateiKennungen(ordner)['voices/'] !== vorher['voices/'])
pruefe('derselbe Inhalt unter anderem Namen im Ordner ändert die Ordnerkennung', (() => {
  const a = mkdtempSync(join(tmpdir(), 'dk-a-'))
  const b = mkdtempSync(join(tmpdir(), 'dk-b-'))
  for (const [wurzel, datei] of [[a, 'x.json'], [b, 'y.json']] as const) {
    mkdirSync(join(wurzel, 'voices'))
    writeFileSync(join(wurzel, 'voices', datei), '{}')
  }
  return dateiKennungen(a)['voices/'] !== dateiKennungen(b)['voices/']
})())

/* Die Kennung hängt an der übersetzten Fassung (`uebersetzteKopie`): eine Änderung der Übersetzung ändert die Adresse, eine unbeteiligte Zeile in `data/kennungen.json` nicht. */
function kennungenMitZeilen(zeilen: number[][], titles = '[{"id":5,"slug":"x"}]'): Record<string, string> {
  const wurzel = mkdtempSync(join(tmpdir(), 'datei-kennungen-bau-'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'))
  writeFileSync(join(wurzel, 'public', 'data', 'titles-core.json'), titles)
  writeFileSync(join(wurzel, 'public', 'data', 'events.json'), '[{"titleId":7}]')
  writeFileSync(join(wurzel, 'public', 'data', 'pruefliste-stand.json'), '{"a":1}')
  writeFileSync(join(wurzel, 'data', 'kennungen.json'), JSON.stringify({ titel: zeilen }))
  return dateiKennungen(uebersetzteKopie(wurzel), NACH_DEM_BAU_UMGESCHRIEBEN)
}
const basis = kennungenMitZeilen([[1, 5, 0], [2, 7, 0]])
const mitFremderZeile = kennungenMitZeilen([[1, 5, 0], [2, 7, 0], [3, 9, 0]])
pruefe(`Übersetzung: eine unbeteiligte neue Zeile in kennungen.json ändert nur die Zuordnungsdatei (war: ${geaendert(basis, mitFremderZeile)})`, geaendert(basis, mitFremderZeile) === 'anilist-ak.json')
const andereKennung = kennungenMitZeilen([[1, 5, 0], [20, 7, 0]])
pruefe(`Übersetzung: eine geänderte Kennung ändert nur die Dateien, die sie tragen (war: ${geaendert(basis, andereKennung)})`, geaendert(basis, andereKennung) === 'anilist-ak.json,events.json')
pruefe('Übersetzung: anderer übersetzter Inhalt ändert die Kennung der Datei', kennungenMitZeilen([[1, 5, 0], [2, 7, 0]], '[{"id":5,"slug":"x","neu":1}]')['titles-core.json'] !== basis['titles-core.json'])
pruefe('Übersetzung: die Kennung der Datei ist die ihres übersetzten Inhalts, nicht der Quelle', basis['events.json'] === sha('[{"titleId":2}]'))

const kennungen = { 'events.json': 'aaaaaaaa', 'meta.json': 'bbbbbbbb', 'titles.json': 'cccccccc', 'voices/': 'dddddddd', 'releases.json': 'eeeeeeee' }
const adresse = (pfad: string) => datenAdresse('/', pfad, kennungen, 'ersatz')
pruefe('Adresse: Datei trägt ihre eigene Kennung', adresse('titles.json') === '/data/titles.json?v=cccccccc' && adresse('events.json') === '/data/events.json?v=aaaaaaaa')
pruefe('Adresse: Datei im Ordner trägt die Ordnerkennung', adresse('voices/77.json') === '/data/voices/77.json?v=dddddddd')
pruefe('Adresse: nicht erfasste Datei und nicht erfasster Ordner nehmen den Ersatz', adresse('news.json') === '/data/news.json?v=ersatz' && adresse('folgen/5.json') === '/data/folgen/5.json?v=ersatz')
pruefe('Adresse: Basis wird vorangestellt', datenAdresse('/sub/', 'meta.json', kennungen, 'e') === '/sub/data/meta.json?v=bbbbbbbb')

const skript = vorladeSkript({ base: '/', kennungen, ersatz: 'ersatz', woche: { von: '2026-10-12', bis: '2026-10-18' } })
for (const [name, v] of [['meta', 'bbbbbbbb'], ['events', 'aaaaaaaa'], ['titles-core', 'ersatz'], ['releases', 'eeeeeeee'], ['woche-kacheln', 'ersatz']] as const) {
  pruefe(`Vorladen: ${name}.json mit Kennung ${v}`, skript.includes(`"${name}":"/data/${name}.json?v=${v}"`))
}
pruefe('Vorladen: das Skript setzt die Adresse aus der Tabelle, nicht aus Name und Ersatz', skript.includes('l.href = A[n];'))

const meta = join(ordner, 'meta-ausgeliefert.json')
writeFileSync(meta, JSON.stringify({ generatedAt: 'x', titleCount: 1 }))
schreibeDateienInMeta(meta, kennungen)
const gelesen = JSON.parse(readFileSync(meta, 'utf8')) as { generatedAt: string; titleCount: number; dateien: Record<string, string> }
pruefe('meta.json: bisherige Felder bleiben', gelesen.generatedAt === 'x' && gelesen.titleCount === 1)
pruefe('meta.json: dateien nennt die übergebenen Kennungen', Object.keys(gelesen.dateien).join() === Object.keys(kennungen).join() && gelesen.dateien['titles.json'] === 'cccccccc')

if (fehler.length) {
  console.error('✖ Datei-Kennungen:', fehler.join('; '))
  process.exit(1)
}
console.log('  ✓ Datei-Kennungen: Adresse ändert sich nur mit dem Inhalt der Datei bzw. ihres Ordners')
