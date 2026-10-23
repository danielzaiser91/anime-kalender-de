/**
 * Ablauftest zu `schreibeCartoons` (`bau/nebendateien.ts`): Handbelege legen die Wege der Cartoons an oder nehmen sie heraus; ein Nein zu einer
 * anderen Ausgabe desselben Anbieters nimmt den Weg einer Ausgabe mit Ja nicht mit (18.10.2026, Hazbin Hotel und fünf weitere).
 * Läuft auf einer Kulisse im Temp-Ordner (`AK_ROOT`) mit erfundenen Titeln; die Fälle haben die Form der echten Belege.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const wurzel = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'cartoon-belege-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })

const eintrag = (tmdbId: number, o: Record<string, unknown>) => [
  String(-tmdbId),
  { id: -tmdbId, tmdbId, titleEn: `Erfunden ${tmdbId}`, genres: ['Animation'], anbieterDe: [], land: ['US'], studios: [], keywords: [], geholtAm: '2026-10-16', netzwerk: 'Netflix', ...o },
]
const roh = Object.fromEntries([
  eintrag(11, { anbieterDe: ['Netflix'] }),
  eintrag(12, {}),
  eintrag(13, { anbieterDe: ['Netflix'] }),
  eintrag(14, { anbieterDe: ['Amazon Prime Video'] }),
  eintrag(15, {}),
  eintrag(16, {}),
  eintrag(17, {}),
  eintrag(18, {}),
  eintrag(19, {}),
  eintrag(20, { anbieterDe: ['Amazon Prime Video'] }),
  eintrag(21, { anbieterDe: ['Amazon Prime Video'] }),
  eintrag(22, { anbieterDe: ['Amazon Prime Video'] }),
])
writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify(roh))
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')

const zeile = (id: number, platform: string, url: string, urteil: string, tag = '12') =>
  `- anilistId: ${id}\n  title: "Erfunden ${-id}"\n  platform: ${platform}\n  url: ${url}\n  ${urteil}\n  checkedAt: '2026-10-${tag}'\n`
const prime = (kennung: string) => `https://www.amazon.de/gp/video/detail/${kennung}`
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  [
    /* Hazbin Hotel: zwei Ja und ein Nein zu einer dritten Prime-Seite, das Nein steht zuletzt. */
    zeile(-12, 'primevideo', prime('B0AAAAAAA1'), 'dub: true'),
    zeile(-12, 'primevideo', prime('B0AAAAAAA2'), 'dub: true'),
    zeile(-12, 'primevideo', prime('B0AAAAAAA3'), 'dub: false'),
    /* Ein Titel mit Netflix-Weg aus TMDB bekommt ein Ja bei Prime: beide Wege stehen, jeder mit seiner Adresse. */
    zeile(-11, 'primevideo', prime('B0DDDDDDD1'), 'dub: true'),
    /* Ein Nein ohne Ja bei einem Weg aus TMDB nimmt ihn heraus (wie bisher). */
    zeile(-13, 'netflix', 'https://www.netflix.com/title/1313', 'available: false'),
    /* Ja und Nein zur selben Adresse am selben Tag, dazu ein Prime-Weg aus TMDB: das Nein gilt, kein Weg. */
    zeile(-14, 'primevideo', prime('B0BBBBBBB1'), 'dub: true'),
    zeile(-14, 'primevideo', prime('B0BBBBBBB1'), 'dub: false'),
    /* Ein Ja ohne Nein legt den Weg an. */
    zeile(-15, 'primevideo', prime('B0CCCCCCC1'), 'dub: true'),
    /* Ein Beleg nur mit Adresse legt den Weg an, ohne Sprachurteil. */
    zeile(-16, 'netflix', 'https://www.netflix.com/title/1616', 'note: nur die Adresse'),
    /* Ein Ja mit Folgenbereichen behält sie am Weg. */
    `${zeile(-17, 'netflix', 'https://www.netflix.com/title/1717', 'dub: true')}  dubRanges:\n    - from: 1\n      to: 3\n      dub: true\n`,
    /* Ja zu A, danach eine Kanal-Zeile ohne Urteil zu C: der Weg mit Deutsch zeigt auf A. */
    zeile(-18, 'primevideo', prime('B0AAAAAAA8'), 'dub: true'),
    zeile(-18, 'primevideo', prime('B0KKKKKKK8'), 'note: Kanal-Ausgabe, kein Urteil'),
    /* Dasselbe, die Kanal-Zeile steht vor dem Ja. */
    zeile(-19, 'primevideo', prime('B0KKKKKKK9'), 'note: Kanal-Ausgabe, kein Urteil'),
    zeile(-19, 'primevideo', prime('B0AAAAAAA9'), 'dub: true'),
    /* Altes Ja, jüngeres „nicht verfügbar“ zur selben Adresse, dazu ein Prime-Weg aus TMDB: kein Weg (wie bei dub: false). */
    zeile(-20, 'primevideo', prime('B0FFFFFF20'), 'dub: true', '01'),
    zeile(-20, 'primevideo', prime('B0FFFFFF20'), 'available: false'),
    /* Dasselbe neben einer zweiten Ausgabe mit Ja: der Weg zeigt auf diese, nicht auf die verneinte. */
    zeile(-21, 'primevideo', prime('B0GGGGGG21'), 'dub: true'),
    zeile(-21, 'primevideo', prime('B0HHHHHH21'), 'dub: true', '01'),
    zeile(-21, 'primevideo', prime('B0HHHHHH21'), 'available: false'),
    /* Ja für den ganzen Anbieter (ohne Adresse), danach eine Kanal-Zeile: sie überschreibt die Adresse des Wegs nicht. */
    `- anilistId: -22\n  title: "Erfunden 22"\n  platform: primevideo\n  dub: true\n  checkedAt: '2026-10-12'\n`,
    zeile(-22, 'primevideo', prime('B0KKKKKKK22'), 'note: Kanal-Ausgabe, kein Urteil'),
    /* Ein Beleg zu einem Titel, den es nicht gibt, ändert nichts. */
    zeile(-99, 'primevideo', prime('B0EEEEEEE1'), 'dub: true'),
  ].join(''),
)

