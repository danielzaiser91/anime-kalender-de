import type { ReactNode } from 'react'
import { anbieterName, PLATFORMS, type Release } from '@shared/types.ts'
import { formatDate } from '@shared/time.ts'
import { expandEvents, istErschienen } from '@shared/logic.ts'
import { Tooltip } from '../ui.tsx'
import { useLang, type Translate } from '../../lib/i18n.tsx'
import type { tvAngabe } from '../../lib/tv-angabe.ts'
import { AnbieterIcon } from '../../lib/anbieter-icon.tsx'
import { PremiereFaehnchen, zeigtPremiere } from './premiere-faehnchen.tsx'
import { MerkenKnopf } from './merken.tsx'
import { DubStatus, Pille } from './pille.tsx'
import { erschieneneSpanne } from './folgen-spanne.ts'
import { PROSIEBEN_MAXX_ROT, TOGGO_ORANGE } from './pillen.tsx'
import { pillenZiel } from './pillen-ziel.ts'
import { seitAbText } from './seit-datum.ts'
import { kaufTextSchluessel, kurzeAusgabe } from './disc-ausgabe.ts'
import { tvQuelle } from './tv-quelle.ts'

type TvText = ReturnType<typeof tvAngabe>

/**
 * Eine Ausgabe, die es noch nicht gibt — mit Erinnerungsknopf.
 *
 * Daniel am 25.08.2026: "in die kaufen pills kennzeichnen das es datum in
 * zukunft ist, und kalender eintrag fuer erinnerung klickbar anzeigen, ausserdem
 * kaufen (vorbestellen) bereich extra fuer kauf titel in zukunft, dann muss es
 * nicht in jedem pill stehen."
 *
 * Deshalb steht "vorbestellen" **einmal** ueber der Reihe und nicht in jeder
 * Pille. Der Kalenderknopf sitzt in der Pille, weil er zum einzelnen Termin
 * gehoert; er fuehrt auf denselben Google-Eintrag wie der Knopf im Terminblock.
 */
/**
 * Streicht aus dem Namen einer Ausgabe den Serientitel, der ohnehin daneben steht.
 *
 * „DAN DA DAN (Staffel 2) – Vol. 3" wird zu „Vol. 3". Geschnitten wird nur ein
 * Vorspann, der wirklich dem Titel entspricht — und nur, wenn danach noch etwas
 * übrig bleibt: Eine Ausgabe, die genauso heißt wie die Serie, behält ihren
 * Namen, sonst stünde dort nichts.
 */
function kuerzeUmTitel(name: string, titel?: string): string {
  if (!titel) return name
  const woerter = titel.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (!woerter.length) return name
  /*
    Geschnitten wird über **Wortgrenzen**, nicht zeichenweise. Der erste Anlauf
    zählte normalisierte Zeichen mit und lief aus dem Takt, sobald zwei
    Trennzeichen aufeinander folgten: „Attack on Titan Staffel 4 Teil 3" wurde
    zu „affel 4 Teil 3" (gemessen am 25.08.2026).
  */
  const trenner = '[^\\p{L}\\p{N}]+'
  /*
    `(?:…)?` und nicht `…?` — sonst steht dort `[^\p{L}\p{N}]+?`, ein **faules
    Plus** statt eines optionalen Trenners, und das Muster passt auf keinen
    einzigen Namen. Gemessen am 25.08.2026: sieben Prüffälle, null Kürzungen.
  */
  const muster = new RegExp(
    `^(?:${trenner})?` +
      woerter.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(trenner) +
      `(?:${trenner})?`,
    'iu',
  )
  const rest = name.replace(muster, '').trim()
  /*
    **Ein Rest, der für sich nichts sagt, ist keine Kürzung.** „Jujutsu Kaisen
    0" unter dem Titel „Jujutsu Kaisen" schrumpfte auf „0" — der Film heißt aber
    wirklich so, und „0" allein steht in der Pille als Rätsel. Reine Ziffern und
    alles unter drei Zeichen behalten deshalb den vollen Namen.
  */
  if (!rest || rest.length < 3 || /^\d+$/.test(rest)) return name
  return rest
}

/**
 * **Das Medium aus der Editionsangabe** — „Limited Steelbook Edition, Blu-ray"
 * trägt es am Ende, andere Ausgaben mittendrin. Gesucht wird deshalb im ganzen
 * Text, und die genauere Angabe gewinnt: „DVD & Blu-ray" ist beides.
 */
function mediumAus(edition?: string): string | undefined {
  if (!edition) return undefined
  const bd = /blu-?ray/i.test(edition)
  const dvd = /\bdvd\b/i.test(edition)
  if (bd && dvd) return 'DVD + BD'
  if (bd) return 'Blu-ray'
  if (dvd) return 'DVD'
  return undefined
}

/** Der Händlername aus der Adresse — „amazon.de" wird zu „Amazon". */
function haendlerAus(url?: string): string {
  if (!url) return 'Shop'
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]
    return host.charAt(0).toUpperCase() + host.slice(1)
  } catch {
    return 'Shop'
  }
}

