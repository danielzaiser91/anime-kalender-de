import { zeitMitMarke } from '@shared/zeit-text.ts'
import type { ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS, anbieterName } from '@shared/types.ts'
import type { KachelAngabe } from '@shared/laeuft-jetzt.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { Tooltip } from '../ui.tsx'
import { folgenSpanne, type FolgenSpanne, type KartenArt } from '../../lib/kachel-folgen.ts'

const ZEIT_PILLE = 'rounded-md bg-[rgba(13,15,20,.85)] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[#f2f1ee]'

/** Heute: „seit 17:00" statt der Uhrzeit, an der nächsten Kachel dazu eine zweite Pille „in 12 Min". */
function ZeitMarkeJetzt({ event, t, angabe }: { event: ReleaseEvent; t: Translate; angabe: KachelAngabe }) {
  return (
    <>
      <span className={ZEIT_PILLE}>{angabe.seit ? t('kal.seit', { zeit: angabe.seit }) : event.time}</span>
      {angabe.in && <span className={ZEIT_PILLE}>{angabe.in}</span>}
    </>
  )
}

/** Uhrzeit auf dem Cover. Ohne Uhrzeit steht dort nichts — bei einer Disc „im Handel". */
export function ZeitMarke({ event, t, angabe }: { event: ReleaseEvent; t: Translate; angabe?: KachelAngabe }) {
  if (angabe?.seit || angabe?.in) return <ZeitMarkeJetzt event={event} t={t} angabe={angabe} />
  const text = event.time
    ? `${zeitMitMarke(event, '≈ ')}`
    : event.releaseType === 'disc'
      ? t('card.inStores')
      : ''
  if (!text) return null
  const hinweis = event.timeEstimated ? t(event.platform === 'netflix' ? 'card.zeitVoraussichtlich' : 'card.zeitFestgelegt') : event.estimated ? t('legend.estimated') : ''
  const marke = <span className={ZEIT_PILLE}>{text}</span>
  return hinweis ? (
    <Tooltip text={hinweis} seite="oben">
      {marke}
    </Tooltip>
  ) : (
    marke
  )
}

/**
 * „Anbieter · Folge 3/12" unter dem Titel; im Fernsehen der Sender. Mit einem Bündel steht die lückenlose Spanne
 * („Folge 13–14/14“), bei einem Katalog-Release „Alle 13 Folgen auf einmal“.
 */
export function anbieterUndFolge(event: ReleaseEvent, t: Translate, buendel?: ReleaseEvent[]): string {
  const anbieter = event.platform === 'tv' ? (event.sender ?? PLATFORMS.tv.name) : PLATFORMS[event.platform].name
  if (event.katalog) return `${anbieter} · ${t(event.katalog === 'belegt' ? 'kal.katalogAlle' : 'kal.katalogAlleVermutlich', { n: event.episodeCount! })}`
  const spanne = folgenSpanne(buendel)
  if (spanne) return `${anbieter} · ${spannenText(event, spanne, t)}`
  /* Ein Film hat keine Folgen, eine TV-Sichtung zählt Sichtungen — beide ohne Angabe (17.09.2026). */
  if (!event.episode || event.sichtung || event.releaseType === 'movie') {
    return event.episodeCount && event.episodeCount > 1 && !event.episode ? `${anbieter} · ${t('kal.folgen', { n: event.episodeCount })}` : anbieter
  }
  /* Im Fernsehen nur die Folge: tv.de kennt die Gesamtzahl nicht (23.09.2026). */
  const gesamt = event.platform === 'tv' ? undefined : event.episodeCount
  const von = event.episodeCountAssumed ? `≈${gesamt}` : gesamt
  return `${anbieter} · ${gesamt ? t('kal.folgeVon', { n: event.episode, von: von! }) : t('kal.folge', { n: event.episode })}`
}

function spannenText(event: ReleaseEvent, spanne: FolgenSpanne, t: Translate): string {
  const gesamt = event.platform === 'tv' ? undefined : event.episodeCount
  if (!gesamt) return t('kal.folgenSpanne', { von: spanne.von, bis: spanne.bis })
  return t('kal.folgenSpanneVon', { von: spanne.von, bis: spanne.bis, gesamt: event.episodeCountAssumed ? `≈${gesamt}` : gesamt })
}

