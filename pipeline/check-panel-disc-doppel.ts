/**
 * (1) (Seit 27.10.2026 entfallen: die Einzelausgaben-Liste unter dem Kasten gibt es nicht mehr, die Varianten stehen im Disc-Bereich.)
 * (2) Ein Stream-Bezugsweg (der Helfer filtert nur die Stream-Liste; Kauf-Wege laufen an ihm vorbei) auf derselben Seite wie ein Verweis ist keine zweite Pille (Lauf durch `sortiereNachZugang`).
 * (3) Der Handbeleg „freenet meinVOD, Deutsch“ zu Your Forma steht in `data/watch-links.yaml`.
 * Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { sortiereNachZugang } from '../web/src/components/detail/wege-sortieren.ts'
import { loadWatchLinks } from './lib/curated.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

/* (2) Saiyuki: Verweis „Prime Video (Aniverse)“ und Bezugsweg „Amazon Prime (Aniverse)“ auf derselben Seite. */
const prime = 'https://www.amazon.de/gp/video/detail/B0DMFV78H5'
function titel(streams: unknown[], watchLinks: unknown[]): Title {
  return { id: 900001, format: 'TV', streams, watchLinks } as unknown as Title
}
function pillen(t: Title): string[] {
  return sortiereNachZugang({ title: t }).flatMap((g) => [...g.plattformen.map((s) => `stream:${s.url}`), ...g.streamWege.map((w) => `weg:${w.eintraege[0].url}`)])
}
const verweis = { platform: 'primevideo', url: prime, kanal: 'Aniverse', zugang: 'abo' }
const weg = (url: string, kind = 'stream') => ({ name: 'Amazon Prime (Aniverse)', url, kind, zugang: 'abo' })
pruefe('gleiche Seite: eine Pille (der Verweis)', pillen(titel([verweis], [weg(prime)])).join() === `stream:${prime}`, pillen(titel([verweis], [weg(prime)])))
const gti = 'https://watch.amazon.de/detail?gti=amzn1.dv.gti.6ce997fe-4a0d-4851-ba34-116bdf1033e8'
pruefe(
  'Verweis mit `seite`: der Bezugsweg auf dieser Seite entfällt',
  pillen(titel([{ ...verweis, url: gti, seite: prime }], [weg(prime)])).join() === `stream:${gti}`,
  pillen(titel([{ ...verweis, url: gti, seite: prime }], [weg(prime)])),
)
const andere = 'https://www.amazon.de/gp/video/detail/B0CJ3GKPHF'
pruefe('andere Seite (andere Prime-Kennung): beide bleiben', pillen(titel([verweis], [weg(andere)])).length === 2, pillen(titel([verweis], [weg(andere)])))
const kauf = sortiereNachZugang({ title: titel([verweis], [{ name: 'Amazon', url: prime, kind: 'buy', zugang: 'kauf' }]) })
pruefe('Kauf-Weg (`buy`) auf derselben Seite bleibt in den Shops', kauf.some((g) => g.shops.length === 1), kauf.map((g) => g.shops.length))
/* Mehrstaffel-Serienadresse: zwei Verweise auf einer Adresse (Staffeln), ein Bezugsweg darauf entfällt, ein anderer Weg bleibt. */
const staffeln = [
  { ...verweis, teilBereich: { von: 1, bis: 12 } },
  { ...verweis, teilBereich: { von: 13, bis: 24 } },
]
const mehr = pillen(titel(staffeln, [weg(prime), weg(andere)]))
pruefe('Mehrstaffel: Bezugsweg auf der Serienadresse entfällt, andere Seite bleibt', mehr.filter((p) => p.startsWith('weg:')).join() === `weg:${andere}`, mehr)

/* (3) Handbeleg freenet. */
const eintrag = loadWatchLinks().find((e) => e.anilistId === 167142)
const freenet = eintrag?.links?.find((l) => /^freenet meinVOD$/.test(l.name))
pruefe('Your Forma: freenet meinVOD mit Deutsch (Folge 1) von Hand belegt', freenet?.dubRanges?.[0]?.dub === true && freenet.dubRanges[0].from === 1 && freenet.kind === 'buy', freenet)
pruefe('Handbeleg nennt seine Adresse als Quelle', Boolean(freenet && eintrag?.sources.includes(freenet.url)), eintrag?.sources)

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('check-panel-disc-doppel: alle Zusicherungen erfüllt')