/**
 * Führt die Pille zu einem Shop? aniSearch ist keiner: Ein Disc-Termin mit aniSearch-Ausgabe
 * (Dragon Ball Z Box 4, 26.09.2026) verlinkt dorthin, heißt aber weiter „Kaufausgabe".
 */
function hatShop(release: Release): boolean {
  return Boolean(release.buyUrl || (release.platformUrl && !/anisearch\./i.test(release.platformUrl)))
}

/** Ein Trennzeichen, das in keinem Text vorkommt — dann bleibt der Text ein Stück. */
const KEIN_TRENNER = '\u0001'

/**
 * **Der volle Text im Tooltip — nur, wo zwei Zeilen ihn abschneiden können** (Daniel, 22.09.2026:
 * „falls 2 zeilen immer noch nicht reichen sollten dann ... und tooltip"). Die Schwelle ist grob:
 * Bei `max-w-72` und 11 px passen rund 45 Zeichen in eine Zeile. Ein kürzerer Text bekommt keinen
 * Tooltip, denn der würde nur wiederholen, was dasteht. Eigene Komponente statt `title`: keine
 * Standard-Tooltips des Browsers (12.08.2026).
 */
function LangMitTooltip({ text, children }: { text: string; children: ReactNode }) {
  return text.length > 90 ? (
    <Tooltip text={text} seite="oben">
      {children}
    </Tooltip>
  ) : (
    <>{children}</>
  )
}

/** Ein neutraler Fernseher (Umriss, Form wie Tabler „device-tv") — kennzeichnet TV-Pillen. */
function TvZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 3l-4 4l-4-4" />
    </svg>
  )
}

/** Ein Stream-Termin nennt den Anbieter wie jede Anbieterzeile — nicht den Serientitel, der im Kopf steht („Undefeated Bahamut Chronicle“ statt „ADN“, 16.09.2026). */
function kurzerNameVon(release: Release, titel: string | undefined, t: Translate): string {
  if (release.releaseType === 'disc') {
    /* Ohne Adresse kein Händler: „Shop“ versprach einen Klick, den es nicht gab (Dragon Ball Z, aniSearch kennt nur den Termin). */
    return hatShop(release) ? t(kaufTextSchluessel(release.buyUrl ?? release.platformUrl), { shop: haendlerAus(release.buyUrl ?? release.platformUrl) }) : t('detail.kaufausgabe')
  }
  const anbieter = anbieterName(release.platform, release.sender)
  return (anbieter && release.kanal ? `${anbieter} (${release.kanal})` : anbieter) ?? kuerzeUmTitel(release.name, titel)
}

/** Ein TOGGO-Sender trägt TOGGOs Orange, ProSieben MAXX sein Rot, sonst gilt die Farbe des Anbieters. */
function farbeVon(release: Release): string | undefined {
  if (/^TOGGO/i.test(release.sender ?? '')) return TOGGO_ORANGE
  if (/^ProSieben MAXX$/i.test(release.sender ?? '')) return PROSIEBEN_MAXX_ROT
  return PLATFORMS[release.platform]?.color
}

/** Wie weit eine laufende Wochenserie ist („Fg. 1–15“) — die erschienenen Folgen, ohne Gesamtzahl (Daniel, 04.10.2026). */
function fortschrittVon(release: Release, t: Translate): string {
  if (release.releaseType !== 'weekly' || release.platform === 'tv') return ''
  const events = expandEvents(release)
  const spanne = erschieneneSpanne(events)
  if (spanne) return t('detail.folgenBereich', { bereich: spanne })
  const raus = events.filter((e) => istErschienen(e)).length
  return raus > 0 ? t('detail.folgenFortschritt', { raus }) : ''
}

/** „ab“ oder „seit“ — ein nacktes Datum sagt beides nicht; bei TV-Sichtungen der nächste Sendetag, sonst die letzte Sichtung. */
function terminTeil(release: Release, tvText: TvText | undefined, today: string, t: Translate): string | undefined {
  if (tvText) return tvText.text
  if (release.tvLetzteSichtung && release.platform !== 'tv') return t('detail.neuAm', { d: formatDate(release.tvLetzteSichtung) })
  if (release.tvLetzteSichtung) {
    const naechste = Object.values(release.schedule?.observed ?? {}).filter((d) => d >= today).sort()[0] ?? release.tvLetzteSichtung
    return t('detail.tvGesehen', { d: formatDate(naechste) })
  }
  return seitAbText(release.schedule?.firstEpisodeDate, today, t)
}

/** Tag und Uhrzeit farbig, der Rest bleibt grau; ohne Zeit trennt der Platzhalter nichts. */
function Unterzeile({ text, zeit }: { text: string; zeit?: string }) {
  return (
    <>
      {text.split(zeit || KEIN_TRENNER).flatMap((teil, i) => [
        i ? (
          <span key={`z${i}`} className="font-semibold text-ak-tv">
            {zeit}
          </span>
        ) : null,
        teil,
      ])}
    </>
  )
}

