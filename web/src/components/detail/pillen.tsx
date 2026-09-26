import { type Title, type DiscAusgabe, type Release, anbieterName, PLATFORMS, type WatchLink } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'
import { type ReactNode } from 'react'
import { Tooltip } from '../ui.tsx'
import { formatDate } from '@shared/time.ts'
import { tvAngabe } from '../../lib/tv-angabe.ts'
import { useLang, translate } from '../../lib/i18n.tsx'
import { AnbieterIcon } from '../../lib/anbieter-icon.tsx'
import { MerkenKnopf } from './merken.tsx'

/*
  **Pillen: neutrale Fläche, Markenstreifen links** (Daniel, 19.09.2026: „rot auf rot, orange auf
  orange ist nicht so gut"; aus drei Entwürfen gewählt). Die Markenfarbe steht nur noch im
  Zeichen und als 3-px-Streifen links (`--marke`); Schrift in der Standardfarbe.
*/
const PILLE_MARKE =
  'bg-white text-slate-800 shadow-[inset_0_0_0_1px_rgba(15,23,42,.12),inset_3px_0_0_var(--marke)] dark:bg-[#162238] dark:text-slate-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),inset_3px_0_0_var(--marke)]'

const marke = (farbe?: string) => (farbe ? ({ '--marke': farbe } as React.CSSProperties) : undefined)

/*
  Die Pille „nicht mehr abrufbar" (durchgestrichen) ist seit dem 22.09.2026 aus der Oberfläche
  genommen (Daniel: „war nette idee, aber brauchen wir vorerst nicht"). Die Abgänge bleiben als
  `entfernteStreams` im Bestand.
*/

/**
 * **Die Silberscheibe für aniSearch-Disc-Wege.**
 *
 * Daniel am 07.09.2026: „füg ein cd icon links in die pill statt disc zu
 * schreiben. einfach icon + anisearch und schöner gestyled." Das Zeichen sagt
 * in 14 px, wofür das Wort „Disc" eine Zeile brauchte — und es sagt es auch
 * dem, der die Pille nur streift.
 *
 * `currentColor` statt einer festen Farbe: So trägt das Zeichen dieselbe
 * Tönung wie der Text daneben, in beiden Themen.
 */
export function DiscZeichen() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="1.9" stroke="currentColor" strokeWidth="1.3" />
      {/* Der Lichtreflex — ohne ihn liest sich der Ring als Zielscheibe. */}
      <path d="M4.6 4.2A5 5 0 0 1 8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}

/**
 * **Zu jedem Titel ein Weg zu aniSearch — auch ohne Kennung.**
 *
 * Daniel am 07.09.2026: „anisearch link für alle titel dort einfügen wo wir
 * anisearch links haben, ansonsten anisearch search seite mit dem titel da
 * einfügen. überall soll da ein link sein." Und einen Prompt später: „oder du
 * kannst statt search auch herausfinden was der tatsächliche link zum anime ist,
 * das wäre besser."
 *
 * Genau das ist die Reihenfolge hier. 2.621 der 2.768 Titel tragen eine
 * `anisearchId` (gemessen 07.09.2026, 94,7 %) — für sie führt der Verweis
 * direkt auf die Werkseite. Für die übrigen 147 gibt es keine geratene Kennung,
 * sondern die Suche mit dem Titel.
 *
 * **Und die Suchadresse ist `/search?q=`, nicht `/anime/index?text=`.**
 * Letztere antwortet mit HTTP 200 und „Deine Suchanfrage ist ungültig — bitte
 * sende Deine Suchanfrage erneut ab": ein Filterformular, das ohne Sitzung
 * nicht abschickt (Daniel, 12.09.2026, mit Bild: „die anisearch verlinkung
 * läuft ins leere"). Der Beleg dafür, dass es hier je funktioniert hat, war ein
 * Statuscode — genau der Fehler, den diese Akte für Amazon schon beschreibt:
 * **200 heißt „ich habe geantwortet", nicht „es gibt die Seite".**
 *
 * Gemessen am 12.09.2026, vier Formen gegeneinander: `/anime/index?text=` gibt
 * dreimal die Fehlermeldung, `/search?q=` liefert die Trefferliste — „Date A
 * Bullet" → `anime/14630`, „Kusuriya no Hitorigoto: Bouhi no Hihou" →
 * `anime/20990`. Ein Titel, den aniSearch nicht führt, ergibt dort eine leere
 * Liste; das ist die ehrliche Auskunft und keine Fehlerseite.
 *
 * **Warum keine Kennung geraten wird:** Eine erfundene Nummer führt auf eine
 * fremde Werkseite, und das ist von einer richtigen nicht zu unterscheiden —
 * dieselbe Falle wie bei den drei erfundenen Amazon-Adressen vom 23.08.2026.
 * Die Suche ist einen Klick länger und immer richtig.
 */
