import type { Fsk, ReleaseEvent, Title } from '@shared/types.ts'
import { RELEASE_TYPES } from '@shared/types.ts'
import { todayIso } from '@shared/time.ts'
import { istAusgeblieben } from '@shared/logic.ts'
import { useLang } from '../lib/i18n.tsx'
import { coverBild } from '../lib/cover.ts'
import { useShare } from '../lib/share.ts'
import { FskBadge, HideEye, PlatformBadge } from './ui.tsx'
import { KartenKopf } from './KartenKopf.tsx'
import { MitFaehnchen } from './Faehnchen.tsx'

export function EventCard({
  event,
  title,
  fsk,
  favorite,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onOpen,
  dense,
  premiere,
}: {
  event: ReleaseEvent
  title?: Title
  fsk?: Fsk
  favorite?: boolean
  hidden?: boolean
  onToggleFavorite?: () => void
  onToggleHidden?: () => void
  onOpen: () => void
  dense?: boolean
  /** TV-Premiere (`tvPremiere()`): Fähnchen auf der oberen Kante. */
  premiere?: boolean
}) {
  const { t } = useLang()
  const { share, copiedSlug } = useShare()
  const type = RELEASE_TYPES[event.releaseType]
  const cover = title?.coverImage

  /**
   * Ausgeblendet: Der Termin bleibt an seinem Platz, aber nur als Name.
   *
   * Kein Bild, keine Schlagworte, keine Plattform, kein Öffnen — sonst wäre
   * das Ausblenden eine Attrappe. Genau darum ist die ganze Karte hier auch
   * kein Knopf mehr: Ein versehentlicher Klick soll nicht zeigen, was jemand
   * bewusst nicht sehen wollte.
   */
  if (hidden) {
    return (
      <div
        className={[
          'flex w-full items-center gap-2 overflow-hidden rounded-lg border border-dashed',
          'border-slate-300 bg-slate-100/60 text-left dark:border-white/15 dark:bg-white/[0.02]',
          dense ? 'p-1.5' : 'p-2',
        ].join(' ')}
      >
        <span className="line-clamp-1 min-w-0 flex-1 text-[13px] italic text-slate-400 dark:text-slate-500">
          {event.name}
        </span>
        {onToggleHidden && <HideEye hidden onToggle={onToggleHidden} size="sm" />}
      </div>
    )
  }

  /*
    **Ein überholter Termin wird durchgestrichen, nicht entfernt.**

    Daniel am 01.09.2026: „wir haben es erst auf dem kalender gezeigt, dann
    ändert sich das, wir sollten es dort dann rot markieren oder durchstreichen
    oder so, damit weiterhin sichtbar ist, das es dort stand, aber die echte neue
    info es nachweislich überschreibt."

    Wer den Tag im Kopf hatte, sucht ihn — und findet ihn, mitsamt der Auskunft,
    was daraus geworden ist. Nachgeholt (`erschienenAm`) zählt nicht mehr dazu:
    Dann ist die Folge da, und der Termin war nur zu früh.
  */
  const ueberholt = istAusgeblieben(event)

  /*
    **Was vorbei ist, tritt zurück.**

    Daniel am 03.09.2026: „grauton/opacity für termine in vergangenheit
    abschwächen." Eine Kalenderwoche zeigt Montag bis Sonntag, und an einem
    Donnerstag ist die Hälfte davon Geschichte — gleich hell dargestellt
    konkurriert sie mit dem, was noch kommt.

    **Weg ist sie damit nicht**, und das ist Absicht: Wer nachsieht, ob etwas
    erschienen ist, sucht genau dort. Sie ist nur leiser — und beim Zeigen
    kommt sie voll zurück. Gemerkte Titel bleiben immer hell; sie sind der
    Grund, warum jemand die Woche überhaupt aufschlägt.
  */
  const vergangen = event.date < todayIso()
  /*
    **Ein TV-Termin nennt nur die Folge, keine Gesamtzahl** (Daniel, 23.09.2026: „dabei reicht es
    wenn ohne von angezeigt wird, also Flg 3 bzw Ep 3"). tv.de zeigt rund zwei Wochen voraus; der
    Eintrag von „Solo Leveling: Arise from the Shadow" kannte deshalb nur die Folgen 2 und 3 und
    schrieb „Ep 3/3" bei einer Serie mit 13. Die Nummer selbst stammt aus der Episodenliste und
    ist echt — sie bleibt, die erfundene Gesamtzahl geht.
  */
  const gesamtFolgen = event.platform === 'tv' ? undefined : event.episodeCount

  const kachel = (
    /*
      **Die Karte ist kein Knopf, sie enthält einen** (18.09.2026, axe „nested-interactive":
      678 Karten). Als `role="button"` umschloss sie Stern, Auge und Tooltips — für
      Screenreader ein Knopf aus Knöpfen, dessen innere Bedienelemente nicht erreichbar
      sind. Die Maus klickt weiter auf die ganze Fläche; Tastatur und Vorlesen gehen über
      den unsichtbaren Knopf „Details" als erstes Kind, und sein Fokus zieht den Ring der
      Karte auf.
    */
    <div
      onClick={onOpen}
      className={[
        'group relative flex w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border text-left transition',
        /*
          **Fernsehen sieht man auf einen Blick** (Daniel, 16.09.2026: „mark the tv
          episodes in the kalender differently, they should be visually obv that
          they are tv shows"): gestrichelter Rahmen, getönter Grund, Fernseher-Zeichen
          an der Senderplakette. Die linke Kante bleibt die Release-Art.
        */
        event.platform === 'tv' && !favorite
          ? 'border-dashed border-teal-500/60 bg-teal-500/[0.07] hover:border-teal-500 dark:border-teal-400/50 dark:bg-teal-400/[0.08]'
          : '',
        favorite
          ? 'border-amber-400/70 bg-amber-400/[0.07] shadow-[0_0_0_1px_rgba(251,191,36,.25)] hover:border-amber-300'
          : event.platform === 'tv'
            ? ''
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/25 dark:hover:bg-white/[0.08]',
        'has-[.ak-oeffnen:focus-visible]:ring-2 has-[.ak-oeffnen:focus-visible]:ring-sky-400',
        /* 78 % statt 60 — zurückgenommen, nicht ausgeblendet (Daniel, 03.09.2026). */
        vergangen && !favorite ? 'opacity-[0.78] transition-opacity hover:opacity-100' : '',
        dense ? 'p-1.5' : 'p-2',
      ].join(' ')}
      /*
        Die Farbe der linken Kante ist die Release-Art — so steht es in der
        Legende. Eine zweite Bedeutung (Strichart für die Uhrzeit) stand hier am
        03.09.2026 für eine halbe Stunde und ist auf Daniels Wunsch wieder
        gewichen: „offen-border wieder rückgängig machen." Die Trennüberschriften
        bleiben trotzdem weg — die Uhrzeit steht an der Kachel.
      */
      style={{ borderLeft: `3px solid ${type.color}` }}
    >
      <button
        type="button"
        className="ak-oeffnen sr-only"
        onClick={(e) => {
          e.stopPropagation()
          onOpen()
        }}
      >
        {t('card.details', { titel: event.name })}
      </button>
      {/*
        **Der Titel steht unter dem Cover, nicht daneben — und das ist keine
        Geschmacksfrage.**

        Bis zum 05.09.2026 lief die Kachel als **Zeile**: links das Cover,
        rechts eine Spalte aus Kopfzeile, Titel und Marken. Der Titel hatte
        damit 85 von 153 Pixeln Breite, also rund zehn Zeichen je Zeile — bei
        1280 × 900 waren **20 von 42** sichtbaren Titeln gekappt („Skeleton
        Knight in Another…", „Mobile Suit Gundam Hathaway:…").

        Die naheliegende Antwort war eine vierte Zeile. Gemessen
        (`npm run bild:kachel`) trägt sie weniger, als sie kostet:

        ```
        drei Zeilen (Stand)      20 gekappt   134 px
        vierte Zeile              6 gekappt   152 px
        ohne Grenze               0 gekappt   170 px
        Titel über volle Breite   0 gekappt   134 px
        Icons neben den Titel    35 gekappt   134 px
        ```

        Der Engpass ist die **Breite**, nicht die Zeilenzahl. Über die ganze
        Kachel sind es doppelt so viele Zeichen je Zeile, und danach ist kein
        Titel mehr gekappt — ohne einen Pixel Höhe. Die letzte Zeile der
        Messung ist die gemessene Sackgasse: Die Icons neben den Titel zu
        rücken kostet mehr Breite, als die frei werdende Zeile einbringt.

        Daniel hat die Zahlen und die beiden Bilder gesehen und sich dafür
        entschieden (05.09.2026: „zeig problem und lösung visuell bevor ich
        mich entscheide").
      */}
      <div className="flex w-full gap-2">
        {cover && !dense && (
          <img {...coverBild(cover, 28)} alt="" loading="lazy" className="h-10 w-7 shrink-0 rounded object-cover" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
        <KartenKopf
          event={event}
          ueberholt={ueberholt}
          t={t}
          gesamtFolgen={gesamtFolgen}
          share={share}
          copiedSlug={copiedSlug}
          onToggleHidden={onToggleHidden}
          onToggleFavorite={onToggleFavorite}
          favorite={favorite}
        />
        </div>
      </div>
      <span
          className={[
            /*
              Drei Zeilen bleiben die Obergrenze — sie greift seit dem
              05.09.2026 nur noch selten, weil der Titel die volle Kachelbreite
              hat (Begründung und Messung oben). Sie steht weiter da, damit ein
              Ausreißer die Kachel nicht sprengt.
            */
            'line-clamp-4 text-[13px] font-medium leading-snug',
            ueberholt
              ? 'text-slate-400 line-through decoration-rose-500/60 dark:text-slate-500'
              : 'text-slate-900 dark:text-slate-100',
          ].join(' ')}
        >
          {event.name}
        </span>
      <span className="flex flex-wrap items-center gap-1">
        <PlatformBadge platform={event.platform} sender={event.sender} small />
        {fsk !== undefined && <FskBadge fsk={fsk} small />}
      </span>
    </div>
  )
  if (!premiere) return kachel
  return <MitFaehnchen t={t} kachel={kachel} />
}