/** Was gerade läuft, mit Folge und Fortschritt (Daniel, 22.09.2026): Folgentitel auf höchstens zwei Zeilen, der volle im Tooltip. */
function LaeuftZeile({ laeuft, t }: { laeuft: NonNullable<NonNullable<TvText>['laeuft']>; t: Translate }) {
  return (
    <>
      <LangMitTooltip text={[t('tv.laeuft'), laeuft.text].filter(Boolean).join(' · ')}>
        <span className="line-clamp-2 block text-t4 text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-ak-gut-text">{t('tv.laeuft')}</span>
          {laeuft.text ? ` · ${laeuft.text}` : ''}
        </span>
      </LangMitTooltip>
      <span aria-hidden className="my-0.5 block h-[3px] w-full max-w-72 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
        <span className="block h-full rounded bg-ak-gut" style={{ width: `${Math.round(laeuft.anteil * 100)}%` }} />
      </span>
    </>
  )
}

/** Führt zur laufenden, sonst zur nächsten Sendung im tv.de-Programm; steht neben der Zeile, nicht darin. */
function ProgrammLink({ href, hinweis }: { href: string; hinweis: string }) {
  return (
    <Tooltip text={hinweis} seite="oben" eigenerFokus className="shrink-0">
      <a
        href={href}
        target="_blank"
        rel="noopener"
        aria-label={hinweis}
        className="grid size-11 place-items-center rounded-full text-slate-500 transition hover:text-ak-text dark:text-slate-300"
      >
        <TvZeichen />
      </a>
    </Tooltip>
  )
}

/** Bei einer Disc steht das Erscheinungsdatum in der Farbe der TV-Termine, damit es aus der Zeile herausspringt. */
function discDatum(release: Release): string | undefined {
  const datum = release.schedule?.firstEpisodeDate
  return release.releaseType === 'disc' && datum ? formatDate(datum) : undefined
}

/** Das Fernseh-Zeichen führt ins Programm; gibt es noch keins, zur Quelle der Ankündigung. */
export function programmZiel(release: Release, tvText: TvText | undefined, t: Translate): { href: string; hinweis: string } | undefined {
  if (tvText?.programm) return { href: tvText.programm, hinweis: t('tv.imProgramm') }
  const quelle = tvQuelle(release)
  return quelle ? { href: quelle.url, hinweis: t('tv.quelle', { name: quelle.name }) } : undefined
}

function terminName(release: Release, titel: string | undefined, t: Translate, premiere: boolean): ReactNode {
  const medium = mediumAus(release.edition)
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
      {medium && <span className="shrink-0 rounded bg-black/10 px-1 py-px text-t5 uppercase tracking-[.08em] dark:bg-white/15">{medium}</span>}
      <span className="truncate">{kurzerNameVon(release, titel, t)}</span>
      {premiere && <PremiereFaehnchen release={release} />}
    </span>
  )
}

/** Ein Termin als Anbieterzeile: Sender oder Anbieter, Datum, Folge; bei TV mit Programm-Link, mit Kalenderknopf. */
export function TerminZeile({ release, titel, today, tvText, deutsch }: {
  release: Release
  titel?: string
  today: string
  /** Bei TV: „Fg. 16 · heute 21:15“ und ob es eine Premiere ist (`lib/tv-angabe.ts`). */
  tvText?: TvText
  /** Ein Prime-Kanal-Termin, dessen Anbieter Deutsch belegt: die Blase „Deutsch“ und dessen Folgen statt der Zählung des Termins. */
  deutsch?: { folgen: string }
}) {
  const { t } = useLang()
  const tv = release.platform === 'tv'
  /* Eine Prime-Zeile ohne Adresse führt zur Suche; der Hinweis sagt es (#842). */
  const ziel = pillenZiel(release, titel, t)
  const zweite = [release.publisher, kurzeAusgabe(release.edition)].filter(Boolean).join(' · ')
  const text = [zweite, deutsch?.folgen || fortschrittVon(release, t), terminTeil(release, tvText, today, t)].filter(Boolean).join(' · ')
  const tvLink = tv ? programmZiel(release, tvText, t) : undefined
  const unten = (
    <>
      {tvText?.laeuft && <LaeuftZeile laeuft={tvText.laeuft} t={t} />}
      <LangMitTooltip text={tvText?.text ?? ''}>
        <span className={`${tvText ? 'line-clamp-2' : ''} block`}>
          <Unterzeile text={text} zeit={tvText?.zeit ?? discDatum(release)} />
        </span>
      </LangMitTooltip>
    </>
  )
  return (
    <Pille
      name={terminName(release, titel, t, zeigtPremiere(release, tvText?.premiere))}
      farbe={farbeVon(release)}
      url={ziel.ziel}
      titel={ziel.hinweis}
      icon={release.releaseType !== 'disc' ? <AnbieterIcon was={tv ? (release.sender ?? '') : release.platform} groesse={18} /> : undefined}
      unten={unten}
      status={deutsch ? <DubStatus art="belegt" /> : undefined}
      aktion={
        <>
          {tvLink && <ProgrammLink href={tvLink.href} hinweis={tvLink.hinweis} />}
          <MerkenKnopf release={release} today={today} zeile />
        </>
      }
    />
  )
}
