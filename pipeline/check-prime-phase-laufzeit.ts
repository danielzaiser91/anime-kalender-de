/**
 * Zusicherung: **Der Prime-Schritt der Bauphase 9 (`09-3-prime.ts`) verhält sich wie zugesagt** — als Lauf gegen eine Kulisse
 * (`AK_ROOT`), nicht als Textsuche im Quelltext. Ersetzt die `includes`-/Regex-Zusicherungen aus `check-logic.ts`
 * („Suchlink respektiert das belegte Nein", „Verweis zeigt auf die gemeldete Seite", „dritter Verweis", „Plattform des Melders",
 * „Amazon-Eigenes bleibt an Prime gebunden", „Handbeleg gilt seiner Adresse"). Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-phase-laufzeit-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const suche = (wort: string) => `https://www.amazon.de/s?k=${wort}&i=instant-video`
const NETFLIX = 'https://www.netflix.com/title/81234567'
const DEUTSCH = [{ unsere: 1, sprachen: ['Deutsch', 'Japanisch'] }]

/** Eine Rohfolgen-Zuordnung (Meldung); Schlüssel = gemeldete Seite + `#0`. */
const meldung = (id: number, seite: string, asin: string | null, plattform = 'primevideo') => ({
  schluessel: `${seite}#0`,
  wert: { titleId: id, plattform, asin, folgen: DEUTSCH },
})
const meldungen = [
  meldung(900101, dp('B0TITELSEIT'), 'B0ERSTEFOLG'),
  meldung(900102, dp('B0DRITTESEI'), 'B0DRITTESEI'),
  meldung(900103, NETFLIX, null, 'netflix'),
  meldung(900104, dp('B0ANDEREAUS'), 'B0ANDEREAUS'),
]
const prime = (url: string) => ({ platform: 'primevideo', url })

interface SuchFall {
  id: number
  name: string
  /** Belegfrage der Attrappe: Antwort nur für genau diese Adresse und diesen Titel. */
  beleg?: { available?: boolean; dub?: boolean }
  befund?: { status: number | string; prime?: boolean }
  tot?: boolean
  erwartetErsetzt: boolean
}
const ECHT = (id: number) => dp(`B0ECHT${id}`)
const suchFaelle: SuchFall[] = [
  { id: 900201, name: 'Kontrolle: belegte Titelseite ersetzt die Suche', erwartetErsetzt: true },
  { id: 900202, name: 'Handbeleg available:false zur neuen Adresse: Suche bleibt', beleg: { available: false }, erwartetErsetzt: false },
  { id: 900203, name: 'Handbeleg dub:false zur neuen Adresse: Suche bleibt', beleg: { dub: false }, erwartetErsetzt: false },
  { id: 900204, name: 'Linkprüfung kennt die Adresse als tot: Suche bleibt', tot: true, erwartetErsetzt: false },
  { id: 900205, name: 'Befund 404 statt 200: Suche bleibt', befund: { status: 404, prime: true }, erwartetErsetzt: false },
  { id: 900206, name: 'Befund 200, aber keine Produktseite: Suche bleibt', befund: { status: 200, prime: false }, erwartetErsetzt: false },
]

const fehler: string[] = []
const erwarte = (name: string, ist: unknown, soll: unknown) => {
  if (JSON.stringify(ist) !== JSON.stringify(soll)) fehler.push(`${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}
try {
  schreibe('data/dub-confirmed.yaml', '# leer\n')
  schreibe('data/prime-zugeordnet.json', JSON.stringify(Object.fromEntries(meldungen.map((m) => [m.schluessel, m.wert]))))
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { dubKey } = await import('./lib/dub-confirmed.ts')
  /* Ein Handbeleg zur ersten Ausgabe sperrt die Meldung zur zweiten nicht. */
  const ersterBeleg = { anilistId: 900104, platform: 'primevideo' as const, url: dp('B0VORHAND03'), dub: true, checkedAt: '2026-10-30' }
  const mk = (id: number, streams: unknown[], mehr: object = {}) => [id, { id, slug: `laufzeit-${id}`, streams, ...mehr } as unknown as Title] as const
  const titles = new Map<number, Title>([
    mk(900101, [prime(suche('eins'))]),
    mk(900102, [prime(dp('B0VORHAND01')), prime(dp('B0VORHAND02'))]),
    mk(900103, []),
    mk(900104, [prime(dp('B0VORHAND03'))]),
    ...suchFaelle.map((f) => mk(f.id, [prime(suche(`s${f.id}`))], { watchLinks: [{ name: 'Amazon', url: ECHT(f.id), kind: 'stream' }] })),
  ])
  const linkBefunde = Object.fromEntries(suchFaelle.map((f) => [ECHT(f.id), { prime: true, status: 200, ...f.befund }]))
  const tot = new Set(suchFaelle.filter((f) => f.tot).map((f) => ECHT(f.id)))
  uebernehmePrimeUndCrVorschlaege({
    titles,
    checks: new Map([[dubKey(900104, 'primevideo'), ersterBeleg]]),
    alleChecks: [ersterBeleg],
    lautPruefungTot: (url) => tot.has(url),
    tmdbTitles: {},
    ytKanal: {},
    zugangJeAdresse: new Map(),
    joynZugang: new Map(),
    ytKauf: new Set(),
    geprueft: 0,
    entfernt: 0,
    ytAusTonspur: 0,
    adressen: 0,
    totEntfernt: 0,
    ytEntfernt: 0,
    linkBefunde,
    checksJePlattform: new Map(),
    anisearch: {},
    belegFuer: (id, plattform, url) => {
      const f = suchFaelle.find((x) => x.id === id)
      return f?.beleg && plattform === 'primevideo' && url === ECHT(id) ? ({ anilistId: id, platform: 'primevideo', checkedAt: '2026-10-30', ...f.beleg }) : undefined
    },
  })
  const urls = (id: number, plattform: string) => titles.get(id)!.streams.filter((s) => s.platform === plattform).map((s) => s.url)

  /* Verweis zeigt auf die gemeldete Seite, nicht auf die ASIN der ersten Folge (My First Girlfriend Is a Gal, 02.09.2026). */
  const gemeldet = urls(900101, 'primevideo')
  erwarte('Meldung zur Titelseite: ein Weg', gemeldet.length, 1)
  erwarte('… auf die gemeldete Seite', gemeldet[0]?.includes('B0TITELSEIT'), true)
  erwarte('… nicht auf die ASIN der ersten Folge', gemeldet[0]?.includes('B0ERSTEFOLG'), false)
  /* Deckel: ein dritter Prime-Verweis aus einer Meldung wird nicht angelegt, ein zweiter schon. */
  erwarte('dritter Prime-Verweis wird nicht angelegt', urls(900102, 'primevideo'), [dp('B0VORHAND01'), dp('B0VORHAND02')])
  erwarte('zweiter Prime-Verweis wird angelegt', urls(900104, 'primevideo').length, 2)
  /* Der Verweis gehört dem Anbieter, der gemeldet hat. */
  erwarte('Netflix-Meldung: Weg bei Netflix auf die gemeldete Adresse', urls(900103, 'netflix'), [NETFLIX])
  erwarte('Netflix-Meldung: kein Prime-Weg', urls(900103, 'primevideo'), [])
  for (const f of suchFaelle) {
    const ersetzt = urls(f.id, 'primevideo')[0] === ECHT(f.id)
    erwarte(f.name, ersetzt, f.erwartetErsetzt)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-phase-laufzeit:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prime-phase-laufzeit: ${suchFaelle.length + 6} Fälle ok.`)
