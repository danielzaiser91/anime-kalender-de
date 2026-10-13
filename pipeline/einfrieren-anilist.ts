/**
 * Friert die Stammdaten der Katalog-Titel ein, die nur AniList kennt (Liste: `keiner` in `data/anisearch-katalog-abgleich.json`).
 *
 * Einmal-Werkzeug (11.10.2026): holt jede Kennung in Blöcken zu 50 über die bestehenden Abrufe (`katalogSeite` mit Kennungen,
 * `mediaByIds`) und schreibt `data/stammdaten/anilist-eingefroren.json`. Danach liest der Bau die Titel aus dieser Datei
 * (`lib/katalog-eingefroren.ts`) und ruft AniList für sie nicht mehr ab. Die Datei wird gepflegt, nicht neu erzeugt:
 * ohne `--neu` bricht das Skript ab, wenn sie schon da ist.
 * `--nachtragen` ergänzt Kennungen aus `keiner`, die noch fehlen (Cache zuerst, Rest per Abruf), und lässt vorhandene Einträge unverändert.
 *
 * Aufruf: tsx pipeline/einfrieren-anilist.ts [--neu | --nachtragen]
 */
import { type AniListMedia, katalogEintragAus, katalogSeite, mediaByIds } from './lib/anilist.ts'
import {
  ABGLEICH_LISTE,
  EINGEFROREN_DATEI,
  type EingefrorenerBestand,
  type EingefrorenerEintrag,
  ladeEingefrorene,
  ladeKatalogEintraege,
  ladeKeinerIds,
  nichtEingefroren,
} from './lib/katalog-eingefroren.ts'
import { log, readJson, warn, writeText } from './lib/util.ts'

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

/** Katalogeinträge für Kennungen: erst aus dem Cache (dort steht, was der Bau zuletzt sah), nur der Rest wird abgerufen. */
async function katalogZu(ids: number[]): Promise<Map<number, EingefrorenerEintrag>> {
  const imCache = new Map(ladeKatalogEintraege().map((e) => [e.id, e as EingefrorenerEintrag]))
  const aus = new Map<number, EingefrorenerEintrag>()
  for (const id of ids) if (imCache.has(id)) aus.set(id, imCache.get(id)!)
  const rest = ids.filter((id) => !aus.has(id))
  log(`${aus.size} aus dem Cache, ${rest.length} werden abgerufen`)
  if (rest.length) for (const [id, e] of await holeKatalogEintraege(rest)) aus.set(id, e)
  return aus
}

/** Holt Katalog und Zusatzfelder zu den Kennungen; meldet, was nicht zurückkam. */
async function holeEintraege(ids: number[], katalog: (ids: number[]) => Promise<Map<number, EingefrorenerEintrag>>): Promise<EingefrorenerEintrag[]> {
  const eintraege = await katalog(ids)
  const medien = await mediaByIds(ids)
  /* Formate außerhalb des Katalogs (z. B. MUSIC) liefert `katalogSeite` nie; der Hauptbestand führt sie trotzdem (Ookami Heart). */
  const nurMedium = ids.filter((id) => !eintraege.has(id) && medien.has(id))
  if (nurMedium.length) log(`${nurMedium.length} ohne Katalogabruf, Eintrag aus dem Medium: ${nurMedium.join(', ')}`)
  for (const id of nurMedium) eintraege.set(id, katalogEintragAus(medien.get(id)!))
  const fehlt = ids.filter((id) => !eintraege.has(id))
  if (fehlt.length) warn(`${fehlt.length} Kennungen kamen nicht zurück: ${fehlt.join(', ')}`)
  const ohneMedium = [...eintraege.keys()].filter((id) => !medien.has(id))
  if (ohneMedium.length) warn(`${ohneMedium.length} ohne Zusatzfelder: ${ohneMedium.join(', ')}`)
  return [...eintraege.values()].map((e) => eintragMitZusatz(e, medien.get(e.id)))
}

/** Trägt Kennungen aus `keiner` nach, die fehlen; vorhandene Einträge werden unverändert wieder geschrieben. */
async function nachtragen(): Promise<void> {
  const vorhanden = ladeEingefrorene()
  const fehlt = nichtEingefroren(ladeKeinerIds(), vorhanden)
  if (!fehlt.length) return log('Nichts nachzutragen: alle Kennungen aus keiner sind eingefroren')
  log(`${fehlt.length} Kennungen fehlen`)
  const neu = await holeEintraege(fehlt, katalogZu)
  const { eintraege: _alt, ...kopf } = readJson<EingefrorenerBestand>(EINGEFROREN_DATEI, {} as EingefrorenerBestand)
  schreibe([...vorhanden, ...neu].sort((a, b) => a.id - b.id), { ...kopf, nachgetragenAm: new Date().toISOString() })
  log(`Nachgetragen: ${neu.length} von ${fehlt.length}; jetzt ${vorhanden.length + neu.length} Einträge in ${EINGEFROREN_DATEI}`)
}

async function main(): Promise<void> {
  if (process.argv.includes('--nachtragen')) return nachtragen()
  if (ladeEingefrorene().length && !process.argv.includes('--neu')) {
    return warn(`${EINGEFROREN_DATEI} gibt es schon - eingefroren heißt: nicht neu holen (--nachtragen ergänzt fehlende Kennungen, --neu erzwingt alles)`)
  }
  const ids = ladeKeinerIds()
  if (!ids.length) return warn(`${ABGLEICH_LISTE} nennt keine Titel`)
  log(`${ids.length} Kennungen`)
  const eintraege = await holeEintraege(ids, holeKatalogEintraege)
  const kopf: Kopf = {
    eingefrorenAm: new Date().toISOString(),
    quelle: 'AniList (graphql.anilist.co), ein letzter Abruf; Liste: keiner in data/anisearch-katalog-abgleich.json',
  }
  schreibe(eintraege.sort((a, b) => a.id - b.id), kopf)
  log(`Eingefroren: ${eintraege.length} von ${ids.length} -> ${EINGEFROREN_DATEI}`)
}

await main()
