import { adressKern } from './dub-confirmed.ts'
import { amazonTitelAdresse } from './amazon-adresse.ts'

/**
 * **Geteilte Prime-Seiten: der Folgenbereich je Titel aus Daniels Meldungen.**
 *
 * Mehrere unserer Titel zeigen auf dieselbe Prime-Seite (Food Wars 24 + 13, Danganronpa 3 mit drei Teilen). `data/prime-zugeordnet.json`
 * trägt je gemeldeter Folgengruppe schon unsere Zählung: `fetch-rohfolgen.ts` legt die Folgen über die Folgentitel und Daten **dieses**
 * Titels, `unsere` zählt also in seiner Staffel ab 1, nicht in der Liste der Seite. Hier wird nur gelesen, was deutsch gemeldet ist,
 * und nur übernommen, wo die Zuordnung nichts offen lässt. Alles andere steht mit Grund auf der Prüfliste, nichts wird geraten.
 */
export interface PrimeMeldung {
  titleId: number
  /** ASIN der ersten Folge der gemeldeten Gruppe — dieselbe Gruppe unter zwei Titeln ist ein Widerspruch. */
  asin: string | null
  /** Kennung der Seite, auf der gemeldet wurde (seit Migration 030); sie schlägt die Adresse der Ablage. */
  seite?: string | null
  plattform: string
  folgen: { unsere: number | null; sprachen: string[] }[]
}

export interface PrimeBereich {
  from: number
  to: number
  dub: true
}

export type PrimeUrteil = { bereiche: PrimeBereich[] } | { grund: string }

/** Adressenkern der Seite, auf der gemeldet wurde. */
function meldungsSeite(schluessel: string, m: PrimeMeldung): string {
  return adressKern(m.seite ? amazonTitelAdresse(m.seite) : schluessel.split('#')[0])
}

function bereicheAus(nummern: number[]): PrimeBereich[] {
  const bereiche: PrimeBereich[] = []
  for (const n of [...nummern].sort((a, b) => a - b)) {
    const letzter = bereiche[bereiche.length - 1]
    if (letzter && letzter.to === n - 1) letzter.to = n
    else bereiche.push({ from: n, to: n, dub: true })
  }
  return bereiche
}

/** Urteil über eine einzelne Meldung: Bereiche der deutschen Folgen oder der Grund, warum sie nicht trägt. */
function urteilEinerMeldung(m: PrimeMeldung, episodes: number): PrimeUrteil {
  const deutsch = m.folgen.filter((f) => f.sprachen.includes('Deutsch'))
  if (!deutsch.length) return { grund: 'in der Meldung ist keine Folge deutsch' }
  if (!episodes) return { grund: 'Folgenzahl des Titels unbekannt' }
  const ohne = deutsch.filter((f) => f.unsere === null).length
  if (ohne) return { grund: `${ohne} deutsche Folge(n) der Meldung ohne Zuordnung zu unserer Zählung` }
  const alle = m.folgen.flatMap((f) => (f.unsere === null ? [] : [f.unsere]))
  if (new Set(alle).size !== alle.length) return { grund: 'eine unserer Folgennummern ist in der Meldung doppelt vergeben' }
  const draussen = alle.filter((n) => !Number.isInteger(n) || n < 1 || n > episodes)
  if (draussen.length) return { grund: `Folgennummer ${draussen[0]} liegt außerhalb 1–${episodes}` }
  return { bereiche: bereicheAus(deutsch.map((f) => f.unsere as number)) }
}

/** Grund, wenn der Titel nur von einer anderen Seite gemeldet ist (Ablage-Adresse gleich, gemeldete Seite eine andere Staffelseite). */
function keineMeldungHier(t: { id: number }, meldungen: [string, PrimeMeldung][], seite: string): PrimeUrteil {
  const anderswo = meldungen.find(([k, m]) => m.plattform === 'primevideo' && m.titleId === t.id && adressKern(k.split('#')[0]) === seite)
  return { grund: anderswo ? `Meldung kam von einer anderen Seite (${anderswo[1].seite}), die Zuordnung zu dieser ist ungeklärt` : 'keine Meldung zu diesem Titel auf dieser Seite' }
}

/**
 * Je Titel auf einer geteilten Prime-Seite: Bereich oder Grund. Eindeutig heißt: genau eine Meldung des Titels zu dieser Seite,
 * jede deutsche Folge darin hat eine Nummer in 1 bis Folgenzahl, keine Nummer doppelt, und die Folgengruppe ist keinem anderen
 * Titel derselben Seite gemeldet worden. Ein Kanal-Titel (`kanal`) ist ausgenommen: Amazon zeigt dort die Sprachen des Kanals,
 * nicht die der einzelnen Folge, die Meldung belegt keine Folge.
 */
export function ordnePrimeSeiteZu(
  titel: { id: number; episodes: number }[],
  meldungen: [string, PrimeMeldung][],
  seite: string,
  kanal: boolean,
): Map<number, PrimeUrteil> {
  const hier = meldungen.filter(([k, m]) => m.plattform === 'primevideo' && meldungsSeite(k, m) === seite)
  const urteile = new Map<number, PrimeUrteil>()
  for (const t of titel) {
    if (kanal) {
      urteile.set(t.id, { grund: 'Kanal-Titel: Amazon zeigt die Sprachen des Kanals, die Meldung belegt keine einzelne Folge' })
      continue
    }
    const eigene = hier.filter(([, m]) => m.titleId === t.id)
    if (!eigene.length) {
      urteile.set(t.id, keineMeldungHier(t, meldungen, seite))
      continue
    }
    if (eigene.length > 1) {
      urteile.set(t.id, { grund: `${eigene.length} Meldungen des Titels zu dieser Seite, welche gilt, ist offen` })
      continue
    }
    const m = eigene[0]![1]
    const fremd = m.asin ? hier.find(([, o]) => o.titleId !== t.id && o.asin === m.asin) : undefined
    urteile.set(
      t.id,
      fremd ? { grund: `dieselbe Folgengruppe (${m.asin}) ist auch Titel ${fremd[1].titleId} gemeldet` } : urteilEinerMeldung(m, t.episodes),
    )
  }
  return urteile
}