let verletzt = 0
function erwarte(name: string, ok: boolean, info: string): void {
  if (!ok) verletzt++
  console.log(`  ${ok ? '✓' : '✖'} ${name}${ok ? '' : ` — ${info}`}`)
}
try {
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  const { wendeCartoonBelegeAn } = await import('./bau/cartoon-belege.ts')
  schreibeCartoons()
  const aus = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), 'utf8')) as {
    id: number
    streams: { platform: string; url: string; dub?: boolean; dubRanges?: unknown[] }[]
  }[]
  const wege = (id: number) => aus.find((t) => t.id === id)?.streams ?? []
  const hazbin = wege(-12)
  erwarte('Ja-Ausgabe behält ihren Weg trotz Nein zu einer anderen Prime-Seite', hazbin.length === 1 && hazbin[0].dub === true && /A{7}[12]$/.test(hazbin[0].url), JSON.stringify(hazbin))
  const zwei = wege(-11)
  erwarte(
    'Ja bei Prime ersetzt nicht den Netflix-Weg desselben Titels',
    zwei.length === 2 && zwei.some((s) => s.platform === 'netflix' && s.dub === undefined) && zwei.some((s) => s.platform === 'primevideo' && s.dub === true && s.url.endsWith('D1')),
    JSON.stringify(zwei),
  )
  erwarte('Nein ohne Ja nimmt den Weg heraus', wege(-13).length === 0, JSON.stringify(wege(-13)))
  erwarte('Ja und Nein zur selben Adresse: der Weg aus TMDB fällt weg', wege(-14).length === 0, JSON.stringify(wege(-14)))
  erwarte('Ja ohne Nein legt den Weg an', wege(-15).length === 1 && wege(-15)[0].dub === true, JSON.stringify(wege(-15)))
  erwarte('Beleg nur mit Adresse: Weg ohne Sprachurteil', wege(-16).length === 1 && wege(-16)[0].dub === undefined && wege(-16)[0].url.endsWith('1616'), JSON.stringify(wege(-16)))
  erwarte('Folgenbereiche des Ja bleiben am Weg', wege(-17).length === 1 && wege(-17)[0].dubRanges?.length === 1, JSON.stringify(wege(-17)))
  const w18 = wege(-18)
  erwarte('Ja zu A, danach Kanal-Zeile C: der Weg mit Deutsch trägt A', w18.length === 1 && w18[0].dub === true && w18[0].url.endsWith('A8'), JSON.stringify(w18))
  const w19 = wege(-19)
  erwarte('Kanal-Zeile C vor dem Ja zu A: der Weg mit Deutsch trägt A', w19.length === 1 && w19[0].dub === true && w19[0].url.endsWith('A9'), JSON.stringify(w19))
  erwarte('Altes Ja, jüngeres „nicht verfügbar“ zur selben Adresse: kein Weg', wege(-20).length === 0, JSON.stringify(wege(-20)))
  const w21 = wege(-21)
  erwarte('Altes Ja, jüngeres „nicht verfügbar“ zur selben Adresse neben anderem Ja: Weg trägt das andere', w21.length === 1 && w21[0].dub === true && w21[0].url.endsWith('G21'), JSON.stringify(w21))
  const w22 = wege(-22)
  erwarte('Ja ohne Adresse, danach Kanal-Zeile: Weg mit Deutsch behält seine Adresse', w22.length === 1 && w22[0].dub === true && !w22[0].url.endsWith('K22'), JSON.stringify(w22))
  erwarte('Beleg zu unbekanntem Titel legt keinen an', !aus.some((t) => t.id === -99), String(aus.length))
  const titel = [{ id: -1, streams: [] }, { id: -2, streams: [] }] as unknown as Title[]
  const ja = (anilistId: number, kennung: string) => ({ anilistId, platform: 'primevideo' as const, url: prime(kennung), dub: true })
  erwarte('Rückgabe zählt die Wege mit Ja', wendeCartoonBelegeAn(titel, [ja(-1, 'B0X1'), ja(-2, 'B0X2'), ja(-3, 'B0X3')]) === 2, '')
} finally {
  if (!process.argv[2]) rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
