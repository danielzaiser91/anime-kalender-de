import type { Translate } from './i18n.tsx'
import type { SaisonZeile } from './saison.ts'

const TAG_MS = 86_400_000
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

const tag = (d: string): string => `${d.slice(8, 10)}.${d.slice(5, 7)}.`

const ganzerTag = (d: string | undefined): d is string => d?.length === 10

/** Der Japan-Start im Ausblick so genau wie bekannt; Saison und Jahr stehen schon in der Gruppenüberschrift und bleiben hier weg. */
const jpDatum = (z: SaisonZeile): string | undefined => (z.genau === 'tag' ? tag(z.jp!) : z.genau === 'monat' ? MONATE[Number(z.jp!.slice(5, 7)) - 1] : undefined)

/** Japan und Deutschland liegen zeitzonenbedingt höchstens einen Tag auseinander, wenn die Folge am selben Tag startet. */
const gleicherStart = (z: SaisonZeile): boolean => ganzerTag(z.jp) && ganzerTag(z.de) && !z.geschaetzt && Math.abs(Date.parse(z.jp) - Date.parse(z.de)) <= TAG_MS

/**
 * **Die Terminzeile einer Saison-Karte** (Daniel, 11.10.2026): eine Zeile ohne Verb — `Japan 25.09. · Deutsch 02.10.`, bei gleichem Start (höchstens ein Tag Abstand)
 * `Japan und Deutsch ab 25.09.`, ohne deutschen Termin `Japan 26.09. · Deutsch: Termin offen`. Im Ausblick fehlt der Teil „Deutsch“, solange nichts bekannt ist
 * (das Abzeichen „noch offen“ sagt es schon); ein deutscher Termin in einem anderen Jahr trägt das Jahr.
 */
export function terminText(z: SaisonZeile, ausblick: boolean, jahr: string, t: Translate): string | undefined {
  const mitJahr = (d: string) => (ausblick && d.slice(0, 4) !== jahr ? `${tag(d)}${d.slice(0, 4)}` : tag(d))
  const jp = ausblick ? jpDatum(z) : z.jp && tag(z.jp)
  if (jp && gleicherStart(z)) return t('saison.jpUndDe', { datum: mitJahr(z.jp! < z.de! ? z.jp! : z.de!) })
  const teile = [jp && t('saison.jp', { datum: jp })]
  if (z.de) teile.push(t(z.geschaetzt ? 'saison.deCa' : 'saison.de', { datum: mitJahr(z.de) }))
  else if (!ausblick && !z.erschienen) teile.push(t('saison.deOffen'))
  return teile.filter(Boolean).join(' · ') || undefined
}
