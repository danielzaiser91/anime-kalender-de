import { log, readJson, writeJson } from '../lib/util.ts'
import { todayIso } from '../../shared/time.ts'
import { ANISEARCH_ID_BASIS, alle as anisearchEintraege } from './anisearch-titel.ts'

/**
 * **Was je Titel fehlt** (Daniel, 10.10.2026: „Titel mit fehlenden Infos im Blick behalten und regelmäßig befüllen"). Der Bau schreibt `data/luecken-titel.json` aus der
 * fertigen Ausgabe; ein Titel verlässt die Liste, sobald das Feld gefüllt ist. Den täglichen Auffüll-Lauf, der aus ihr Quellen abfragt, gibt es noch nicht.
 *
 * Gelistet ist ein Feld nur, wenn es in der ausgelieferten Datei fehlt: deutscher Titel (`t`), Jahr (`j`), Cover (`c`), MAL-Kennung (`m`), Beschreibung (`b`). Ein deutscher Titel
 * fehlt oft zu Recht (keine deutsche Fassung); die Liste sagt, was fehlt, nicht, was eine Quelle kennt.
 */
export const LUECKEN = 'data/luecken-titel.json'
const FELDER = { t: 'titleDe', j: 'jahr', c: 'cover', m: 'mal', b: 'beschreibung' } as const
type Kuerzel = keyof typeof FELDER
type Klasse = 'hb' | 'kat' | 'zeilen'
type Titel = { id: number; titleDe?: string; jpYear?: number | null; coverImage?: string; malId?: number }
type Beschreibungen = Record<number, { de?: string; en?: string }>

/**
 * Die Kürzel der Felder, die dem Titel fehlen; bei einer aniSearch-Zeile zählt die MAL-Kennung des Eintrags (die Zeile selbst trägt keine).
 * Beschreibungen gibt es nur für den Hauptbestand (`beschreibungen`); der Katalog trägt bewusst keine, sonst stünde fast jeder Katalogtitel auf der Liste.
 */
export function fehlendes(t: Titel, beschreibungen: Beschreibungen | undefined, malDerZeile: number | undefined): string {
  const zeile = t.id >= ANISEARCH_ID_BASIS
  const fehlt: Record<Kuerzel, boolean> = {
    t: !t.titleDe,
    j: !t.jpYear,
    c: !t.coverImage,
    m: !(zeile ? malDerZeile : t.malId),
    b: beschreibungen !== undefined && !(beschreibungen[t.id]?.de || beschreibungen[t.id]?.en),
  }
  return (Object.keys(fehlt) as Kuerzel[]).filter((k) => fehlt[k]).join('')
}

type Liste = Record<Klasse, Record<number, string>>

function sammle(hauptbestand: Titel[], katalog: Titel[], beschreibungen: Beschreibungen): Liste {
  const eintraege = anisearchEintraege()
  const liste: Liste = { hb: {}, kat: {}, zeilen: {} }
  const aufnehmen = (t: Titel, klasse: Klasse) => {
    const fehlt = fehlendes(t, klasse === 'hb' ? beschreibungen : undefined, eintraege[String(t.id - ANISEARCH_ID_BASIS)]?.mal)
    if (fehlt) liste[klasse][t.id] = fehlt
  }
  const imHaupt = new Set(hauptbestand.map((t) => t.id))
  for (const t of hauptbestand) aufnehmen(t, 'hb')
  for (const t of katalog) if (!imHaupt.has(t.id)) aufnehmen(t, t.id >= ANISEARCH_ID_BASIS ? 'zeilen' : 'kat')
  return liste
}

/** Schreibt die Liste nur bei Änderung, damit der Stand nicht täglich committet wird. */
export function schreibeLueckenTitel(hauptbestand: Titel[], beschreibungen: Beschreibungen): void {
  const katalog = readJson<Titel[]>('public/data/ohne-synchro.json', [])
  const titel = sammle(hauptbestand, katalog, beschreibungen)
  const zaehler = Object.fromEntries((Object.keys(titel) as Klasse[]).map((klasse) => {
    const eintraege = Object.values(titel[klasse])
    return [klasse, { mit: eintraege.length, ...Object.fromEntries((Object.keys(FELDER) as Kuerzel[]).map((k) => [FELDER[k], eintraege.filter((f) => f.includes(k)).length])) }]
  }))
  const alt = readJson<{ titel?: unknown }>(LUECKEN, {})
  if (JSON.stringify(alt.titel) !== JSON.stringify(titel)) {
    writeJson(LUECKEN, { stand: todayIso(), legende: FELDER, zaehler, titel })
  }
  log(`Lücken: ${JSON.stringify(zaehler)} — Liste: ${LUECKEN}`)
}
