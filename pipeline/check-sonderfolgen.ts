/**
 * Sonderfolgen in Handbelegen (28.10.2026): Higurashi Kai führt bei Amazon (B09KX2VLPR) als Folge 25 die Bonusfolge „The Cat Killing
 * Chapter (OmU)“; unser Titel hat 24 Folgen. Der Beleg trägt `sonderfolgen: [25]`, und `belegeUeberFolgenzahl` zählt diese Folge nicht.
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { belegeUeberFolgenzahl } from './lib/dub-confirmed.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const URL_KAI = 'https://www.amazon.de/gp/video/detail/B09KX2VLPR'
const kai = (extra: Record<string, unknown> = {}, spannen = [{ from: 1, to: 24 }, { from: 25, to: 25 }]) => ({
  anilistId: 1889,
  platform: 'primevideo',
  url: URL_KAI,
  dubRanges: spannen,
  ...extra,
})
const folgen24 = new Map([[1889, 24]])
const zeilen = (b: object[], n = folgen24) => belegeUeberFolgenzahl(b, n)

console.log('Sonderfolgen in Handbelegen\n')
pruefe('ohne Kennzeichnung zählt Folge 25 bei 24 Folgen (Kontrolle)', zeilen([kai()]).length === 1, zeilen([kai()]))
pruefe('mit sonderfolgen [25] zählt sie nicht', zeilen([kai({ sonderfolgen: [25] })]).length === 0, zeilen([kai({ sonderfolgen: [25] })]))
pruefe('eine andere Sonderfolge (24) deckt die 25 nicht', zeilen([kai({ sonderfolgen: [24] })]).length === 1)
pruefe('Folge 26 neben Sonderfolge 25 zählt', zeilen([kai({ sonderfolgen: [25] }, [{ from: 1, to: 26 }])]).join() === `1889 primevideo ${URL_KAI}: bis Folge 26 bei 24`)
pruefe('Sonderfolgen 25 und 26 am Ende einer Spanne zählen beide nicht', zeilen([kai({ sonderfolgen: [25, 26] }, [{ from: 1, to: 26 }])]).length === 0)
pruefe('Sonderfolge in der Mitte einer Spanne verdeckt eine höhere Folge nicht', zeilen([kai({ sonderfolgen: [25] }, [{ from: 1, to: 27 }])]).length === 1)
pruefe('eine zweite Spanne über der Zahl zählt trotz Sonderfolge', zeilen([kai({ sonderfolgen: [25] }, [{ from: 1, to: 25 }, { from: 28, to: 30 }])]).length === 1)
pruefe('Spanne ohne from: Sonderfolge gilt auch dort', zeilen([kai({ sonderfolgen: [25] }, [{ to: 25 } as never])]).length === 0)
pruefe('genau 24 bleibt unauffällig (Grenze)', zeilen([kai({}, [{ from: 1, to: 24 }])]).length === 0)
pruefe('eine Spanne nur aus Sonderfolgen über der Zahl zählt nicht', zeilen([kai({ sonderfolgen: [30] }, [{ from: 1, to: 24 }, { from: 30, to: 30 }])]).length === 0)
pruefe('Sonderfolge 26 lässt die 25 darunter zählen', zeilen([kai({ sonderfolgen: [26] }, [{ from: 1, to: 26 }])]).join() === `1889 primevideo ${URL_KAI}: bis Folge 25 bei 24`)
pruefe('Spanne ohne from und ohne Sonderfolge zählt über der Zahl', zeilen([kai({}, [{ to: 25 } as never])]).length === 1)

/* Der echte Beleg: Er steht in der Handbeleg-Datei, trägt die Kennzeichnung, und die Prüfung findet keine Zeile für ihn. */
const liste = yaml.load(readFileSync(new URL('../data/dub-confirmed.yaml', import.meta.url), 'utf8')) as (ReturnType<typeof kai> & { sonderfolgen?: number[] })[]
const echt = liste.filter((b) => b.anilistId === 1889 && b.url === URL_KAI)
pruefe('der echte Beleg steht genau einmal in der Datei', echt.length === 1, echt.length)
pruefe('der echte Beleg nennt Folge 25 als Sonderfolge', JSON.stringify(echt[0]?.sonderfolgen) === '[25]', echt[0]?.sonderfolgen)
pruefe('der echte Beleg: keine Zeile über der Folgenzahl 24', zeilen(echt).length === 0, zeilen(echt))
const ohne = echt.map((b) => ({ ...b, sonderfolgen: undefined }))
pruefe('derselbe Beleg ohne Kennzeichnung würde zählen', zeilen(ohne).length === 1, zeilen(ohne))

if (fehler) {
  console.error(`FEHL check-sonderfolgen: ${fehler} Zusicherung(en) rot`)
  process.exit(1)
}
console.log('OK check-sonderfolgen: 16 Zusicherungen')
