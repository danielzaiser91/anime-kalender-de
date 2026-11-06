/**
 * Ablauftest zu `schreibeCartoons` (`bau/nebendateien.ts`): Eine Cartoon-Serie aus der Handliste eigener Serien (`cartoon-eigene-serien.yaml`)
 * steht in `public/data/cartoons.json` mit `eigenesWerk`, ihre Reihe-Geschwister ohne (PR 2935 A1: die Markierung lief auf anderen Objekten,
 * 0 von 925 Cartoons trugen sie). Kulisse im Temp-Ordner (`AK_ROOT`), erfundene Titel ab 900000; Reihe über die Handliste `cartoon-reihen-von-hand.yaml`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzel = mkdtempSync(join(tmpdir(), 'cartoon-reihenteil-'))
process.env.AK_ROOT = wurzel
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })

const eintrag = (tmdbId: number, titleEn: string, jahr: string) => [
  String(-tmdbId),
  { id: -tmdbId, tmdbId, titleEn, genres: ['Animation'], anbieterDe: ['Netflix'], land: ['US'], studios: [], keywords: [], geholtAm: '2026-10-16', erstausstrahlung: jahr },
]
writeFileSync(join(wurzel, 'data', 'cartoons.json'), JSON.stringify(Object.fromEntries([eintrag(900301, 'Hauptserie', '2005-01-01'), eintrag(900302, 'Nachfolger', '2012-01-01'), eintrag(900303, 'Allein', '2013-01-01')])))
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
writeFileSync(join(wurzel, 'data', 'cartoon-reihen-von-hand.yaml'), "- name: Hauptserie\n  ids: [-900301, -900302]\n  quelle: https://example.org/reihe\n")
writeFileSync(join(wurzel, 'data', 'cartoon-eigene-serien.yaml'), "- ids: [-900302, -900303]\n  grund: Erfundener Fall, eigene Serie\n  quelle: https://example.org/eigene\n")

let verletzt = 0
try {
  const { schreibeCartoons } = await import('./bau/nebendateien.ts')
  schreibeCartoons()
  const titel = JSON.parse(readFileSync(join(wurzel, 'public', 'data', 'cartoons.json'), 'utf8')) as { id: number; franchiseId?: number; eigenesWerk?: boolean }[]
  const je = (id: number) => titel.find((t) => t.id === id)
  const ist = { haupt: je(-900301)?.eigenesWerk, nachfolger: je(-900302)?.eigenesWerk, allein: je(-900303)?.eigenesWerk, reihe: je(-900302)?.franchiseId }
  if (ist.reihe === undefined || ist.haupt !== undefined || ist.nachfolger !== true || ist.allein !== undefined) {
    verletzt++
    console.error(`  ✖ Bau markiert die eigene Serie einer Reihe, nicht die Hauptserie und nicht die ohne Reihe — gefunden ${JSON.stringify(ist)}`)
  } else {
    console.log('  ✓ Bau markiert die eigene Serie einer Reihe (eigenesWerk), nicht die Hauptserie und nicht die ohne Reihe')
  }
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
if (verletzt) process.exit(1)