/** „+2 Folgen“ für ein Bündel ohne lückenlose Spanne; mit Spanne oder als Katalog-Release stünde dieselbe Angabe zweimal da. */
export function weitereFolgen(buendel: ReleaseEvent[] | undefined, t: Translate): string {
  if (!buendel || buendel.length < 2 || buendel[0]!.katalog || folgenSpanne(buendel)) return ''
  return t('kal.buendelStream', { n: buendel.length - 1 })
}

/** „Folge 15/≈24" ohne den Anbieter davor. */
export const nurFolge = (event: ReleaseEvent, t: Translate, buendel?: ReleaseEvent[]): string =>
  anbieterUndFolge(event, t, buendel).slice(PLATFORMS[event.platform].name.length + 3)

/** „Folge 15/≈24" ohne den Anbieter davor (auch der Sender im Fernsehen) — wenn die Fahne „Neu bei …“ ihn schon nennt. Leer, wenn nur der Anbieter dastand. */
export function folgeOhneAnbieter(event: ReleaseEvent, t: Translate, buendel?: ReleaseEvent[]): string {
  return anbieterUndFolge(event, t, buendel).slice(anbieterName(event.platform, event.sender).length).replace(/^ · /, '')
}

/** Die Zeile unter dem Titel eines einzelnen Anbieters: mit Fahne „Neu bei …“ ohne den Anbieter, sonst „Anbieter · Folge“. */
export function anbieterZeile(event: ReleaseEvent, t: Translate, buendel: ReleaseEvent[] | undefined, art: KartenArt | undefined): string {
  return art === 'imAngebot' ? folgeOhneAnbieter(event, t, buendel) : anbieterUndFolge(event, t, buendel)
}

/**
 * **Ein nicht eingehaltener Termin bleibt stehen und sagt, was los ist** — dass wir nachgesehen
 * haben, wie viele Folgen der Anbieter zeigt und wann wir wieder nachsehen.
 */
export function VerpasstMarke({ event, t }: { event: ReleaseEvent; t: Translate }) {
  const v = event.verpasst
  if (!v) return null
  const hinweis = [
    t('card.missed'),
    v.folgenVerfuegbar != null && t('card.missedCount', { n: v.folgenVerfuegbar }),
    v.neuErwartet ? t('card.missedNext', { d: v.neuErwartet.slice(0, 10) }) : t('card.missedCheck'),
    v.recherche,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <Tooltip text={hinweis} seite="oben">
      <span className="rounded bg-ak-fehler-grund px-1 text-[11px] font-semibold text-ak-fehler-text">
        {v.erschienenAm && v.verzugStunden != null
          ? `↻ ${t('card.missedLateBadge', { d: v.erschienenAm.slice(0, 10) })}`
          : `⚠ ${t('card.missedBadge')}`}
      </span>
    </Tooltip>
  )
}

/**
 * **Ein Termin ohne belegte Synchro sagt es auf der Karte** (10.10.2026, Beerus): „OmU" oder „Synchro offen" statt eines
 * stillen deutschen Termins. Die Erklärung steht im Tooltip und als Notiz im Panel.
 */
export function SpracheMarke({ event, t }: { event: ReleaseEvent; t: Translate }) {
  if (!event.sprache) return null
  return (
    <Tooltip text={t(event.sprache === 'omu' ? 'fachwort.omu' : 'kal.synchroOffenHinweis')} seite="oben">
      <span className="rounded bg-ak-flaeche-2 px-1 text-[11px] font-semibold text-ak-leise">
        {t(event.sprache === 'omu' ? 'kal.omu' : 'kal.synchroOffen')}
      </span>
    </Tooltip>
  )
}

/**
 * „8 Termine · 9 im TV · 12 im Handel" — Termine sind Streaming und Kino; Disc und Fernsehen stehen
 * mit eigener Zahl dahinter (30.09.2026, derselbe Trenner). Eine Null entfällt: „0 Termine" neben
 * „Kein Termin an diesem Tag" stünde doppelt da.
 */
export function zaehlung(termine: number, tv: number, handel: number, t: Translate): string {
  const teile: string[] = []
  if (termine) teile.push(termine === 1 ? t('kal.einTermin') : t('kal.termine', { n: termine }))
  if (tv) teile.push(t('kal.imTvZahl', { n: tv }))
  if (handel) teile.push(t('kal.imHandelZahl', { n: handel }))
  return teile.join(' · ')
}