export function AniSearchVerweis({ title }: { title: Title }) {
  /* Cartoons führt aniSearch nicht — dort steht der Weg zu TMDB, woher ihre Angaben stammen (16.09.2026). */
  const tmdb = title.westlich && title.tmdbId ? `https://www.themoviedb.org/tv/${title.tmdbId}` : undefined
  const ziel = tmdb
    ? tmdb
    : title.anisearchId
    ? `https://www.anisearch.de/anime/${title.anisearchId}`
    : `https://www.anisearch.de/search?q=${encodeURIComponent(anzeigeName(title))}`
  return (
    <a
      href={ziel}
      target="_blank"
      rel="noreferrer noopener"
      title={tmdb ? 'Bei TMDB ansehen' : title.anisearchId ? 'Bei aniSearch ansehen' : 'Bei aniSearch suchen'}
      className="ml-auto inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {tmdb ? 'TMDB' : 'aniSearch'}
      {/* Der Pfeil sagt „führt hinaus" — ohne ihn liest sich das Wort als Quellenangabe. */}
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
        <path d="M4 2h6v6M10 2 2.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  )
}

export function Pille({
  name,
  farbe,
  url,
  unten,
  rechts,
  titel,
  icon,
  durchgestrichen,
}: {
  name: string
  farbe?: string
  url: string
  unten?: string
  rechts?: ReactNode
  titel?: string
  icon?: ReactNode
  /** Eine Ausgabe ohne deutschen Ton — sichtbar und anklickbar, aber durchgestrichen. */
  durchgestrichen?: boolean
}) {
  /*
    **Der Hinweis kommt aus `ui.tsx`, nicht vom Browser** (Daniel, 12.08.2026: „keine default
    web tooltips … überall nutzen"). Die Pille war die letzte Stelle mit einem nackten
    `title`-Attribut; seit dem 23.09.2026 hat der Hinweis mehrere Zeilen, und der graue
    Systemkasten setzt sie zwar um, sieht aber anders aus als jeder andere Hinweis der Seite.

    Der Tooltip hüllt die Pille in zwei `span` — deshalb trägt die Hülle `shrink-0`, sonst
    schrumpft die Pille im Flex-Container der Pillenreihe.
  */
  const pille = (
    <a
      href={url || undefined}
      target="_blank"
      rel="noreferrer noopener"
      className={[
        'relative inline-flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-3 pr-4 transition',
        /* Blase oben rechts (DE-Häkchen) — Abstand über `blase-rechts` (styles.css). */
        rechts ? 'blase-rechts' : '',
        durchgestrichen ? 'opacity-70' : '',
        farbe
          ? `${PILLE_MARKE} hover:brightness-95 dark:hover:brightness-125`
          : 'border border-slate-200 hover:bg-slate-100/60 dark:border-white/10 dark:hover:bg-white/5',
      ].join(' ')}
      style={marke(farbe)}
    >
      {icon && (
        <span className="flex shrink-0 items-center" style={farbe ? { color: farbe } : undefined}>
          {icon}
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span
          className={`whitespace-nowrap text-[13px] font-medium ${durchgestrichen ? 'line-through' : ''}`}
        >
          {name}
        </span>
        {/*
          **Kein `truncate` mehr.** Die Unterzeile trug Sätze wie „Ohne deutschen
          Ton: Folge 2–33" und wurde ausgepunktet — eine halbe Auskunft ist
          schlechter als eine kurze (Daniel, 03.09.2026). Seit den gekürzten
          Texten („✕ DE 2–33") passt sie, und `whitespace-nowrap` hält sie in
          einer Zeile: Die Pille wächst lieber mit, als etwas zu verschlucken.
        */}
        {unten && (
          <span
            className="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400"
          >
            {unten}
          </span>
        )}
      </span>
      {rechts && <span className="ml-auto flex shrink-0 items-center gap-1">{rechts}</span>}
    </a>
  )
  return titel ? (
    <Tooltip text={titel} seite="oben">
      {pille}
    </Tooltip>
  ) : (
    pille
  )
}

const DISC_FORMAT: Record<DiscAusgabe[1], string> = { b: 'Blu-ray', d: 'DVD', u: '4K UHD' }

/**
 * **Die deutschen Disc-Ausgaben: je Format eine Pille, die Einzelbände zum Aufklappen.**
 *
 * Daniel am 16.09.2026 an Dragon Quest Dai: aniSearch führt Blu-ray und DVD, je als
 * Komplettset und in vier Boxen — „wir wollen auf unserer webseite nicht unnötig viele
 * titel anzeigen … 2 discs pills dvd und blueray, führen zu gesamtpaket, darunter
 * ausklappbar die volumes". Gewählt: Die Gesamtausgabe (oder bei Filmen die jüngste
 * Ausgabe) je Format als Pille, dazu **eine** Umschalt-Pille für alle Einzelbände. Die
 * Liste selbst steht unter dem Kasten, damit dessen Höhe fest bleibt.
 */
export function discPillen(
  ausgaben: DiscAusgabe[],
  offen: boolean,
  umschalten: () => void,
  t: (k: string, v?: Record<string, string | number>) => string,
): ReactNode[] {
  const pillen: ReactNode[] = []
  for (const f of ['b', 'd', 'u'] as const) {
    const eigene = ausgaben.filter((a) => a[1] === f)
    const kopf = eigene.filter((a) => a[2] === 'g')
    const wahl = kopf[0] ?? eigene.find((a) => a[2] === 'e')
    if (!wahl) continue
    pillen.push(
      <Pille
        key={`disc-${f}`}
        name={DISC_FORMAT[f]}
        url={`https://www.anisearch.de/article/${wahl[4]}`}
        /* Bei einer Einzelausgabe (Film) wiederholte der Kurzname den Titel — das Datum sagt mehr (Stichprobe 16.09.2026). */
        unten={kopf.length ? t('where.discGesamt') : wahl[3] ? formatDate(wahl[3]) : undefined}
        titel={`${wahl[0]}${wahl[3] ? ` · ${formatDate(wahl[3])}` : ''}`}
        icon={<DiscZeichen />}
      />,
    )
  }
  const einzeln = ausgaben.filter((a) => a[2] === 't' || (a[2] === 'e' && ausgaben.some((b) => b[1] === a[1] && b[2] === 'g')))
  if (einzeln.length) {
    pillen.push(
      <button
        key="disc-einzeln"
        type="button"
        onClick={umschalten}
        aria-expanded={offen}
        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-left transition hover:bg-slate-100/60 dark:border-white/10 dark:hover:bg-white/5"
      >
        <DiscZeichen />
        <span className="flex flex-col leading-tight">
          <span className="whitespace-nowrap text-[13px] font-medium">{t('where.discEinzeln')}</span>
          <span className="whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
            {einzeln.length === 1 ? t('where.discAnzahlEine') : t('where.discAnzahl', { n: einzeln.length })} {offen ? '▴' : '▾'}
          </span>
        </span>
      </button>,
    )
  }
  return pillen
}

/** Die aufgeklappten Einzelbände, nach Format getrennt. */
export function DiscEinzelListe({ ausgaben }: { ausgaben: DiscAusgabe[] }) {
  const gruppen = (['b', 'd', 'u'] as const)
    .map((f) => ({
      f,
      liste: ausgaben
        .filter((a) => a[1] === f && a[2] !== 'g')
        .sort((a, b) => a[3].localeCompare(b[3]) || a[0].localeCompare(b[0])),
    }))
    .filter((g) => g.liste.length)
  return (
    <div className="mt-2 space-y-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-white/10">
      {gruppen.map((g) => (
        <div key={g.f} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="w-14 shrink-0 font-medium text-slate-700 dark:text-slate-200">{DISC_FORMAT[g.f]}</span>
          {g.liste.map((a) => (
            <a
              key={a[4]}
              href={`https://www.anisearch.de/article/${a[4]}`}
              target="_blank"
              rel="noreferrer noopener"
              className="whitespace-nowrap text-sky-700 hover:underline dark:text-sky-300"
              title={a[3] ? formatDate(a[3]) : undefined}
            >
              {a[0]}
            </a>
          ))}
        </div>
      ))}
    </div>
  )
}

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

function PillenHuelle({ ziel, children }: { ziel?: string; children: ReactNode }) {
  const klasse = 'flex min-w-0 flex-col py-0.5 leading-tight'
  return ziel ? (
    <a href={ziel} target="_blank" rel="noreferrer noopener" className={klasse}>
      {children}
    </a>
  ) : (
    <span className={klasse}>{children}</span>
  )
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

export function ReleasePille({
  release,
  titel,
  today,
  tvText,
}: {
  release: Release
  titel?: string
  today: string
  /** Bei TV: „Fg. 16 · heute 21:15" und ob es eine Premiere ist (`lib/tv-angabe.ts`). */
  tvText?: ReturnType<typeof tvAngabe>
}) {
  const { t } = useLang()
  /*
    **Die Pille sagt, was ein Klick tut — nicht, wie die Ausgabe heißt.**

    Hier stand der gekürzte Releasename: „Staffel 1", darunter „Crunchyroll ·
    Limited Steelbook Edition, Blu-ray · ab 04.09.2026". Der Titel steht drei
    Zeilen höher im Kopf, die Edition sagt nichts über das Ziel des Links —
    und was der Klick tut, stand nirgends. Daniel am 04.09.2026: „in der pill
    sollte stehen ,[blu-ray] kaufen bei amazon'".

    Also: das Medium als Marke, dahinter die Handlung mit dem Händler. Die
    Edition rückt in die zweite Zeile, wo sie hingehört — sie unterscheidet
    Ausgaben, sie benennt keine.
  */
  const medium = mediumAus(release.edition)
  const kurzerName =
    release.releaseType === 'disc'
      ? /*
          **Ohne Adresse kein Händler** (Daniel, 23.09.2026: „was ist das für eine pill ‚kaufen bei
          shop', man kann die pill nicht anklicken, sie leitet nirgendwohin"). `haendlerAus`
          antwortete auf ein fehlendes Ziel mit „Shop", und die Pille versprach einen Klick, den es
          nicht gab — bei Dragon Ball Z kennt aniSearch nur den Termin, keinen Shop. Dann nennt die
          Pille schlicht, was sie ist; Termin und Merken-Knopf bleiben.
        */
        hatShop(release)
        ? t('detail.kaufenBei', { shop: haendlerAus(release.buyUrl ?? release.platformUrl) })
        : t('detail.kaufausgabe')
      : /* Ein Stream-Termin nennt den Anbieter wie jede Stream-Pille — nicht den Serientitel, der
           im Kopf steht („Undefeated Bahamut Chronicle" statt „ADN", Daniel, 16.09.2026). */
        (anbieterName(release.platform, release.sender) ?? kuerzeUmTitel(release.name, titel))
  /*
    **Der Kalendereintrag gilt dem nächsten Termin, nicht dem ersten.**

    Bei einer Wochenserie, die seit anderthalb Jahren läuft, wäre der erste
    Termin die Folge 1 von 2023 — ein Eintrag, den niemand braucht. Steht
    nichts mehr aus, fällt das Symbol weg: Ein Kalendereintrag für etwas
    Vergangenes ist kein Angebot, sondern ein Fehlgriff.
  */
  const datum = release.schedule?.firstEpisodeDate
  /* Ein TOGGO-Sender trägt TOGGOs Orange, nicht das allgemeine TV-Grün (Daniel, 19.09.2026). */
  const farbe = /^TOGGO/i.test(release.sender ?? '')
    ? TOGGO_ORANGE
    : /^ProSieben MAXX$/i.test(release.sender ?? '')
      ? /* Die Farbe, die Joyn selbst für ProSieben MAXX führt (`accentColor`, 22.09.2026). */
        PROSIEBEN_MAXX_ROT
      : PLATFORMS[release.platform]?.color
  const tv = release.platform === 'tv'
  const zweite = [release.publisher, release.edition].filter(Boolean).join(' · ')
  return (
    <span
      className={`relative inline-flex max-w-full items-center ${tv ? 'blase-links rounded-md pl-5' : 'rounded-full pl-3'} ${farbe ? 'blase-rechts' : ''} py-1 pr-4 ${tvText?.premiere ? 'mt-2 pt-3' : ''} ${farbe ? PILLE_MARKE : ''}`}
      style={marke(farbe)}
    >
      {tv && (
        /*
          **Fernsehen erkennt man am Fernseher** (Daniel, 22.09.2026): eckige Pille, dazu ein Fernseher
          als Blase oben links (unten links war „schlecht") — neutral grau, nie in der Senderfarbe
          („keine dynamische anbieter farbe"). So hebt sich die Pille von den Streaming-Anbietern ab,
          ohne Breite zu kosten.
        */
        <span className="absolute -left-1.5 -top-1.5 z-10">
          {tvText?.programm ? (
            /* Führt zur laufenden, sonst zur nächsten Sendung im tv.de-Programm (Daniel, 22.09.2026). */
            <Tooltip text={t('tv.imProgramm')} seite="oben">
              <a
                href={tvText.programm}
                target="_blank"
                rel="noopener"
                aria-label={t('tv.imProgramm')}
                className="grid size-[22px] place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-300 transition hover:text-sky-600 hover:ring-sky-400 dark:bg-[#162238] dark:text-slate-300 dark:ring-slate-500 dark:hover:text-sky-300"
              >
                <TvZeichen />
              </a>
            </Tooltip>
          ) : (
            <span
              aria-hidden
              className="grid size-[22px] place-items-center rounded-full bg-white text-slate-500 ring-1 ring-slate-300 dark:bg-[#162238] dark:text-slate-300 dark:ring-slate-500"
            >
              <TvZeichen />
            </span>
          )}
        </span>
      )}
      {tvText?.premiere && (
        /*
          **Premiere als Fähnchen auf der Kante** (Daniel, 19.09.2026: „zu unauffällig", aus vier
          Entwürfen gewählt) — leuchtet und kostet keine Breite.

          **Auf der Kante, nicht darin** (Daniel, 22.09.2026: „premiere label überdeckt toggo,
          platzier es am kachelrand" und „nicht rechts, sondern links, aber rechts vom tv icon"):
          Es steht links neben dem Namen, rechts der Blase — aber mit seiner Unterkante auf der
          Oberkante der Pille, sonst ragt es in die Namenszeile.
        */
        <span className={`absolute -top-[11px] ${tv ? 'left-[22px]' : 'left-[10px]'} z-10`}>
          <Tooltip text={t('tv.premiereHinweis')} seite="oben">
            <span className="block rounded-md bg-gradient-to-r from-fuchsia-600 to-amber-500 px-1.5 py-px text-[9px] font-extrabold uppercase leading-tight tracking-wider text-white shadow-[0_0_8px_rgba(217,70,239,.7)]">
              ✦ Premiere
            </span>
          </Tooltip>
        </span>
      )}
      {/*
        **Ohne Ziel kein Verweis** (Daniel, 17.09.2026, Kino-Pille): `href="#"` öffnete
        dieselbe Seite in einem neuen Tab. Dann trägt die Pille nur ihre Angaben und „Merken".
      */}
      <PillenHuelle ziel={release.buyUrl ?? release.platformUrl}>
        {/*
          Der Serienname steht drei Zeilen höher im Kopf des Panels — ihn in
          jeder Pille zu wiederholen macht sie breit und sagt nichts Neues.
          Übrig bleibt, was die Ausgaben unterscheidet: „Vol. 3" statt
          „DAN DA DAN (Staffel 2) – Vol. 3".
        */}
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
          {medium && (
            <span className="shrink-0 rounded bg-black/10 px-1 py-px text-[10px] uppercase tracking-wide dark:bg-white/15">
              {medium}
            </span>
          )}
          {release.releaseType !== 'disc' && (
            /* Das Zeichen trägt die Markenfarbe, die Schrift nicht mehr (Variante A, 19.09.2026). */
            <span className="flex shrink-0" style={farbe ? { color: farbe } : undefined}>
              <AnbieterIcon was={tv ? (release.sender ?? '') : release.platform} />
            </span>
          )}
          <span className="truncate">{kurzerName}</span>
        </span>
        {tvText?.laeuft && (
          /*
            **Was gerade läuft, mit Folge und Fortschritt** (Daniel, 22.09.2026, Variante C2 aus
            drei Entwürfen): Folgentitel auf höchstens zwei Zeilen, reicht das nicht, „…" und der
            volle Titel im Tooltip. Der Balken zeigt die verstrichene Sendezeit laut Programm.
          */
          <>
            <LangMitTooltip text={[t('tv.laeuft'), tvText.laeuft.text].filter(Boolean).join(' · ')}>
              <span className="line-clamp-2 max-w-72 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t('tv.laeuft')}</span>
                {tvText.laeuft.text ? ` · ${tvText.laeuft.text}` : ''}
              </span>
            </LangMitTooltip>
            <span aria-hidden className="my-0.5 block h-[3px] w-full max-w-72 overflow-hidden rounded bg-slate-200 dark:bg-white/10">
              <span className="block h-full rounded bg-emerald-500" style={{ width: `${Math.round(tvText.laeuft.anteil * 100)}%` }} />
            </span>
          </>
        )}
        <LangMitTooltip text={tvText?.text ?? ''}>
        <span className={`${tvText ? 'line-clamp-2 max-w-72' : 'truncate'} text-[11px] text-slate-500 dark:text-slate-400`}>
          {/*
            **„ab" oder „seit" — ein nacktes Datum sagt beides.**

            „04.09.2026" allein lässt offen, ob die Ausgabe kommt oder schon da
            ist; genau diese Frage führt jemanden auf die Seite. Zwei Zeichen
            beantworten sie.
          */}
          {[
            zweite,
            /*
              Bei einer TV-Sichtung ist das Datum unsere erste Sichtung, kein Start. Genannt wird
              der nächste Sendetag, sonst die letzte Sichtung — „im TV am 23.09." über einer
              Reihe, die am 21.09. beginnt, las sich wie der erste Termin (19.09.2026).
            */
            tvText
              ? tvText.text
              : release.tvLetzteSichtung && release.platform !== 'tv'
              ? /* RTL+-Wochentermin: die jüngste Folge, nicht „im TV". */
                t('detail.neuAm', { d: formatDate(release.tvLetzteSichtung) })
              : release.tvLetzteSichtung
              ? t('detail.tvGesehen', {
                  d: formatDate(
                    Object.values(release.schedule?.observed ?? {})
                      .filter((d) => d >= today)
                      .sort()[0] ?? release.tvLetzteSichtung,
                  ),
                })
              : datum && t(datum > today ? 'detail.abDatum' : 'detail.seitDatum', { d: formatDate(datum) }),
          ]
            .filter(Boolean)
            .join(' · ')
            /* Tag und Uhrzeit farbig, der Rest bleibt grau (Daniel, 22.09.2026). Ohne TV-Angabe
               trennt der Platzhalter nichts, und der Text bleibt ein Stück. */
            .split(tvText?.zeit || KEIN_TRENNER)
            .flatMap((teil, i) => [
              i ? (
                <span key={`z${i}`} className="font-medium text-sky-700 dark:text-sky-300">
                  {tvText?.zeit}
                </span>
              ) : null,
              teil,
            ])}
        </span>
        </LangMitTooltip>
      </PillenHuelle>
      <MerkenKnopf release={release} today={today} farbe={farbe} />
    </span>
  )
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

/**
 * Fasst die Bezugswege eines Shops zu einer Zeile zusammen.
 *
 * Vorher stand jede Ausgabe in einer eigenen Zeile: „AniMoon — Vol. 1",
 * „AniMoon — Vol. 2", „AniMoon — Vol. 3", „AniMoon — Vol. 4" untereinander. Das
 * sind vier Zeilen für eine Auskunft — nämlich, dass es die Serie bei AniMoon in
 * vier Ausgaben gibt (Daniel, 20.08.2026).
 *
 * Gruppiert wird nach **Hostnamen**, nicht nach Anzeigenamen: Derselbe Shop
 * schreibt sich in unseren Daten mal so, mal anders, die Adresse nicht. Der
 * Anzeigename kommt aus dem gemeinsamen Teil vor dem Gedankenstrich; steht dort
 * nichts Gemeinsames, bleibt der volle Name stehen.
 */
/**
 * Die Farbe eines Bezugswegs — sofern er zu einer Plattform gehört, die wir führen.
 *
 * Die Namen der Kanal-Wege beginnen mit dem Namen der Plattform, auf der man
 * landet („Amazon Prime (Aniverse)"). Wo das zutrifft, bekommt die Pille
 * dieselbe Farbe wie die Anbieter-Pille daneben; ein Shop ohne eigene
 * Plattform (Videobuster, maxdome, JPC) bleibt neutral.
 *
 * Verglichen wird über den **Namensanfang**, nicht über ein Vorkommen
 * irgendwo: „Amazon DVD / Blu-ray" ist ein Kaufweg, kein Prime-Angebot, und
 * soll die Prime-Farbe nicht erben.
 */
/*
  **TOGGO** (Daniel, 19.09.2026, an Dragon Ball Daima). Die Farbe ist abgelesen: „Toggo Logo
  10.2019.svg" und „Toggo plus Logo 10.2019.svg" bei Wikimedia Commons (gemeinfrei, Marke),
  beide #ec6400/#ec6500. Das Zeichen ist das nachgebaute App-Symbol (`public/anbieter/toggo.svg`,
  siehe `anbieter-icon.tsx`).

  **TOGGO zeigt ausschließlich deutsche Fassungen** (Daniel: „toggo ist immer DE, immer,
  ausnahmslos") — der Weg trägt deshalb „DE ✓" ohne Urteil je Folge. Welche Folgen gerade
  abrufbar sind, steht in der zweiten Zeile — aus den Fenstern je Folge, die
  `pipeline/fetch-toggo.ts` täglich holt (`web/src/lib/toggo.ts`).
*/
const TOGGO_ORANGE = '#ec6400'

const PROSIEBEN_MAXX_ROT = '#d21e00'

/** Ein neutraler Fernseher (Umriss, Form wie Tabler „device-tv") — kennzeichnet TV-Pillen. */
function TvZeichen() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 3l-4 4l-4-4" />
    </svg>
  )
}

export const istToggo = (url: string | undefined) => /(^|\.)toggo\.de$/i.test((() => { try { return new URL(url ?? '').hostname } catch { return '' } })())

export function farbeZuAnbieter(voll: string): string | undefined {
  /* „maxdome (über TMDB)" trägt die Farbe von maxdome (22.09.2026). */
  const name = voll.replace(/\s*\(über TMDB\)$/, '')
  /*
    **„Amazon Prime" steht nicht in `PLATFORMS`** — dort heißt der Anbieter
    „Prime Video". Seit der Umbenennung am 07.09.2026 („das kanalabo ist
    implizit … schreib lieber Amazon Prime (Aniverse)") beginnt kein Kanalname
    mehr mit dem Plattformnamen; ohne diese Zeile hätten alle neun Kanal-Pillen
    ihre Farbe verloren — still, denn eine fehlende Farbe sieht aus wie Absicht.
  */
  if (name.startsWith('Amazon Prime')) return PLATFORMS.primevideo.color
  /*
    **aniSearch ist keine Plattform, aber ein Weg** — und trug als einziger den
    farblosen Umriss, während alles daneben Farbe hatte (Daniel, 07.09.2026:
    „verbesser die pill, style sie gelblich"). Das Gelb ist aniSearchs eigene
    Hausfarbe, nicht geraten.
  */
  if (name === 'aniSearch') return '#f0a500'
  if (name === 'TOGGO') return TOGGO_ORANGE
  /*
    **Die Hausfarben der Shops, die keine Plattform bei uns sind.**

    Daniel am 16.09.2026 zur maxdome-Pille: „das maxdome icon ist blau,
    entsprechend die maxdome pill stylen." Bis dahin blieben diese Wege
    farblos, weil sie nicht in `PLATFORMS` stehen — in einer Reihe bunter
    Pillen sieht das aus wie ein Fehler.

    Jede Farbe ist **abgelesen, nicht gewählt**: aus dem jeweiligen Logo bei
    Wikimedia Commons (maxdome 2021: #0094d7, sechs Vorkommen; MagentaTV 2024:
    #e20074, die Telekom-Hausfarbe). Wo ein Markenzeichen vorliegt, trägt die
    Pille es zusätzlich — die übrigen bekommen wenigstens ihre Farbe.
  */
  const SHOP_FARBEN: Record<string, string> = {
    /* maxdome-Logo 2021 bei Wikimedia Commons, sechs Vorkommen. */
    maxdome: '#0094d7',
    /* MagentaTV-Logo 2024, die Telekom-Hausfarbe. */
    MagentaTV: '#e20074',
    /* Die drei aus der simple-icons-Datenbank, die dort die Marken-Hexwerte pflegt. */
    'Rakuten TV': '#bf0000',
    'Sky Store': '#0072c9',
    'freenet meinVOD': '#84bc34',
    /*
      **Apple TV (#000000) und Google Play (#414141) stehen bewusst nicht hier.**
      Ihre Hausfarben sind Schwarz und Dunkelgrau — auf dunklem Grund wäre die
      Pille unsichtbar. Der neutrale Umriss ist dort die bessere Auskunft.
      Videoload und Akibapass fehlen, weil zu ihnen keine belegte Farbe vorliegt;
      geraten wird keine.
    */
  }
  if (SHOP_FARBEN[name]) return SHOP_FARBEN[name]
  for (const p of Object.values(PLATFORMS)) {
    if (p.name && name.startsWith(p.name)) return p.color
  }
  return undefined
}

export function gruppiereKaufwege(
  links: WatchLink[],
): { shop: string; eintraege: { label?: string; url: string; nurFolge?: number; dubRanges?: WatchLink['dubRanges'] }[] }[] {
  const nachHost = new Map<string, WatchLink[]>()
  for (const l of links) {
    let host = l.url
    try {
      host = new URL(l.url).hostname.replace(/^www\./, '')
    } catch {
      // Keine gültige Adresse — dann steht der Eintrag eben für sich allein.
    }
    /* Alle Wege über TMDB teilen sich einen Host — gruppiert wird dort nach Anbieter (22.09.2026). */
    if (l.ueberTmdb) host = `tmdb|${l.name}`
    const liste = nachHost.get(host) ?? []
    liste.push(l)
    nachHost.set(host, liste)
  }

  /*
    **Zwei Schreibweisen, dieselbe Absicht: „Basis, dann Zusatz".**

    Bis zum 07.09.2026 trennte ein Gedankenstrich („Prime Video — ADN
    Kanalabo"), seither eine Klammer („Amazon Prime (ADN)"). Ohne den zweiten
    Fall stünden mehrere Kanäle desselben Hosts wieder als einzelne Pillen
    nebeneinander, statt sich eine Basis zu teilen — dieselbe Auskunft, nur
    breiter.
  */
  const zerlege = (name: string): string[] => {
    const klammer = /^(.+?)\s+\((.+)\)$/.exec(name)
    if (klammer) return [klammer[1]!, klammer[2]!]
    return name.split(/\s+—\s+/)
  }

  return [...nachHost.values()].map((liste) => {
    const geteilt = liste.map((l) => zerlege(l.name))
    const gemeinsam = geteilt.every((t) => t.length > 1 && t[0] === geteilt[0][0])
    if (liste.length === 1 || !gemeinsam) {
      /* Die Adresse ist TMDBs Übersicht, nicht der Anbieter — das steht an der Pille (Daniel, 22.09.2026). */
      return { shop: liste[0].ueberTmdb ? translate('detail.ueberTmdb', { name: liste[0].name }) : liste[0].name, eintraege: liste.map((l) => ({ url: l.url, nurFolge: l.nurFolge, dubRanges: l.dubRanges })) }
    }
    return {
      shop: geteilt[0][0],
      eintraege: liste.map((l, i) => ({ label: geteilt[i].slice(1).join(' — '), url: l.url, nurFolge: l.nurFolge, dubRanges: l.dubRanges })),
    }
  })
}
