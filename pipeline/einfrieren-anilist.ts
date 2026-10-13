/**
 * Friert die Stammdaten der Katalog-Titel ein, die nur AniList kennt (Liste: `keiner` in `data/anisearch-katalog-abgleich.json`).
 *
 * Einmal-Werkzeug (11.10.2026): holt jede Kennung in Blöcken zu 50 über die bestehenden Abrufe (`katalogSeite` mit Kennungen,
 * `mediaByIds`) und schreibt `data/stammdaten/anilist-eingefroren.json`. Danach liest der Bau die Titel aus dieser Datei
 * (`lib/katalog-eingefroren.ts`) und ruft AniList für sie nicht mehr ab. Die Datei wird gepflegt, nicht neu erzeugt:
 * ohne `--neu` bricht das Skript ab, wenn sie schon da ist.
 *
 * Aufruf: tsx pipeline/einfrieren-anilist.ts [--neu]
 */
import { type AniListMedia, katalogSeite, mediaByIds } from './lib/anilist.ts'
import { ABGLEICH_LISTE, EINGEFROREN_DATEI, type EingefrorenerBestand, type EingefrorenerEintrag, ladeEingefrorene, ladeKeinerIds } from './lib/katalog-eingefroren.ts'
import { log, warn, writeText } from './lib/util.ts'

type Datum = AniListMedia['startDate'] | undefined
type Kopf = Omit<EingefrorenerBestand, 'eintraege'>

/** „2008", „2008-03" oder „2008-03-31" — so genau, wie AniList es belegt. */
export function datumText(d: Datum): string | undefined {
  if (!d?.year) return undefined
  return [d.year, d.month, d.day].filter(Boolean).map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-')
}

/** Die Felder, die der Katalog nicht führt, aus dem vollen Media-Eintrag. */
export function zusatzfelder(m: AniListMedia): Pick<EingefrorenerEintrag, 'dauer' | 'ende' | 'saison' | 'herkunftsland'> {
  return {
    ...(m.duration ? { dauer: m.duration } : {}),
    ...(datumText(m.endDate) ? { ende: datumText(m.endDate) } : {}),
    ...(m.season ? { saison: m.season } : {}),
    ...(m.countryOfOrigin ? { herkunftsland: m.countryOfOrigin } : {}),
  }
}

async function holeKatalogEintraege(ids: number[]): Promise<Map<number, EingefrorenerEintrag>> {
  const aus = new Map<number, EingefrorenerEintrag>()
  for (let ab = 0; ab < ids.length; ab += 50) {
    const { eintraege } = await katalogSeite(1, undefined, undefined, false, true, ids.slice(ab, ab + 50))
    for (const e of eintraege) aus.set(e.id, e)
    if ((ab / 50) % 10 === 0) log(`  Katalogfelder: ${aus.size} von ${ids.length}`)
  }
  return aus
}

function eintragMitZusatz(e: EingefrorenerEintrag, m: AniListMedia | undefined): EingefrorenerEintrag {
  return m ? { ...e, ...zusatzfelder(m) } : e
}

function schreibe(eintraege: EingefrorenerEintrag[], kopf: Kopf): void {
  const kopfText = JSON.stringify(kopf).slice(0, -1)
  const zeilen = eintraege.map((e) => JSON.stringify(e)).join(',\n')
  writeText(EINGEFROREN_DATEI, `${kopfText},"eintraege":[\n${zeilen}\n]}\n`)
}

/** Holt Katalog und Zusatzfelder zu den Kennungen; meldet, was nicht zurückkam. */
async function holeEintraege(ids: number[]): Promise<EingefrorenerEintrag[]> {
  const katalog = await holeKatalogEintraege(ids)
  const medien = await mediaByIds([...katalog.keys()])
  const fehlt = ids.filter((id) => !katalog.has(id))
  if (fehlt.length) warn(`${fehlt.length} Kennungen kamen nicht zurück: ${fehlt.join(', ')}`)
  const ohneMedium = [...katalog.keys()].filter((id) => !medien.has(id))
  if (ohneMedium.length) warn(`${ohneMedium.length} ohne Zusatzfelder: ${ohneMedium.join(', ')}`)
  return [...katalog.values()].map((e) => eintragMitZusatz(e, medien.get(e.id)))
}

async function main(): Promise<void> {
  if (ladeEingefrorene().length && !process.argv.includes('--neu')) {
    return warn(`${EINGEFROREN_DATEI} gibt es schon - eingefroren heißt: nicht neu holen (--neu erzwingt es)`)
  }
  const ids = ladeKeinerIds()
  if (!ids.length) return warn(`${ABGLEICH_LISTE} nennt keine Titel`)
  log(`${ids.length} Kennungen`)
  const eintraege = await holeEintraege(ids)
  const kopf: Kopf = {
    eingefrorenAm: new Date().toISOString(),
    quelle: 'AniList (graphql.anilist.co), ein letzter Abruf; Liste: keiner in data/anisearch-katalog-abgleich.json',
  }
  schreibe(eintraege.sort((a, b) => a.id - b.id), kopf)
  log(`Eingefroren: ${eintraege.length} von ${ids.length} -> ${EINGEFROREN_DATEI}`)
}

await main()
