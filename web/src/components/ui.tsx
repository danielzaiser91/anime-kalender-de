import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FSK_COLORS, PLATFORMS, RELEASE_TYPES } from '@shared/types.ts'
import type { Fsk, PlatformId, ReleaseStatus, ReleaseType } from '@shared/types.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'

/** Gemeinsamer Fokus- und Zeigerstil aller anklickbaren Elemente. */
const CLICKABLE = 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'

/**
 * Hüllt einen Baustein in einen Hinweis — aber nur, wenn es einen gibt.
 *
 * Warum hier und nicht an den 25 Aufrufstellen: Fast alle davon reichen ihren
 * Hinweis ohnehin als `title` an einen dieser Bausteine durch. Wird die Hülle
 * hier gesetzt, bekommen sie den gestalteten Hinweis alle auf einmal — und es
 * gibt keine Stelle, die beim nächsten Mal vergessen wird (Daniel, 12.08.2026:
 * „keine default web tooltips … überall nutzen").
 */
function mitHinweis(text: string | undefined, seite: 'oben' | 'unten', kind: ReactNode): ReactNode {
  return text ? (
    <Tooltip text={text} seite={seite}>
      {kind}
    </Tooltip>
  ) : (
    kind
  )
}

/**
 * Der Synchro-Stand eines einzelnen Verweises: ✓, ✕ oder ?
 *
 * Steht hier und nicht im Detail-Panel, weil dieselbe Auskunft an zwei Stellen
 * gebraucht wird — unter dem Titel und in der Ansicht „Wo sehen?". Zwei
 * Fassungen desselben Zeichens liefen sonst auseinander.
 */
/**
 * Ob es an diesem Anbieter eine deutsche Synchro gibt.
 *
 * **Es gibt nur noch zwei Zustände: belegt und offen.** Das rote Kreuz ist weg,
 * und mit ihm die Anbieter, die es getragen hätten — steht fest, dass es dort
 * keine deutsche Fassung gibt, wird der Verweis gar nicht mehr ausgeliefert
 * (Daniel, 15.08.2026: „wir interessieren uns als app nur für deutsche
 * synchros, keine anderen synchron sprachen"). Aussortiert wird beim Bauen,
 * siehe `build.ts`; hier kann `dub === false` deshalb nicht mehr ankommen.
 */
export function DubMark({ dub }: { dub?: boolean }) {
  const { t } = useLang()
  if (dub === true) {
    return (
      <Tooltip text={t('detail.dubYes')} seite="oben">
        <span className="text-[11px] font-bold text-emerald-400">🇩🇪 ✓</span>
      </Tooltip>
    )
  }
  return (
    <Tooltip text={t('detail.dubUnknown')} seite="oben">
      <span className="text-[11px] text-slate-400">🇩🇪 ?</span>
    </Tooltip>
  )
}

export function Chip({
  active,
  excluded,
  onClick,
  children,
  color,
  title,
}: {
  active?: boolean
  /** Ausgeschlossen — muss sich auf einen Blick von „gewählt" unterscheiden. */
  excluded?: boolean
  onClick?: () => void
  children: ReactNode
  color?: string
  title?: string
}) {
  return mitHinweis(
    title,
    'unten',
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-pressed={active || excluded}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition',
        CLICKABLE,
        excluded
          ? // Rot und durchgestrichen: Ein bloß andersfarbiger Chip würde sich
            // wie eine zweite Auswahl lesen, nicht wie ein Verbot.
            'border-rose-400/70 bg-rose-500/10 text-rose-600 line-through decoration-rose-500/70 dark:border-rose-400/50 dark:text-rose-300'
          : active
            ? 'border-transparent bg-slate-100 text-slate-900 dark:bg-slate-100 dark:text-slate-900'
            : 'border-slate-300/70 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:text-slate-300 dark:hover:border-white/40 dark:hover:text-white',
      ].join(' ')}
    >
      {excluded && (
        <span aria-hidden="true" className="no-underline">
          ⊘
        </span>
      )}
      {color && !excluded && (
        <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      )}
      {children}
    </button>,
  )
}

