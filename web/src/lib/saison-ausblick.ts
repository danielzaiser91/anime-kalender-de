import type { Release, Title } from '@shared/types.ts'
import { istSerie, saisonVon, saisonZeitraum, type SaisonTag } from '@shared/saison.ts'
import { ersterTermin, hatDeutsch, stufeVon, type SaisonDatei, type SaisonKatalogTitel, type SaisonZeile } from './saison.ts'

/** Eine Gruppe des Ausblicks: eine Saison, ein Jahr ohne bekannte Saison oder „ohne Termin". */
export interface AusblickGruppe {
  schluessel: string
  saison?: SaisonTag
  jahr?: number
  zeilen: SaisonZeile[]
}

/** Die Rangfolge innerhalb einer Gruppe: erst der genaue Tag, dann der Monat, dann Saison und Jahr. */
const GENAU_RANG = { tag: 0, monat: 1, saison: 2, jahr: 3 } as const

/** Wie genau ein Japan-Start bekannt ist; die Gruppe sagt Saison und Jahr, die Karte nur, was darüber hinausgeht. */
function genauigkeit(jpStart: string | undefined): SaisonZeile['genau'] {
  return jpStart?.length === 10 ? 'tag' : jpStart?.length === 7 ? 'monat' : 'jahr'
}

const sortSchluessel = (z: SaisonZeile): string => `${GENAU_RANG[z.genau ?? 'jahr']}${z.jp ?? ''}`

/**
 * **Der Ausblick** (Daniel, 09.10.2026): alle Serien, die nach der laufenden Saison starten, nach Saison geordnet — Japan-Start so genau, wie wir ihn kennen
 * (Tag, Monat, Saison, Jahr), deutscher Termin nur, wo einer belegt oder angekündigt ist. Nichts fällt weg: Titel ohne Saison stehen unter ihrem Jahr,
 * Titel ohne jedes Datum in der letzten Gruppe. Quellen: Titel des Hauptbestands (`titles`), `saison.json` (`datei`) und `saison-ausblick.json` (`ausblick`).
 */
export function ausblickGruppen(
  titles: Title[],
  releasesByTitle: Map<number, Release[]>,
  datei: SaisonDatei | undefined,
  ausblick: SaisonKatalogTitel[] | undefined,
  heute: string,
): AusblickGruppe[] {
  const jetzt = saisonVon(heute)
  const nach = saisonZeitraum(jetzt)[1]
  const saisonen = new Map<string, AusblickGruppe>()
  const jahre = new Map<number, AusblickGruppe>()
  const ohne: AusblickGruppe = { schluessel: 'ohne', zeilen: [] }
  /* Eine Saison bis zur laufenden gehört zu „Aktuelle“ und „Letzte“ und steht deshalb nicht im Ausblick. */
  const ablegen = (z: SaisonZeile, saison: SaisonTag | undefined, jahr: number | undefined) => {
    if (saison && saisonZeitraum(saison)[0] > nach) {
      const schluessel = saisonZeitraum(saison)[0]
      if (!saisonen.has(schluessel)) saisonen.set(schluessel, { schluessel, saison, zeilen: [] })
      saisonen.get(schluessel)!.zeilen.push(z)
    } else if (!saison && jahr !== undefined) {
      if (!jahre.has(jahr)) jahre.set(jahr, { schluessel: String(jahr), jahr, zeilen: [] })
      jahre.get(jahr)!.zeilen.push(z)
    } else if (!saison && jahr === undefined) ohne.zeilen.push(z)
  }
  const bekannt = new Set<number>()
  for (const t of titles) {
    if (!istSerie(t.format) || !t.jpYear) continue
    const saison = t.jpSeason ? ({ jahr: t.jpYear, saison: t.jpSeason } as SaisonTag) : undefined
    if (saison ? saisonZeitraum(saison)[0] <= nach : t.jpYear <= jetzt.jahr) continue
    const termin = ersterTermin(releasesByTitle.get(t.id))
    bekannt.add(t.id)
    const jp = datei?.jp[String(t.id)]
    ablegen({ id: t.id, titel: t, deutsch: hatDeutsch(t), stufe: stufeVon(t, termin, heute), erschienen: false, jp, genau: jp ? 'tag' : saison ? 'saison' : 'jahr', de: termin?.datum, geschaetzt: termin?.geschaetzt }, saison, t.jpYear)
  }
  for (const k of [...(datei?.katalog ?? []), ...(ausblick ?? [])]) {
    if (bekannt.has(k.id)) continue
    bekannt.add(k.id)
    const zeile: SaisonZeile = { id: k.id, katalog: k, deutsch: false, stufe: k.angekuendigt ? 'angekuendigt' : 'offen', erschienen: false, jp: k.jpStart, genau: genauigkeit(k.jpStart) }
    if (k.jpSeason && k.jpYear) ablegen(zeile, { jahr: k.jpYear, saison: k.jpSeason as SaisonTag['saison'] }, k.jpYear)
    else if (!k.jpStart) ablegen(zeile, undefined, undefined)
    else if (k.jpStart.length === 4) ablegen(zeile, undefined, Number(k.jpStart))
    else ablegen(zeile, saisonVon(k.jpStart.length === 7 ? `${k.jpStart}-01` : k.jpStart), undefined)
  }
  const reihe = (g: AusblickGruppe): AusblickGruppe => ({ ...g, zeilen: g.zeilen.sort((a, b) => sortSchluessel(a).localeCompare(sortSchluessel(b)) || a.id - b.id) })
  const nachSchluessel = (a: AusblickGruppe, b: AusblickGruppe) => a.schluessel.localeCompare(b.schluessel)
  return [...[...saisonen.values()].sort(nachSchluessel), ...[...jahre.values()].sort(nachSchluessel), ...(ohne.zeilen.length > 0 ? [ohne] : [])].map(reihe)
}
