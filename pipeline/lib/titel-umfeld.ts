/**
 * Was eine Titelseite mit dem Rest der Seite verbindet: Brotkrumen (sichtbar und als BreadcrumbList)
 * und „Ähnliche Titel“. Ohne diese Links hing jede Titelseite an einem Ast, den kein Crawler fand.
 */
import { aehnlicheTitel } from '../../shared/aehnlich.ts'
import { teilenPfad } from '../../shared/teilen.ts'
import type { Title } from '../../shared/types.ts'
import { SITE, esc, titelName } from './titel-seite.ts'
import { titelJsonLd } from './titel-namen.ts'
import { buchstabenLabel, verzeichnisSchluessel } from './verzeichnis-buchstabe.ts'

export interface Krume {
  name: string
  url: string
}

export const LINK_STIL = 'color:#7dd3fc;'
export const UEBERSCHRIFT_2 = 'font-size:1.1rem;margin:0 0 .5rem;color:#fff;'
const ANZAHL_AEHNLICH = 5

export function brotkrumenHtml(krumen: Krume[]): string {
  const teile = krumen.map((k, i) => (i === krumen.length - 1 ? esc(k.name) : `<a href="${esc(k.url)}" style="${LINK_STIL}">${esc(k.name)}</a>`))
  return `<nav aria-label="Brotkrumen" style="margin:0 0 1rem;font-size:.9rem;color:#9aa5bd;">${teile.join(' › ')}</nav>`
}

export function brotkrumenJsonLd(krumen: Krume[]): string {
  const eintraege = krumen.map((k, i) => ({ '@type': 'ListItem', position: i + 1, name: k.name, item: k.url }))
  return titelJsonLd({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: eintraege })
}

export const START_KRUME: Krume = { name: 'Anime-Kalender', url: SITE }
export const VERZEICHNIS_KRUME: Krume = { name: 'Titel von A bis Z', url: `${SITE}titel/` }

/** Start › Titel von A bis Z › Buchstabe › Titel. Titel ohne Eintrag im Verzeichnis (Cartoons ohne Synchro-Beleg) führen nur zur Startseite. */
export function titelKrumen(name: string, url: string, imVerzeichnis: boolean): Krume[] {
  if (!imVerzeichnis) return [START_KRUME, { name, url }]
  const schluessel = verzeichnisSchluessel(name)
  return [START_KRUME, VERZEICHNIS_KRUME, { name: buchstabenLabel(schluessel), url: `${SITE}titel/${schluessel}/` }, { name, url }]
}

/** Was die Titelseite aus ihrem Umfeld braucht: zwei Fragmente HTML und der Block für den Kopf. */
export interface Umfeld {
  krumenHtml: string
  krumenJsonLd: string
  aehnlichHtml: string
}

/** Die Titel, die für Vergleiche und Links in Frage kommen: je Art die Liste, dazu Adresse jedes Titels, der eine verlinkbare Seite hat. */
export interface UmfeldRahmen {
  anime: Title[]
  cartoons: Title[]
  adresseVon: Map<number, string>
  imVerzeichnis: Set<number>
}

function aehnlicheHtml(t: Title, r: UmfeldRahmen): string {
  const vorschlaege = aehnlicheTitel(t, t.westlich ? r.cartoons : r.anime, 4 * ANZAHL_AEHNLICH)
    .filter((v) => r.imVerzeichnis.has(v.title.id))
    .slice(0, ANZAHL_AEHNLICH)
  if (!vorschlaege.length) return ''
  const zeilen = vorschlaege.map((v) => `<li><a href="${SITE}${teilenPfad(r.adresseVon.get(v.title.id)!)}" style="${LINK_STIL}">${esc(titelName(v.title))}</a></li>`)
  return `<h2 style="${UEBERSCHRIFT_2}">Ähnliche Titel</h2>\n      <ul style="margin:0 0 1.5rem;padding-left:1.2rem;">\n        ${zeilen.join('\n        ')}\n      </ul>`
}

/** `t` ist der Titel der Seite (Kennung der Pipeline), `url` ihre Adresse. Der Name ist der des Verzeichnisses, nicht der eines einzelnen Termins. */
export function umfeldFuer(t: Title, url: string, r: UmfeldRahmen): Umfeld {
  const krumen = titelKrumen(titelName(t), url, r.imVerzeichnis.has(t.id))
  return { krumenHtml: brotkrumenHtml(krumen), krumenJsonLd: brotkrumenJsonLd(krumen), aehnlichHtml: aehnlicheHtml(t, r) }
}
