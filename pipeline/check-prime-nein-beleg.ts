/**
 * Zusicherung: **Eine Prime-Meldung schreibt keinen Weg zu einer Adresse, die irgendein Handbeleg verneint** (19.10.2026).
 * Anlass: „Date A Live" (15583) hat drei Nein-Adressen (B0C7LZHHTH, B0C7LZCS5H, B0CZS6FBVY); `checks` hält je Titel nur den letzten,
 * die Meldung zu B0C7LZCS5H legte den in 09-2 entfernten Weg neu an (Bestandsbau 39249344862, check:handbelege rot).
 * Fährt den Prime-Schritt der Bauphase 9 gegen eine Kulisse (`AK_ROOT`) und liest die Prime-Verweise ab. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-nein-beleg-'))
process.env.AK_ROOT = kulisse
const schreibe = (pfad: string, inhalt: string) => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), inhalt)
}
const dp = (asin: string) => `https://www.amazon.de/dp/${asin}`
const gp = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const suche = (wort: string) => `https://www.amazon.de/s?k=${wort}&i=instant-video`

const beleg = (id: number, url: string | null, urteil: string, plattform = 'primevideo') => `- anilistId: ${id}
  platform: ${plattform}
${url ? `  url: ${url}\n` : ''}  ${urteil}
  checkedAt: '2026-08-28'
`
const nein = (id: number, asin: string) => beleg(id, dp(asin), 'dub: false')
const ja = (id: number, asin: string) => beleg(id, dp(asin), 'dub: true')
const weg = (id: number, asin: string, plattform = 'primevideo', url = dp(asin)) => beleg(id, url, 'available: false', plattform)

interface Fall {
  id: number
  name: string
  /** Handbelege in Dateireihenfolge — der letzte landet in `checks`. */
  belege: string
  /** ASIN der gemeldeten Seite. */
  meldung: string
  /** Schlüssel der Rohfolge (Adresse der Prüfliste), wenn er nicht die Titelseite der Meldung ist. */
  schluessel?: string
  /** Prime-Verweise, die der Titel vor der Meldung schon führt. */
  vorhanden?: string[]
  /** Die Meldung gilt einer verneinten oder fremd belegten Adresse: kein Verweis darauf, kein Häkchen. */
  gesperrt: boolean
  /** Rohfolge ohne ASIN (Meldung nur mit Schlüssel). */
  ohneAsin?: boolean
  /** Erwartung für `dub: true` an den Verweisen, wenn sie geprüft werden soll. */
  erwartetHaken?: boolean
  erwartetWege: number
}
const faelle: Fall[] = [
  {
    id: 15583,
    name: 'Date A Live, Belegform: drei Nein-Adressen, Meldung zur ersten',
    belege: nein(15583, 'B0C7LZCS5H') + nein(15583, 'B0C7LZHHTH') + nein(15583, 'B0CZS6FBVY'),
    meldung: 'B0C7LZCS5H',
    gesperrt: true,
    erwartetWege: 0,
  },
  {
    id: 900006,
    name: 'Laufform 39249344862: neuer available:false-Beleg in gp-Form vor zwei Nein, Meldung in dp-Form',
    belege: weg(900006, 'B0FFFFFFF1', 'primevideo', gp('B0FFFFFFF1')) + nein(900006, 'B0FFFFFFF2') + nein(900006, 'B0FFFFFFF3'),
    meldung: 'B0FFFFFFF1',
    gesperrt: true,
    erwartetWege: 0,
  },
  {
    id: 900001,
    name: 'Meldung zum mittleren von drei Nein-Belegen',
    belege: nein(900001, 'B0AAAAAAA1') + nein(900001, 'B0AAAAAAA2') + nein(900001, 'B0AAAAAAA3'),
    meldung: 'B0AAAAAAA2',
    gesperrt: true,
    erwartetWege: 0,
  },
  {
    id: 900002,
    name: 'Meldung zu einer Adresse ohne Beleg: Weg wird angelegt (kein Plattform-Nein)',
    belege: nein(900002, 'B0BBBBBBB1') + nein(900002, 'B0BBBBBBB3'),
    meldung: 'B0BBBBBBB2',
    gesperrt: false,
    erwartetWege: 1,
  },
  {
    id: 900003,
    name: 'zwei Ausgaben, Ja und Nein: Meldung zur Ja-Seite legt den Weg an',
    belege: ja(900003, 'B0CCCCCCC1') + nein(900003, 'B0CCCCCCC2'),
    meldung: 'B0CCCCCCC1',
    gesperrt: false,
    erwartetWege: 1,
  },
  {
    id: 900004,
    name: 'Nein als "nicht verfügbar" (available: false) zählt wie dub: false',
    belege: weg(900004, 'B0DDDDDDD1') + nein(900004, 'B0DDDDDDD2') + nein(900004, 'B0DDDDDDD3'),
    meldung: 'B0DDDDDDD1',
    gesperrt: true,
    erwartetWege: 0,
  },
  {
    id: 900005,
    name: 'Nein einer anderen Plattform mit derselben Adresse sperrt Prime nicht',
    belege: weg(900005, 'B0EEEEEEE1', 'disneyplus') + nein(900005, 'B0EEEEEEE2'),
    meldung: 'B0EEEEEEE1',
    gesperrt: false,
    erwartetWege: 1,
  },
  {
    id: 900007,
    name: 'Such-Verweis vorhanden, Meldung zu nicht-letzter Nein-Adresse: weder Adresse noch Häkchen (da-Zweig)',
    belege: nein(900007, 'B0GGGGGGG1') + nein(900007, 'B0GGGGGGG2') + nein(900007, 'B0GGGGGGG3'),
    meldung: 'B0GGGGGGG1',
    vorhanden: [suche('eins')],
    gesperrt: true,
    erwartetWege: 1,
  },
  {
    id: 900008,
    name: 'Verweis auf der verneinten Adresse vorhanden: die Meldung setzt kein Häkchen (da-Zweig, exakter Treffer)',
    belege: nein(900008, 'B0HHHHHHH1') + nein(900008, 'B0HHHHHHH2') + nein(900008, 'B0HHHHHHH3'),
    meldung: 'B0HHHHHHH1',
    vorhanden: [dp('B0HHHHHHH1')],
    gesperrt: true,
    erwartetWege: 1,
  },
  {
    id: 900009,
    name: 'Meldung von einer Suchadresse, deren ASIN zur verneinten Seite gehört (Seite ≠ Schlüssel)',
    belege: nein(900009, 'B0IIIIIII1') + nein(900009, 'B0IIIIIII2') + nein(900009, 'B0IIIIIII3'),
    meldung: 'B0IIIIIII1',
    schluessel: suche('zwei'),
    gesperrt: true,
    erwartetWege: 0,
  },
  {
    id: 900010,
    name: 'Nein ohne Adresse vor einem Ja, Meldung zu dritter Adresse: Weg wird angelegt (wie check:handbelege)',
    belege: beleg(900010, null, 'dub: false') + ja(900010, 'B0JJJJJJJ1'),
    meldung: 'B0JJJJJJJ2',
    gesperrt: false,
    erwartetWege: 1,
  },
  {
    id: 900015,
    name: 'Meldung ohne Seite (kein ASIN, Suchadresse als Schlüssel): der Such-Verweis bekommt sein Häkchen',
    belege: nein(900015, 'B0NNNNNNN1'),
    meldung: 'B0NNNNNNN9',
    schluessel: suche('drei'),
    ohneAsin: true,
    vorhanden: [suche('drei')],
    gesperrt: false,
    erwartetWege: 1,
    erwartetHaken: true,
  },
  {
    id: 900011,
    name: 'Handbeleg eines anderen Titels auf derselben Adresse (dp-Form, die Meldung baut gp): kein Weg',
    belege: weg(900012, 'B0KKKKKKK1'),
    meldung: 'B0KKKKKKK1',
    gesperrt: true,
    erwartetWege: 0,
  },
  {
    id: 900013,
    name: 'Handbeleg eines anderen Titels auf anderer Plattform an derselben Adresse: Weg wird angelegt',
    belege: weg(900014, 'B0LLLLLLL1', 'disneyplus'),
    meldung: 'B0LLLLLLL1',
    gesperrt: false,
    erwartetWege: 1,
  },
]

