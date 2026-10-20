import type { FranchiseMember } from '@shared/types.ts'
import { eindeutschenStaffel } from '@shared/titles.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { kurzName } from './reihen-regeln.ts'

/**
 * Künftig ist, was noch nicht erschienen ist: AniList sagt es selbst (`NOT_YET_RELEASED`, 2027 bei „Lord of the Mysteries 2“).
 * Der Jahresvergleich ist nur der Rückfall für Einträge ohne Status und irrt am Jahreswechsel; ein Teil ohne Synchro, der dieses Jahr anfängt,
 * zählt ebenfalls dazu („Staffel 3 — Teil 1“ beginnt am 02.10.2026 und stand mit `jpYear > jahr` bei den erschienenen).
 */
export function kuenftig(m: FranchiseMember, jahr: number): boolean {
  return (
    m.jpStatus === 'NOT_YET_RELEASED' ||
    (m.jpStatus !== 'FINISHED' && ((m.jpYear ?? 0) > jahr || (Boolean(m.ohneSynchro) && (m.jpYear ?? 0) >= jahr)))
  )
}

/**
 * Der unterscheidende Teil des Namens, nicht der ganze: Der Reihenname steht im Kopf des Panels und wird hier abgezogen.
 * Bleibt nichts übrig, steht der volle Name da (bei der ersten Staffel der Normalfall).
 * Trägt der Name einen fremden Reihennamen („Kusuriya no Hitorigoto Staffel 3 Teil 2" ohne deutschen Titel), zählt bei einer Hauptstaffel nur die Staffelangabe;
 * beim Beiwerk gehört der fremde Reihenname dazu, er unterscheidet den Eintrag von der Hauptserie.
 */
export function teilNamen(
  m: FranchiseMember,
  reihenName: string,
  hauptstaffel: boolean,
  staffelLabel: string | undefined,
): { voll: string; rest: string; kurz: string } {
  const voll = eindeutschenStaffel(m.name)
  let rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
    ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
    : voll
  const staffelTeil = /(?:^|\s)(Staffel\s+\d+(?:\s*[-–—]?\s*Teil\s+\d+)?)\s*$/i.exec(rest)
  if (hauptstaffel && staffelTeil && rest === voll && rest !== staffelTeil[1]) rest = staffelTeil[1]!
  /* Die erste Staffel heißt „Staffel 1", ein Teil „Staffel 1 - Teil 2". */
  const kurz = (hauptstaffel && staffelLabel) || kurzName(rest, voll)
  return { voll, rest, kurz }
}

/** Die deutsche Datumsangabe eines kommenden Teils: „ab 19.06.2026", „ab 06.2026" oder „ab 2026". */
function abDatum(deStart: string): string {
  const [jahr, monat, tag] = deStart.split('-')
  if (tag) return `ab ${tag}.${monat}.${jahr}`
  if (monat) return `ab ${monat}.${jahr}`
  return `ab ${jahr}`
}

/**
 * „Format · Jahr · n Fg." hinter dem Namen. In der Liste steht das japanische Erscheinungsjahr, denn die Liste ordnet die Teile zeitlich ein
 * (der deutsche Disc-Termin 20.11.2026 stand bei Dragon Ball Z zwischen „1986" und „1996"); ein kommender Teil behält sein „ab" mit dem deutschen Termin,
 * denn auf den wartet jemand.
 */
export function angabenZeile(m: FranchiseMember, offen: boolean, t: Translate): string {
  const termin = offen && m.deStart ? abDatum(m.deStart) : m.jpYear ? String(m.jpYear) : m.deStart ? m.deStart.slice(0, 4) : ''
  return [
    m.format && m.format !== 'TV' ? (FORMAT_DE[m.format] ?? m.format) : '',
    termin,
    m.episodes && m.episodes > 1 ? t('detail.folgenKurz', { n: m.episodes }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
