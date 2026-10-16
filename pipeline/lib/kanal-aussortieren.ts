/**
 * Offene Rohfolgen-Gruppen einer Kanal-Seite ohne Deutsch werden aus der offenen Liste genommen (16.10.2026).
 *
 * Anlass: Yu-Gi-Oh! 5D's, Crunchyroll-Kanal, 64 Folgen nur ja/en; Deutsch liegt bei drei anderen Adressen des Titels. Der Zuordner
 * ordnet die Gruppe nicht zu und hakt sie nie ab, sie käme bei jedem Lauf wieder. Aussortiert wird nur, wenn alle drei gelten:
 *  (a) keine Folge der Gruppe nennt Deutsch,
 *  (b) die Gruppe nennt genau eine `seiten_kennung`, und ein Kanal-Beleg desselben Titels nennt genau diese Seite (`Amazon-Seite <ASIN>`),
 *  (c) der Titel hat eine andere Adresse mit Deutsch (Handbeleg oder zugeordnete Rohfolgen).
 * Sonst bleibt die Gruppe offen. Verschoben, nicht gelöscht: `data/prime-kanal-aussortiert.json` hält die Zeilen (sie sind im Briefkasten
 * abgehakt) und die Adresse mit Deutsch, damit ein Mensch nachsehen kann.
 */
import { amazonTitelAdresse } from './amazon-adresse.ts'
import { adressKern, type DubCheck } from './dub-confirmed.ts'
import { istKanalTitel, notizSeite, rohDeutsch } from './kanal-titel.ts'
import { readJson, writeJson } from './util.ts'

export interface KanalZeile {
  id: number
  url: string
  nummer: number | null
  titel: string | null
  sprachen: string | null
  seiten_kennung?: string | null
}

/** Die zugeordneten Rohfolgen, soweit (c) sie braucht. */
export type ZugeordneteSeiten = Record<string, { titleId: number; seite?: string | null; plattform: string; folgen: { sprachen: string[] }[] }>

export interface KanalAussortiert {
  titleId: number
  url: string
  seite: string
  /** Eine andere Adresse desselben Titels, auf der Deutsch belegt ist. */
  andereAdresse: string
  folgen: Pick<KanalZeile, 'id' | 'nummer' | 'titel' | 'sprachen'>[]
}

export const KANAL_AUSSORTIERT = 'data/prime-kanal-aussortiert.json'

const nenntDeutsch = (z: KanalZeile): boolean => (JSON.parse(z.sprachen ?? '[]') as string[]).some((s) => s.includes('Deutsch'))

/** Die eine gelesene Seite der Gruppe; null, wenn die Zeilen mehrere nennen (leer, wenn keine eine nennt). */
function einzigeSeite(liste: KanalZeile[]): string | null {
  const seiten = new Set(liste.map((z) => z.seiten_kennung ?? ''))
  return seiten.size === 1 ? [...seiten][0]! : null
}

/** Der Titel, dessen Kanal-Beleg genau diese Seite nennt; undefined bei keinem oder mehreren Titeln. */
function kanalTitelDerSeite(seite: string, handbelege: DubCheck[]): number | undefined {
  const kern = adressKern(amazonTitelAdresse(seite))
  const ids = new Set(handbelege.filter((c) => istKanalTitel(c) && notizSeite(c) && adressKern(amazonTitelAdresse(notizSeite(c)!)) === kern).map((c) => c.anilistId))
  return ids.size === 1 ? [...ids][0] : undefined
}

/** Eine andere Prime-Adresse desselben Titels mit belegtem Deutsch: Handbeleg mit Ja, sonst zugeordnete Rohfolgen mit Deutsch (nicht selbst Kanal). */
function andereDeutscheAdresse(titleId: number, seite: string, handbelege: DubCheck[], zugeordnet: ZugeordneteSeiten): string | undefined {
  const kern = adressKern(amazonTitelAdresse(seite))
  const beleg = handbelege.find((c) => c.anilistId === titleId && c.platform === 'primevideo' && c.dub === true && c.url && adressKern(c.url) !== kern)
  if (beleg) return beleg.url
  for (const [schluessel, z] of Object.entries(zugeordnet)) {
    if (z.titleId !== titleId || z.plattform !== 'primevideo') continue
    const url = schluessel.split('#')[0]!
    const seiteDort = z.seite ? amazonTitelAdresse(z.seite) : url
    if (adressKern(seiteDort) !== kern && rohDeutsch(z.folgen, titleId, { seite: z.seite, url }, handbelege) === true) return seiteDort
  }
  return undefined
}

/** Welche der offenen Gruppen sind Kanal-Gruppen ohne Deutsch, deren Titel anderswo Deutsch hat? Reine Auswahl, schreibt nichts. */
export function sortiereKanalGruppenAus(offeneGruppen: KanalZeile[][], handbelege: DubCheck[], zugeordnet: ZugeordneteSeiten): KanalAussortiert[] {
  const aussortiert: KanalAussortiert[] = []
  for (const liste of offeneGruppen) {
    if (liste.some(nenntDeutsch)) continue
    const seite = einzigeSeite(liste)
    if (!seite) continue
    const titleId = kanalTitelDerSeite(seite, handbelege)
    if (titleId === undefined) continue
    const andereAdresse = andereDeutscheAdresse(titleId, seite, handbelege, zugeordnet)
    if (!andereAdresse) continue
    aussortiert.push({ titleId, url: liste[0]!.url, seite, andereAdresse, folgen: liste.map(({ id, nummer, titel, sprachen }) => ({ id, nummer, titel, sprachen })) })
  }
  return aussortiert
}

/**
 * Nimmt die Gruppen aus `offen` (je Gruppe ein Eintrag mit gleicher Adresse und Folgenzahl), führt sie in der Datei mit den früheren zusammen
 * und gibt die Ids der Zeilen zurück, die der Briefkasten abhaken darf.
 */
export function verschiebeKanalGruppen(aussortiert: KanalAussortiert[], offen: { url: string; folgen: number }[]): number[] {
  if (!aussortiert.length) return []
  for (const a of aussortiert) {
    const i = offen.findIndex((o) => o.url === a.url && o.folgen === a.folgen.length)
    if (i >= 0) offen.splice(i, 1)
  }
  const bisher = readJson<Record<string, KanalAussortiert>>(KANAL_AUSSORTIERT, {})
  writeJson(KANAL_AUSSORTIERT, { ...bisher, ...Object.fromEntries(aussortiert.map((a) => [`${a.url}#${a.seite}#${a.folgen[0]!.id}`, a])) }, true)
  return aussortiert.flatMap((a) => a.folgen.map((f) => f.id))
}