/**
 * Maße für alle Plaketten — eine Quelle, damit sie auf einer Linie stehen.
 *
 * Vorher brachte jede ihre eigenen mit: `px-2 py-0.5 text-[11px]` bei Plattform,
 * Release-Art und Status, `h-5 min-w-7 text-xs` bei der FSK. Aus Polsterung
 * berechnete Höhen und eine feste Höhe daneben ergeben nie dieselbe Zahl, und
 * nebeneinander sieht man jeden Pixel Unterschied (Daniel, 15.08.2026: „pills
 * sind nicht gleich groß und nicht pixel genau auf einer Ebene").
 *
 * Deshalb feste Höhe statt Polsterung nach oben und unten, und dieselbe
 * Schriftgröße. Die FSK behält ihre eigene Form — quadratisch, mit Rahmen —,
 * aber nicht mehr ihre eigene Höhe.
 */
const PLAKETTE = 'inline-flex items-center justify-center rounded font-semibold leading-none'
const PLAKETTE_GROESSE = (small?: boolean) => (small ? 'h-4 px-1.5 text-[10px]' : 'h-5 px-2 text-[11px]')

export function PlatformBadge({ platform, small }: { platform: PlatformId; small?: boolean }) {
  const p = PLATFORMS[platform]
  return (
    <span
      className={[
        PLAKETTE,
        'gap-1 uppercase tracking-wide',
        PLAKETTE_GROESSE(small),
      ].join(' ')}
      style={{ background: `${p.color}22`, color: p.color, boxShadow: `inset 0 0 0 1px ${p.color}55` }}
    >
      {p.name}
    </span>
  )
}

export function FskBadge({ fsk, small }: { fsk: Fsk; small?: boolean }) {
  const bg = FSK_COLORS[fsk]
  const dark = fsk === 0 || fsk === 6
  return mitHinweis(
    `FSK ${fsk}`,
    'oben',
    <span
      className={[
        PLAKETTE,
        'rounded-sm font-bold',
        small ? 'h-4 min-w-6 px-1 text-[10px]' : 'h-5 min-w-7 px-1 text-[11px]',
      ].join(' ')}
      style={{ background: bg, color: dark ? '#111' : '#fff', border: '1px solid rgba(0,0,0,.25)' }}
    >
      {fsk}
    </span>,
  )
}

export function ReleaseTypeBadge({ type, small }: { type: ReleaseType; small?: boolean }) {
  const { tRelease } = useLang()
  const style = RELEASE_TYPES[type]
  return mitHinweis(
    tRelease(type, 'hint'),
    'oben',
    <span
      className={[
        PLAKETTE,
        'gap-1',
        PLAKETTE_GROESSE(small),
      ].join(' ')}
      style={{ background: `${style.color}22`, color: style.color, boxShadow: `inset 0 0 0 1px ${style.color}55` }}
    >
      {tRelease(type, 'short')}
    </span>,
  )
}

const STATUS_STYLE: Record<ReleaseStatus, string> = {
  airing: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/40',
  abgeschlossen: 'bg-slate-500/15 text-slate-400 ring-slate-500/40',
  tba: 'bg-amber-500/15 text-amber-400 ring-amber-500/40',
  erschienen: 'bg-sky-500/15 text-sky-400 ring-sky-500/40',
  unbekannt: 'bg-slate-500/10 text-slate-500 ring-slate-500/30',
}

const STATUS_KEY: Record<ReleaseStatus, TranslationKey> = {
  airing: 'status.airing',
  abgeschlossen: 'status.abgeschlossen',
  tba: 'status.tba',
  erschienen: 'status.erschienen',
  unbekannt: 'status.unbekannt',
}

