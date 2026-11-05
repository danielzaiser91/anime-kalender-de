/**
 * Zusicherung: **Kennt die Linkprüfung die Prime-Titelseite als tot, ersetzt sie keine Suchadresse und setzt auch kein `dub`** (05.11.2026).
 * Anlass: Fairy Tail (B0CHBX8CM2) verlor seine Suchadresse an eine tote Titelseite (`check:tote-adressen` rot). Fährt den Prime-Schritt der
 * Bauphase 9 gegen eine Kulisse (`AK_ROOT`); jeder Fall mit toter Seite hat eine Kontrolle ohne Prüfbefund. Läuft in `check:logic`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Title } from '../shared/types.ts'

const kulisse = mkdtempSync(join(tmpdir(), 'prime-suchadresse-tot-'))
process.env.AK_ROOT = kulisse
const gp = (asin: string) => `https://www.amazon.de/gp/video/detail/${asin}`
const SUCHE = 'https://www.amazon.de/s?k=Fairy+Tail&i=instant-video'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean, gefunden: unknown) => {
  if (!ok) fehler.push(`${name} — gefunden: ${JSON.stringify(gefunden)}`)
}

try {
  mkdirSync(join(kulisse, 'data/curated'), { recursive: true })
  writeFileSync(join(kulisse, 'data/dub-confirmed.yaml'), '[]\n')
  writeFileSync(join(kulisse, 'data/belege-entfernt.yaml'), '[]\n')
  const { uebernehmePrimeUndCrVorschlaege } = await import('./bau/09-3-prime.ts')
  const { amazonAdresseRichten } = await import('./lib/amazon-adresse.ts')
  const { loadDubChecks, dubKey } = await import('./lib/dub-confirmed.ts')
  const alleChecks = loadDubChecks()

  /** Drei Titel je Lauf: mit Suchadresse, mit schon vorhandener Titelseite, ohne Weg; die Seiten sind je Titel verschieden. */
  const FAELLE = [
    { id: 900031, asin: 'B0CHBX8CM2', streams: [{ platform: 'primevideo', url: SUCHE }] },
    { id: 900032, asin: 'B0TOTEDA01', streams: [{ platform: 'primevideo', url: gp('B0TOTEDA01') }] },
    { id: 900033, asin: 'B0TOTEOHN1', streams: [] },
  ]
  const lauf = (tot: (u: string) => boolean): Map<number, Title> => {
    const zugeordnet: Record<string, unknown> = {}
    for (const f of FAELLE) {
      zugeordnet[`${gp(f.asin)}#2`] = { titleId: f.id, plattform: 'primevideo', seite: f.asin, asin: f.asin, folgen: [{ unsere: 1, sprachen: ['Deutsch', 'Japanisch'] }] }
    }
    writeFileSync(join(kulisse, 'data/prime-zugeordnet.json'), JSON.stringify(zugeordnet))
    const titles = new Map<number, Title>(FAELLE.map((f) => [f.id, { id: f.id, slug: `tot-${f.id}`, streams: f.streams.map((s) => ({ ...s })) } as unknown as Title]))
    uebernehmePrimeUndCrVorschlaege({
      titles,
      checks: new Map(alleChecks.map((c) => [dubKey(c.anilistId, c.platform), c])),
      alleChecks,
      lautPruefungTot: tot,
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
    return titles
  }
  const streams = (t: Map<number, Title>, id: number) => t.get(id)!.streams.map((s) => ({ url: s.url, dub: s.dub }))
  const seite = (asin: string) => amazonAdresseRichten(gp(asin))
  const istTot = (u: string) => FAELLE.some((f) => u === seite(f.asin))

  const tot = lauf(istTot)
  pruefe('tote Titelseite: Suchadresse bleibt, kein dub', JSON.stringify(streams(tot, 900031)) === JSON.stringify([{ url: SUCHE }]), streams(tot, 900031))
  pruefe('tote Titelseite schon als Weg: dub wird nicht gesetzt', streams(tot, 900032).length === 1 && streams(tot, 900032)[0]!.dub === undefined, streams(tot, 900032))
  pruefe('tote Titelseite ohne Weg: kein Weg angelegt', streams(tot, 900033).length === 0, streams(tot, 900033))

  const lebt = lauf(() => false)
  pruefe('Kontrolle: ohne Prüfbefund ersetzt die Titelseite die Suchadresse', streams(lebt, 900031)[0]?.url === seite('B0CHBX8CM2') && streams(lebt, 900031)[0]?.dub === true, streams(lebt, 900031))
  pruefe('Kontrolle: ohne Prüfbefund bekommt der vorhandene Weg dub', streams(lebt, 900032)[0]?.dub === true, streams(lebt, 900032))
  pruefe('Kontrolle: ohne Prüfbefund legt die Meldung den Weg an', streams(lebt, 900033).length === 1, streams(lebt, 900033))
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-prime-suchadresse-tot:\n  ${fehler.join('\n  ')}`)
  process.exit(1)
}
console.log('check-prime-suchadresse-tot: 6 Fälle ok.')
