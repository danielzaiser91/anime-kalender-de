/**
 * Die Staffelsumme für die Meldungen einer Adresse (Aufrufer: `fetch-pruefungen.ts`, Regel: `staffelsumme.ts`).
 * Gilt nur für einen Titel von uns, dessen Anbieter-Liste nicht bei Staffel 1 beginnt; die Titel zur Bestätigung kommen aus den Meldungen
 * selbst (Notiz "Folge n: Titel") oder, wo Netflix keine meldet, aus RTL+ (`data/rtlplus-folgen.json`, Staffel und Folge).
 */
import type { AnbieterStaffel, Staffeleintrag } from './folgenbereiche.ts'
import { folgentitelAusNotiz } from './folgentitel-anker.ts'
import { folgenlisteVon } from './titel-bloecke.ts'
import { readJson } from './util.ts'
import { urteileStaffelsumme, type JwStaffel, type TitelMeldung, type Urteil } from './staffelsumme.ts'

interface GruppenMeldung {
  folge_nr: number | null
  staffel: number | null
  notiz: string | null
}

type RtlDatei = { titel?: Record<string, { videos?: { staffel: number; folge: number; titel: string }[] }> }

/** Die Titel der Anbieter-Staffel `erste` aus den Meldungen; fehlen sie, aus RTL+. */
function titelMeldungen(gruppe: GruppenMeldung[], erste: number, id: number): { liste: TitelMeldung[]; quelle: string } {
  const ausMeldung = gruppe
    .filter((m) => m.folge_nr != null && (m.staffel ?? erste) === erste)
    .map((m) => ({ pos: m.folge_nr as number, titel: folgentitelAusNotiz(m.notiz) }))
  if (ausMeldung.some((m) => m.titel)) return { liste: ausMeldung, quelle: 'Netflix-Meldung gegen unsere Liste' }
  const videos = readJson<RtlDatei>('data/rtlplus-folgen.json', {}).titel?.[String(id)]?.videos ?? []
  return { liste: videos.filter((v) => v.staffel === erste).map((v) => ({ pos: v.folge, titel: v.titel })), quelle: `RTL+ Staffel ${erste} gegen unsere Liste` }
}

/** `null`, wo die Regel nicht gilt (Liste beginnt bei 1, mehrere Titel an der Adresse, keine Folgenliste); sonst das Urteil. */
export function summeFuerGruppe(gruppe: GruppenMeldung[], anbieter: AnbieterStaffel[] | undefined, staffeln: Staffeleintrag[]): Urteil | null {
  if (!anbieter?.length || staffeln.length !== 1) return null
  const erste = Math.min(...anbieter.map((a) => a.seq))
  if (erste <= 1) return null
  const id = staffeln[0]!.id
  const liste = folgenlisteVon(id)
  if (!liste) return null
  const jw = readJson<Record<string, { staffeln?: JwStaffel[] }>>('data/justwatch-audio.json', {})[String(id)]?.staffeln ?? []
  const { liste: meldungen, quelle } = titelMeldungen(gruppe, erste, id)
  const blockFolgen = anbieter.reduce((n, a) => n + a.folgen, 0)
  return urteileStaffelsumme({ erste, jw, blockFolgen, meldungen, liste, quelle })
}

/** Unsere Nummer einer Meldung: Versatz plus Folgen der Anbieter-Staffeln davor plus Stelle in der eigenen Staffel. */
export function nummerUeberSumme(versatz: number, anbieter: AnbieterStaffel[], staffel: number | null, folge: number): number | null {
  const st = anbieter.find((a) => a.seq === staffel)
  if (!st) return null
  const davor = anbieter.filter((a) => a.seq < st.seq).reduce((n, a) => n + a.folgen, 0)
  return versatz + davor + (folge - st.erste + 1)
}

/** Was der Anbieter selbst über seine Staffeln meldet (jüngste Meldung der Gruppe mit Angabe); `undefined`, wo nichts oder Unlesbares steht. */
export function leseAnbieterStaffeln(gruppe: { staffeln?: string | null }[]): AnbieterStaffel[] | undefined {
  const roh = [...gruppe].reverse().find((x) => x.staffeln)?.staffeln
  if (!roh) return undefined
  try {
    const liste = JSON.parse(roh) as AnbieterStaffel[]
    return Array.isArray(liste) && liste.length ? liste : undefined
  } catch {
    return undefined
  }
}