export function StatusBadge({ status, small }: { status: ReleaseStatus; small?: boolean }) {
  const { t } = useLang()
  return (
    <span
      className={[
        PLAKETTE,
        'ring-1',
        PLAKETTE_GROESSE(small),
        STATUS_STYLE[status],
      ].join(' ')}
    >
      {t(STATUS_KEY[status])}
    </span>
  )
}

export function Button({
  children,
  onClick,
  href,
  variant = 'default',
  size = 'md',
  title,
  download,
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  href?: string
  variant?: 'default' | 'primary' | 'ghost'
  size?: 'sm' | 'md'
  title?: string
  download?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const cls = [
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
    CLICKABLE,
    size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
    variant === 'primary'
      ? 'bg-sky-500 text-white hover:bg-sky-400'
      : variant === 'ghost'
        ? 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10'
        : 'bg-slate-200/70 text-slate-800 hover:bg-slate-300/70 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20',
  ].join(' ')

  if (href) {
    return mitHinweis(
      title,
      'oben',
      <a
        className={cls}
        href={href}
        download={download}
        target={download ? undefined : '_blank'}
        rel="noreferrer noopener"
      >
        {children}
      </a>,
    )
  }
  return mitHinweis(
    title,
    'oben',
    <button
      type={type}
      className={`${cls}${disabled ? ' cursor-not-allowed opacity-50' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>,
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
      {children}
    </h2>
  )
}

/** Stern zum Merken eines Titels. */
export function FavoriteStar({
  active,
  onToggle,
  size = 'md',
}: {
  active: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}) {
  const { t } = useLang()
  const hinweis = t(active ? 'card.unfavourite' : 'card.favourite')
  return mitHinweis(
    hinweis,
    'unten',
    <button
      type="button"
      aria-pressed={active}
      aria-label={t(active ? 'card.unfavourite' : 'card.favourite')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={[
        'inline-flex items-center justify-center rounded-full transition',
        CLICKABLE,
        size === 'sm' ? 'size-5 text-[13px]' : 'size-7 text-base',
        active
          ? 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,.55)]'
          : 'text-slate-400/70 hover:text-amber-300 dark:text-slate-500 dark:hover:text-amber-300',
      ].join(' ')}
    >
      {active ? '★' : '☆'}
    </button>
  )
}

/**
 * Drei überlappte Sterne: die **ganze Reihe** auf einmal merken.
 *
 * Als gezeichnetes SVG, nicht als Emoji-Kette: Drei nebeneinandergesetzte ★
 * sähen aus wie drei Knöpfe, und ihre Breite hinge vom Betriebssystem ab. Hier
 * überlappen sie sich sichtbar — das ist genau die Aussage, „mehrere auf
 * einmal".
 *
 * Der Knopf erscheint erst, wenn der Titel selbst gemerkt ist (siehe
 * Aufrufstelle). Das ist Absicht: Er verstärkt eine Entscheidung, die schon
 * gefallen ist, statt eine neue anzubieten — und eine ganze Reihe zu merken,
 * ohne den Titel zu kennen, will niemand.
 */
export function ReihenStern({ alleGemerkt, anzahl, onMerken }: { alleGemerkt: boolean; anzahl: number; onMerken: () => void }) {
  const { t } = useLang()
  const hinweis = t(alleGemerkt ? 'detail.seriesStarAllDone' : 'detail.seriesStarDo', { count: anzahl })
  return mitHinweis(
    hinweis,
    'unten',
    <button
      type="button"
      aria-label={hinweis}
      onClick={(e) => {
        e.stopPropagation()
        onMerken()
      }}
      className={[
        'inline-flex size-7 items-center justify-center rounded-full transition',
        CLICKABLE,
        alleGemerkt
          ? 'text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,.55)]'
          : 'text-slate-400/70 hover:text-amber-300 dark:text-slate-500 dark:hover:text-amber-300',
      ].join(' ')}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
        {/* Zwei blasse Sterne dahinter, einer voll davor — „mehrere auf einmal". */}
        <path
          d="M7.2 4.6l1.25 2.9 3.15.28-2.38 2.08.71 3.08L7.2 11.3l-2.73 1.64.71-3.08L2.8 7.78l3.15-.28L7.2 4.6z"
          fill="currentColor"
          opacity=".45"
        />
        <path
          d="M16.8 4.6l1.25 2.9 3.15.28-2.38 2.08.71 3.08-2.73-1.64-2.73 1.64.71-3.08-2.38-2.08 3.15-.28L16.8 4.6z"
          fill="currentColor"
          opacity=".45"
        />
        <path
          d="M12 8.4l1.72 3.98 4.32.38-3.27 2.85.98 4.23L12 17.59l-3.75 2.25.98-4.23-3.27-2.85 4.32-.38L12 8.4z"
          fill={alleGemerkt ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>,
  )
}

/**
 * Fragezeichen, das seine Erklärung auch auf Berührung zeigt.
 *
 * `Tooltip` allein reicht hier nicht: Er öffnet auf Zeigen und Fokus, und auf
 * einem Telefon gibt es kein Zeigen. Daniel hat ausdrücklich beides verlangt
 * (13.08.2026) — deshalb ist der Anker ein `<button>`, der den Fokus annimmt
 * und den Hinweis damit auch per Fingertipp öffnet.
 */
export function Fragezeichen({ text }: { text: string }) {
  return (
    <Tooltip text={text} seite="unten">
      <button
        type="button"
        aria-label={text}
        onClick={(e) => {
          e.stopPropagation()
          e.currentTarget.focus()
        }}
        className={[
          'inline-flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none',
          'bg-slate-300/70 text-slate-600 transition hover:bg-slate-400/70',
          'dark:bg-white/15 dark:text-slate-300 dark:hover:bg-white/25',
          CLICKABLE,
        ].join(' ')}
      >
        ?
      </button>
    </Tooltip>
  )
}

/**
 * Auge zum Ausblenden eines Titels.
 *
 * Als gezeichnetes SVG statt als Emoji: Ein 👁 sieht je nach Betriebssystem
 * völlig anders aus und lässt sich nicht einfärben — hier soll es aber die
 * Farbe des Zustands tragen und neben dem Stern gleich groß wirken.
 */
export function HideEye({
  hidden,
  onToggle,
  size = 'md',
}: {
  hidden: boolean
  onToggle: () => void
  size?: 'sm' | 'md'
}) {
  const { t } = useLang()
  const hinweis = t(hidden ? 'card.unhide' : 'card.hide')
  return mitHinweis(
    hinweis,
    'unten',
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={t(hidden ? 'card.unhide' : 'card.hide')}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={[
        'inline-flex items-center justify-center rounded-full transition',
        CLICKABLE,
        size === 'sm' ? 'size-5' : 'size-7',
        hidden
          ? 'text-sky-500 dark:text-sky-400'
          : 'text-slate-400/70 hover:text-sky-500 dark:text-slate-500 dark:hover:text-sky-400',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={size === 'sm' ? 'size-3.5' : 'size-[18px]'}
        aria-hidden="true"
      >
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.7" />
        {/* Der Balken bedeutet „ist ausgeblendet" — ohne ihn sähen beide
            Zustände gleich aus, und der Knopf würde nichts erzählen. */}
        {hidden && <path d="M3.5 3.5 20.5 20.5" />}
      </svg>
    </button>
  )
}

/** Kleiner Teilen-Knopf für Kacheln. */
export function ShareIcon({
  onShare,
  copied,
  size = 'md',
}: {
  onShare: () => void
  copied?: boolean
  size?: 'sm' | 'md'
}) {
  const { t } = useLang()
  return mitHinweis(
    t('detail.shareHint'),
    'unten',
    <button
      type="button"
      aria-label={t('detail.share')}
      onClick={(e) => {
        e.stopPropagation()
        onShare()
      }}
      className={[
        'inline-flex items-center justify-center rounded-full transition',
        CLICKABLE,
        size === 'sm' ? 'size-5 text-[12px]' : 'size-7 text-sm',
        copied
          ? 'text-emerald-400'
          : 'text-slate-400/70 hover:text-sky-400 dark:text-slate-500 dark:hover:text-sky-300',
      ].join(' ')}
    >
      {copied ? '✓' : '🔗'}
    </button>
  )
}

/** Schalter für Ja/Nein-Einstellungen. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
}) {
  return mitHinweis(
    hint,
    'unten',
    <label className={`inline-flex items-center gap-2 text-sm ${CLICKABLE}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={[
          'relative h-5 w-9 rounded-full transition',
          checked ? 'bg-sky-500' : 'bg-slate-300 dark:bg-white/20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[1.125rem]' : 'left-0.5',
          ].join(' ')}
        />
      </span>
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
    </label>,
  )
}

/**
 * Ein Hinweis, der zur Seite gehört — nicht der des Betriebssystems.
 *
 * Das `title`-Attribut erzeugt den Standard-Tooltip des Betriebssystems: heller
 * Kasten mit fremder Schrift, mitten in einer dunklen Seite, dazu eine
 * Verzögerung von etwa einer Sekunde und keine Möglichkeit, ihn zu gestalten
 * oder auf dem Handy überhaupt zu sehen. Daniel am 12.08.2026: „keine default
 * web tooltips, sondern rich tooltips, schön gestyled".
 *
 * Deshalb diese Komponente. Bewusst schlicht gebaut:
 *
 * - **Die Blase hängt am `<body>`, nicht am Anker** (`createPortal`). Vorher
 *   stand sie absolut im umschließenden Element, mit dem Zusatz „das reicht,
 *   solange kein Elternteil `overflow: hidden` setzt". Genau daran ist sie
 *   gescheitert: Die Anbieter-Karten in „Wo sehen?" tragen `overflow-hidden`
 *   für ihre runden Ecken, und die Blase wurde oben abgeschnitten (Daniel,
 *   13.08.2026, mit Bild). Das ist keine Eigenheit dieser einen Karte — jeder
 *   Vorfahr mit `overflow: hidden` bricht den Baustein, und man sieht es erst,
 *   wenn jemand hinschaut. Am `<body>` kann das nicht mehr passieren.
 * - **Positioniert wird nach Messung**, nicht per CSS: Der Anker steht irgendwo
 *   im Fenster, die Blase soll mittig darüber stehen und trotzdem im Bild
 *   bleiben. Beides zusammen kann CSS nicht. Reicht der Platz auf der
 *   gewünschten Seite nicht, klappt sie auf die andere.
 * - **Maus **und** Tastatur**, damit er auch ohne Zeigegerät erscheint. Wer
 *   nicht mit der Maus arbeitet, braucht die Erklärung genauso.
 * - **Auf Berührung reagiert er per Klick**, weil es dort kein Schweben gibt.
 * - **`aria-describedby` gibt es nicht**, dafür steht der Text im DOM und wird
 *   vom Screenreader ohnehin vorgelesen.
 *
 * `unterstrichen` zeichnet den Anker gepunktet an — das ist die verabredete
 * Kennzeichnung dafür, dass hinter einem Wort noch etwas steht.
 *
 * **Warum die Blase erst beim Zeigen entsteht** (13.08.2026): Vorher stand sie
 * dauerhaft im DOM und wurde nur per `opacity-0` unsichtbar gemacht. Ein
 * durchsichtiges Element nimmt aber weiterhin Platz im Überlauf ein — bei den
 * Hinweisen am rechten Bildrand ragten 320 Pixel Blase über das Fenster hinaus,
 * und die ganze Seite bekam einen waagrechten Rollbalken. Gemessen in der
 * Ansicht „Wo sehen?": 1.302 Pixel Inhalt bei 1.270 Pixel Fensterbreite.
 *
 * **Und warum sie sich verschiebt:** Ein mittig verankerter Hinweis an einem
 * Symbol am rechten Rand steht zur Hälfte außerhalb des Fensters — sichtbar
 * wäre dann die halbe Erklärung. Nach dem Einblenden wird deshalb einmal
 * gemessen und um so viel verschoben, dass die Blase mit acht Pixeln Abstand
 * ins Bild passt.
 */
export function Tooltip({
  text,
  children,
  unterstrichen,
  seite = 'unten',
}: {
  text: string
  children: ReactNode
  unterstrichen?: boolean
  seite?: 'oben' | 'unten'
}) {
  const [offen, setOffen] = useState(false)
  const anker = useRef<HTMLSpanElement>(null)
  const blase = useRef<HTMLSpanElement>(null)

  /**
   * Position im Fenster, einmal je Öffnen gemessen.
   *
   * `undefined` heißt „noch nicht gemessen" — dann steht die Blase außerhalb
   * des Bildes und wird nur ausgemessen. Ohne diesen Zwischenschritt kennt
   * niemand ihre Breite, und ohne Breite lässt sie sich weder zentrieren noch
   * am Rand festhalten.
   */
  const [pos, setPos] = useState<{ left: number; top: number }>()

  /**
   * `useLayoutEffect`, damit die Position vor dem ersten Bild sitzt — mit
   * `useEffect` blitzte die Blase eine Bildwiederholung lang an der falschen
   * Stelle auf.
   */
  useLayoutEffect(() => {
    if (!offen) {
      setPos(undefined)
      return
    }
    const a = anker.current?.getBoundingClientRect()
    const b = blase.current?.getBoundingClientRect()
    if (!a || !b) return

    const rand = 8
    const luft = 6
    // Waagrecht mittig über dem Anker, aber nie über den Fensterrand hinaus.
    const left = Math.min(
      Math.max(a.left + a.width / 2 - b.width / 2, rand),
      Math.max(rand, window.innerWidth - b.width - rand),
    )
    // Senkrecht auf der gewünschten Seite — es sei denn, dort ist kein Platz.
    const oben = a.top - b.height - luft
    const unten = a.bottom + luft
    const top =
      seite === 'oben'
        ? oben >= rand
          ? oben
          : unten
        : unten + b.height <= window.innerHeight - rand
          ? unten
          : Math.max(rand, oben)
    setPos({ left, top })
  }, [offen, seite])

  return (
    <span
      ref={anker}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOffen(true)}
      onMouseLeave={() => setOffen(false)}
      onFocus={() => setOffen(true)}
      onBlur={() => setOffen(false)}
    >
      <span
        tabIndex={0}
        role="note"
        /*
          `inline-flex` statt `inline`: Ein Inline-Element bezieht seine Höhe aus
          der Zeilenhöhe, nicht aus seinem Inhalt. Eine Plakette mit Hovertext
          stand deshalb in einer 24 Pixel hohen Hülle, eine ohne war 20 Pixel
          hoch — nebeneinander sichtbar verschoben (Daniel, 15.08.2026: „nicht
          pixel genau auf einer Ebene"). Jetzt umschließt die Hülle ihr Kind
          genau.
        */
        className={[
          'inline-flex items-center outline-none',
          unterstrichen ? 'cursor-help underline decoration-dotted underline-offset-2' : '',
        ].join(' ')}
      >
        {children}
      </span>
      {offen &&
        createPortal(
          <span
            ref={blase}
            role="tooltip"
            style={
              pos
                ? { left: pos.left, top: pos.top }
                : // Ungemessen: außerhalb des Bildes, damit niemand sie aufblitzen
                  // sieht. `position: fixed` erzeugt dabei keinen Überlauf.
                  { left: -9999, top: 0 }
            }
            className={[
              'pointer-events-none fixed z-50 w-max max-w-[min(20rem,80vw)]',
              'rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug',
              'bg-slate-900 text-slate-100 shadow-xl ring-1 ring-white/15',
              'dark:bg-slate-800 dark:ring-white/10',
              pos ? 'animate-[hinweisEin_.15s_ease-out]' : '',
            ].join(' ')}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  )
}