const fehler: string[] = []
try {
  schreibe('data/dub-confirmed.yaml', faelle.map((f) => f.belege).join(''))
  const zugeordnet: Record<string, unknown> = {}
  for (const f of faelle) {
    zugeordnet[`${f.schluessel ?? dp(f.meldung)}#0`] = {
      titleId: f.id,
      plattform: 'primevideo',
      asin: f.ohneAsin ? null : f.meldung,
      folgen: [{ unsere: 1, sprachen: ['Deutsch', 'Japanisch'] }],
    }
  }
  schreibe('data/prime-zugeordnet.json', JSON.stringify(zugeordnet))
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { loadDubChecks, dubKey } = await import('./lib/dub-confirmed.ts')
  const alleChecks = loadDubChecks()
  const titles = new Map<number, Title>(
    faelle.map((f) => [f.id, { id: f.id, slug: `nein-${f.id}`, streams: (f.vorhanden ?? []).map((url) => ({ platform: 'primevideo', url })) } as unknown as Title]),
  )
  uebernehmePrimeUndCrVorschlaege({
    titles,
    checks: new Map(alleChecks.map((c) => [dubKey(c.anilistId, c.platform), c])),
    alleChecks,
    lautPruefungTot: () => false,
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
    linkBefunde: {},
    checksJePlattform: new Map(),
    anisearch: {},
    belegFuer: () => undefined,
  })
  for (const f of faelle) {
    const wege = titles.get(f.id)!.streams.filter((s) => s.platform === 'primevideo')
    if (wege.length !== f.erwartetWege) fehler.push(`${f.name}: ${wege.length} Weg(e), erwartet ${f.erwartetWege}`)
    const beruehrt = wege.filter((s) => s.url.includes(f.meldung) && (s.dub === true || !f.vorhanden?.includes(s.url)))
    if (f.erwartetHaken !== undefined && wege.some((s) => s.dub === true) !== f.erwartetHaken) fehler.push(`${f.name}: Häkchen nicht wie erwartet`)
    if (f.gesperrt && beruehrt.length) fehler.push(`${f.name}: Adresse oder Häkchen trotz Sperre (${beruehrt.map((s) => s.url).join(', ')})`)
    if (f.gesperrt && f.vorhanden && wege.some((s) => !f.vorhanden?.includes(s.url))) fehler.push(`${f.name}: Verweis geändert`)
  }
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-nein-beleg:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prime-nein-beleg: ${faelle.length} Fälle ok.`)
